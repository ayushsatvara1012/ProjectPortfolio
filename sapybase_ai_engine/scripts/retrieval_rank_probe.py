"""Offline retrieval replay - where does a chunk actually rank? Read-only.

Two questions this answers, both of which stored data cannot (plan §3, §1.4 F4):

  --mode contamination  F4: do the self-ingested FAQ rows actually SURFACE, or do
                        they sit harmlessly at rank 40? Decides whether the purge
                        buys anything.
  --mode ranks          H: for a query the client complained about, was the right
                        chunk retrieved but ranked 6-15 (raise top_k), or never
                        retrieved at all (top_k cannot help - that is ARCH-D)?

Why replay rather than a query over ``chat_logs.sources``: that column stores the
POST-rerank top 5 only. ``retrieve_knowledge(limit=15)`` returns 15 and
``rerank_chunks(top_k=5)`` discards 10 before anything is stored, so stored data
cannot tell "ranked 6-15" from "never retrieved" - which is exactly the fork both
questions turn on.

Approximate by construction: the corpus has changed since those turns were logged,
and the reranker is an LLM call, so scores are not bit-stable. Directional, not exact.

Usage:
    cd sapybase_ai_engine
    venv/bin/python scripts/retrieval_rank_probe.py --mode contamination --queries 25
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

for _env in (".env.local", ".env"):
    if (ROOT / _env).exists():
        load_dotenv(ROOT / _env)
        break

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set.", file=sys.stderr)
    sys.exit(1)

import main as app  # noqa: E402  - the live retrieval path, not a reimplementation

#: The same fingerprint scripts/faq_loop_audit.py matches on, applied to whatever
#: retrieval actually returned - parent content included, since search targets
#: children and then resolves to the parent's text.
_CONTAMINATED_RE = re.compile(
    r"- FAQPage|acceptedAnswer|📎 Source:|- Question\b", re.IGNORECASE
)

_TENANT_SQL = """
    SELECT DISTINCT ck.company_id, COALESCE(c.company_name, '(unnamed)'), c.vertical
    FROM company_knowledge ck
    LEFT JOIN companies c ON c.id = ck.company_id
    WHERE ck.content ILIKE '%%- FAQPage%%'
       OR ck.content ILIKE '%%acceptedAnswer%%'
       OR ck.content LIKE '%%📎 Source:%%'
       OR ck.content ILIKE '%%- Question%%'
"""

#: Real visitor questions, most-asked first. Replaying invented queries would only
#: measure the probe author's imagination.
_QUERY_SQL = """
    SELECT user_query, COUNT(*) AS asks
    FROM chat_logs
    WHERE company_id = %s
      AND user_query IS NOT NULL
      AND LENGTH(user_query) >= 8
      AND created_at >= NOW() - INTERVAL '90 days'
    GROUP BY user_query
    ORDER BY asks DESC, MAX(created_at) DESC
    LIMIT %s
"""


async def _replay(conn, company_id, query: str):
    """One turn's retrieval, on the live code path."""
    if app._is_entity_lookup_query(query):
        hyde_text = query
    else:
        hyde_text = await app.hyde_expand(query)

    vector = await app.embeddings_model_query.aembed_query(hyde_text)
    if len(vector) > 768:
        vector = vector[:768]

    candidates = await asyncio.to_thread(
        app.retrieve_knowledge, conn, company_id, vector, query
    )
    top5, _score, _scores = await app.rerank_chunks(query, candidates, top_k=5)
    return candidates, top5


def _contaminated_ranks(rows) -> list:
    return [i for i, row in enumerate(rows or [], start=1)
            if row and _CONTAMINATED_RE.search(str(row[0] or ""))]


async def main_async(limit_queries: int, only_company: str | None) -> None:
    conn = psycopg2.connect(DATABASE_URL)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    if only_company:
        # Named explicitly so a CLEANED tenant can still be replayed - the
        # contamination query would no longer return it, which is the point.
        cur.execute(
            "SELECT id, COALESCE(company_name, '(unnamed)'), vertical FROM companies WHERE id = %s",
            (only_company,),
        )
        tenants = cur.fetchall()
    else:
        cur.execute(_TENANT_SQL)
        tenants = cur.fetchall()

    print(f"\n## Retrieval rank replay - {len(tenants)} contaminated tenants\n")
    grand_top5 = grand_top15 = grand_total = 0

    for company_id, name, vertical in tenants:
        cur.execute(_QUERY_SQL, (company_id, limit_queries))
        queries = cur.fetchall()
        if not queries:
            print(f"{name}: no logged queries in window, skipped.\n")
            continue

        print(f"### {name} ({vertical or 'generic'}) - {len(queries)} real queries\n")
        hits_top5 = hits_top15 = 0
        detail = []

        for query, asks in queries:
            try:
                candidates, top5 = await _replay(conn, company_id, query)
            except Exception as exc:
                print(f"  ! {query[:50]!r} failed: {exc}")
                continue

            in_pool = _contaminated_ranks(candidates)
            in_final = _contaminated_ranks(top5)
            if in_final:
                hits_top5 += 1
            if in_pool:
                hits_top15 += 1
            if in_pool or in_final:
                detail.append((query, asks, in_pool, in_final))

        total = len(queries)
        grand_top5 += hits_top5
        grand_top15 += hits_top15
        grand_total += total
        pct5 = hits_top5 / total * 100 if total else 0
        pct15 = hits_top15 / total * 100 if total else 0
        print(f"  contaminated row in the FINAL top 5 : {hits_top5}/{total} ({pct5:.0f}%)")
        print(f"  contaminated row in the 15 candidates: {hits_top15}/{total} ({pct15:.0f}%)")
        for query, asks, in_pool, in_final in detail[:12]:
            print(f"    {query[:58]!r} asks={asks} pool_ranks={in_pool} top5_ranks={in_final}")
        print()

    if grand_total:
        print("-" * 70)
        print(f"TOTAL: top-5 {grand_top5}/{grand_total} "
              f"({grand_top5 / grand_total * 100:.0f}%), "
              f"candidate pool {grand_top15}/{grand_total} "
              f"({grand_top15 / grand_total * 100:.0f}%)")
    print("\nRead-only. Nothing was modified.")
    cur.close()
    conn.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--mode", choices=("contamination", "ranks"), default="contamination")
    ap.add_argument("--queries", type=int, default=25)
    ap.add_argument("--company", help="restrict to one company_id")
    args = ap.parse_args()
    if args.mode == "ranks":
        print("--mode ranks is Slice H's measurement and is not built yet.")
        return
    asyncio.run(main_async(args.queries, args.company))


if __name__ == "__main__":
    main()
