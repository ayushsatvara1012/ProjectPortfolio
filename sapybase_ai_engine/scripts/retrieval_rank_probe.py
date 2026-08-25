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
    venv/bin/python scripts/retrieval_rank_probe.py --mode ranks --company <uuid>
    venv/bin/python scripts/retrieval_rank_probe.py --mode ranks --company <uuid> --labels labels.json

``--mode ranks`` sorts every replayed query into the four buckets §3's decision
turns on:

  IN_TOP5      already works - nothing to fix.
  RANK_6_15    the pool has the right chunk and top_k=5 cuts it. RAISE top_k.
  NOT_IN_POOL  retrieval never surfaces it. top_k CANNOT help - this is ARCH-D.
  NO_GOLD      no chunk in the corpus matches the query's distinctive term at all.
               A data gap, not a retrieval bug (§17's "business development" case).

It also reports whether ``_is_entity_lookup_query`` fires for each failing query,
because that predicate is the gate a raised top_k would sit behind: a RANK_6_15
query the gate does not recognise would not be helped by the fix at all.
"""
from __future__ import annotations

import argparse
import asyncio
import json
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


# ── --mode ranks (Slice H) ───────────────────────────────────────────────────

#: Question scaffolding and filler. Whatever survives this is what makes the query
#: specific, and that is what the right chunk has to contain.
_STOPWORDS = frozenset("""
    what who whom whose which where when why how the a an and or but for of to in
    on at by with from is are was were be been being do does did can could would
    should will shall may might have has had i you we they it me my your our their
    please tell give show send need want know about more some any this that these
    those there here get got there's let us also just like there than then not no
    yes okay ok hi hello thanks thank there're detail details information info
    company companies business businesses person people team teams contact contacts
    number numbers name names email emails phone phones address addresses list
    available availability provide provided kindly regarding required require
""".split())

#: A term matching more rows than this is scaffolding, not a discriminator - it
#: cannot tell us which chunk was the right one.
MAX_GOLD_ROWS = 25

#: Buckets where retrieval was actually exercised, and so the only ones the
#: verdict may divide by.
_MEASURED_BUCKETS = ("IN_TOP5", "RANK_6_15", "NOT_IN_POOL", "NO_GOLD")
_UNMEASURED_BUCKETS = ("TOO_COMMON", "NO_TERMS")

#: Below this many failing queries the split is noise. The first dry run produced
#: exactly one of each and the naive comparison called that a verdict; it is not.
MIN_VERDICT_SAMPLE = 8

_WORD_RE = re.compile(r"[a-z][a-z0-9]{2,}", re.IGNORECASE)

_GOLD_COUNT_SQL = """
    SELECT COUNT(*) FROM company_knowledge
    WHERE company_id = %s AND content ~* ('\\m' || %s || '\\M')
"""


def _query_terms(query: str) -> list[str]:
    """The words that make this query specific, longest first.

    Length-ordered rather than position-ordered: a longer token is more likely to
    be the name or the product than a short generic one.
    """
    words = [w.lower() for w in _WORD_RE.findall(query or "")]
    kept = [w for w in dict.fromkeys(words) if w not in _STOPWORDS and len(w) >= 3]
    return sorted(kept, key=len, reverse=True)


def _gold_term(cur, company_id, query: str,
               override: str | None) -> tuple[str | None, str, str]:
    """The rarest corpus term this query is really asking about.

    Rarest, not first: a term matching 3 rows identifies the answer, one matching
    200 identifies nothing.

    Returns ``(term, bucket, reason)``. When there is no usable term the bucket
    says *why*, because the three reasons mean completely different things and
    collapsing them into one "no gold" row would misreport a limitation of this
    script as a gap in the client's data:

      NO_TERMS    the query is numeric or too short to carry a term ("LR, 500 Ml").
                  Unmeasurable here, nobody's fault.
      TOO_COMMON  terms exist but every one matches more than MAX_GOLD_ROWS rows,
                  so no single chunk is identifiably "the right one". A limit of
                  the harness - excluded from the verdict, not counted against it.
      NO_GOLD     terms were extracted and match ZERO rows. This is the real data
                  gap, §17's "business development" case.
    """
    if override:
        cur.execute(_GOLD_COUNT_SQL, (company_id, override))
        count = cur.fetchone()[0]
        if count:
            return override, "", f"labelled, {count} rows"
        return None, "NO_GOLD", f"labelled term {override!r} absent from corpus"

    terms = _query_terms(query)
    if not terms:
        return None, "NO_TERMS", "no extractable term in the query"

    # The query's most specific term decides whether the corpus can answer it at
    # all. If THAT is absent, a shorter generic word must not rescue the query into
    # a measured bucket: "price quote for Acetonitrile" scored a retrieval failure
    # on the gold term 'quote' when the real finding is that acetonitrile is not in
    # the catalogue. That inflated NOT_IN_POOL by 4 of 7 failures on the first real
    # run - a data gap wearing a retrieval bug's clothes.
    cur.execute(_GOLD_COUNT_SQL, (company_id, terms[0]))
    if cur.fetchone()[0] == 0:
        return None, "NO_GOLD", f"{terms[0]!r}, the query's most specific term, is absent from the corpus"

    scored: list[tuple[int, str]] = []
    common = 0
    for term in terms:
        cur.execute(_GOLD_COUNT_SQL, (company_id, term))
        count = cur.fetchone()[0]
        if 0 < count <= MAX_GOLD_ROWS:
            scored.append((count, term))
        elif count:
            common += 1

    if scored:
        scored.sort()
        return scored[0][1], "", f"{scored[0][0]} rows"
    if common:
        return None, "TOO_COMMON", f"{common} term(s) match >{MAX_GOLD_ROWS} rows each"
    return None, "NO_GOLD", f"no corpus row contains any of {terms[:3]}"


def _first_rank(rows, term: str) -> int | None:
    pattern = re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)
    for index, row in enumerate(rows or [], start=1):
        if row and pattern.search(str(row[0] or "")):
            return index
    return None


def _bucket(pool_rank: int | None, top5_rank: int | None) -> str:
    if top5_rank:
        return "IN_TOP5"
    if pool_rank:
        return "RANK_6_15"
    return "NOT_IN_POOL"


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


async def ranks_async(limit_queries: int, only_company: str | None,
                      labels_path: str | None) -> None:
    """Slice H's measurement: where does the RIGHT chunk rank? (plan §3, §11 phase 2)"""
    labels: dict[str, str] = {}
    if labels_path:
        labels = {k.lower(): v for k, v in json.loads(Path(labels_path).read_text()).items()}

    conn = psycopg2.connect(DATABASE_URL)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    if only_company:
        cur.execute(
            "SELECT id, COALESCE(company_name, '(unnamed)'), vertical FROM companies WHERE id = %s",
            (only_company,),
        )
    else:
        cur.execute(
            """SELECT c.id, COALESCE(c.company_name, '(unnamed)'), c.vertical
               FROM companies c
               WHERE EXISTS (SELECT 1 FROM company_knowledge k WHERE k.company_id = c.id)
               ORDER BY c.company_name"""
        )
    tenants = cur.fetchall()

    print(f"\n## Retrieval rank replay - mode=ranks, {len(tenants)} tenants\n")
    print("Bucket meanings: IN_TOP5 works | RANK_6_15 raise top_k | "
          "NOT_IN_POOL is ARCH-D | NO_GOLD is a data gap.\n")

    totals: dict[str, int] = {}
    gate_misses: list[str] = []

    for company_id, name, vertical in tenants:
        cur.execute(_QUERY_SQL, (company_id, limit_queries))
        queries = cur.fetchall()
        if not queries:
            print(f"{name}: no logged queries in window, skipped.\n")
            continue

        print(f"### {name} ({vertical or 'generic'}) - {len(queries)} real queries\n")
        for query, asks in queries:
            term, unmeasurable, reason = _gold_term(
                cur, company_id, query, labels.get((query or "").lower()))
            entity = app._is_entity_lookup_query(query)
            gate = "entity" if entity else "prose "

            if term is None:
                totals[unmeasurable] = totals.get(unmeasurable, 0) + 1
                print(f"  {unmeasurable:<11} [{gate}] asks={asks} {query[:52]!r} - {reason}")
                continue

            try:
                candidates, top5 = await _replay(conn, company_id, query)
            except Exception as exc:
                print(f"  ! {query[:50]!r} failed: {exc}")
                continue

            pool_rank = _first_rank(candidates, term)
            top5_rank = _first_rank(top5, term)
            bucket = _bucket(pool_rank, top5_rank)
            totals[bucket] = totals.get(bucket, 0) + 1
            print(f"  {bucket:<11} [{gate}] asks={asks} {query[:52]!r} "
                  f"term={term!r} ({reason}) pool={pool_rank} top5={top5_rank}")

            # The fix is gated on this predicate, so a query it does not recognise
            # would not be helped even though its chunk is sitting at rank 6-15.
            if bucket == "RANK_6_15" and not entity:
                gate_misses.append(query)
        print()

    print("-" * 70)
    # Only the measured buckets carry a denominator. TOO_COMMON and NO_TERMS are
    # this script failing to measure, not retrieval failing to retrieve, and
    # counting them as failures would make the corpus look worse than it is.
    measured = sum(totals.get(b, 0) for b in _MEASURED_BUCKETS)
    print(f"  measured: {measured} queries")
    for bucket in _MEASURED_BUCKETS:
        count = totals.get(bucket, 0)
        pct = f"{count / measured * 100:.0f}%" if measured else "-"
        print(f"    {bucket:<12} {count:>4}  {pct}")
    print("  unmeasurable (excluded from the verdict):")
    for bucket in _UNMEASURED_BUCKETS:
        print(f"    {bucket:<12} {totals.get(bucket, 0):>4}")

    raise_k = totals.get("RANK_6_15", 0)
    arch_d = totals.get("NOT_IN_POOL", 0)
    print()
    if raise_k == 0 and arch_d == 0:
        print("VERDICT: no failing queries. Slice H may need no code change at all.")
    elif raise_k + arch_d < MIN_VERDICT_SAMPLE:
        print(f"VERDICT: INCONCLUSIVE - only {raise_k + arch_d} failing queries "
              f"({raise_k} recoverable, {arch_d} never retrieved). Need at least "
              f"{MIN_VERDICT_SAMPLE} before this decides anything. Raise --queries, "
              f"or wait for more traffic.")
    elif raise_k > arch_d * 2:
        print(f"VERDICT: raising top_k is the right fix ({raise_k} recoverable vs "
              f"{arch_d} never retrieved).")
    elif arch_d > raise_k * 2:
        print(f"VERDICT: top_k CANNOT fix this ({arch_d} never retrieved vs "
              f"{raise_k} recoverable). Escalate to ARCH-D - see plan §11 phase 2 step 2.")
    else:
        print(f"VERDICT: SPLIT - {raise_k} recoverable vs {arch_d} never retrieved. "
              f"Raising top_k helps some but is not the whole answer; decide with "
              f"the per-query rows above, not this line.")

    if gate_misses:
        print(f"\nWARNING: {len(gate_misses)} RANK_6_15 queries are NOT classified as "
              f"entity lookups, so a top_k raise gated on _is_entity_lookup_query "
              f"would not reach them:")
        for query in gate_misses[:8]:
            print(f"    {query[:60]!r}")

    print("\nRead-only. Nothing was modified.")
    cur.close()
    conn.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--mode", choices=("contamination", "ranks"), default="contamination")
    ap.add_argument("--queries", type=int, default=25)
    ap.add_argument("--company", help="restrict to one company_id")
    ap.add_argument("--labels", help="JSON {query: expected term} for role-based "
                                     "questions the corpus does not name literally")
    args = ap.parse_args()
    if args.mode == "ranks":
        asyncio.run(ranks_async(args.queries, args.company, args.labels))
        return
    asyncio.run(main_async(args.queries, args.company))


if __name__ == "__main__":
    main()
