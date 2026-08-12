"""FAQ feedback-loop audit — read-only probes for Slice F (docs/bot-output-quality-plan.md §1).

Three consumers read the same two tables, so they are written once here rather
than three times ad hoc:

  --probe pool    F2: how the publishable Q&A pool changes under `turn_state`
                  instead of `is_unanswered`, with per-exclusion-class counts.
  --probe ingest  F4: `company_knowledge` rows that look like our own FAQPage
                  markup ingested back as source knowledge. DRY RUN ONLY.
  --probe all     both.

Usage:
    cd sapybase_ai_engine
    export DATABASE_URL="<prod URL>"        # already in .env
    venv/bin/python scripts/faq_loop_audit.py --probe all
    venv/bin/python scripts/faq_loop_audit.py --probe ingest --company <uuid> --samples 10

Every statement below is a SELECT. There is no DELETE here by design: F4's delete
is a separate, reviewed step and must not share a process with the counting.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from packs.registry import load_pack  # noqa: E402
from services.agent_runtime.states import TurnState  # noqa: E402
from services.faq_eligibility import excluded_by  # noqa: E402

# The enum's value is lowercase ("answered"). Reading it rather than writing the
# literal is what keeps F2's gate from silently matching zero rows.
ANSWERED = TurnState.ANSWERED.value

for _env in (".env.local", ".env"):
    _p = ROOT / _env
    if _p.exists():
        load_dotenv(_p)
        break

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set. Add it to .env or export it.", file=sys.stderr)
    sys.exit(1)


def probe_pool(cur, company: str | None, samples: int) -> None:
    """F2: current gate vs. proposed gate, per company, with exclusion classes."""
    print("\n## Probe: publishable Q&A pool (F2)\n")

    where_company = "AND cl.company_id = %s" if company else ""
    params: list = [company] if company else []

    cur.execute(
        f"""
        SELECT cl.company_id,
               COALESCE(c.company_name, '(unnamed)'),
               c.vertical,
               cl.user_query,
               cl.bot_response,
               cl.is_unanswered,
               cl.turn_state,
               cl.sources
        FROM chat_logs cl
        LEFT JOIN companies c ON c.id = cl.company_id
        WHERE LENGTH(cl.bot_response) >= 80
          AND cl.created_at >= NOW() - INTERVAL '90 days'
          {where_company}
        """,
        params,
    )
    rows = cur.fetchall()

    per_company: dict = {}
    flagged_samples: list[tuple] = []
    pack_cache: dict = {}

    for company_id, name, vertical, q, a, is_unanswered, turn_state, sources in rows:
        key = (str(company_id), name, vertical or "(generic)")
        stats = per_company.setdefault(
            key, {"current": 0, "proposed": 0, "null_state": 0, "classes": Counter()}
        )

        if vertical not in pack_cache:
            pack_cache[vertical] = load_pack(vertical)
        pack = pack_cache[vertical]

        if isinstance(sources, str):
            try:
                import json
                sources = json.loads(sources)
            except Exception:
                sources = None

        current_eligible = is_unanswered is False
        proposed_eligible = turn_state == ANSWERED

        if current_eligible:
            stats["current"] += 1
        if proposed_eligible:
            stats["proposed"] += 1
        if turn_state is None:
            stats["null_state"] += 1

        if not current_eligible:
            continue
        for cls_name in excluded_by(q, a, pack=pack, sources=sources):
            stats["classes"][cls_name] += 1
            if len(flagged_samples) < samples:
                flagged_samples.append((name, cls_name, q, (a or "")[:140]))

    if not per_company:
        print("No rows in window.")
        return

    print(f"{'company':<24} {'vertical':<10} {'current':>8} {'turn_state':>11} {'null':>7}  exclusions (of current)")
    print("-" * 110)
    for (cid, name, vertical), s in sorted(per_company.items(), key=lambda kv: -kv[1]["current"]):
        classes = ", ".join(f"{k}={v}" for k, v in s["classes"].most_common()) or "-"
        print(f"{name[:23]:<24} {vertical[:9]:<10} {s['current']:>8} {s['proposed']:>11} {s['null_state']:>7}  {classes}")

    totals_current = sum(s["current"] for s in per_company.values())
    totals_proposed = sum(s["proposed"] for s in per_company.values())
    all_classes: Counter = Counter()
    for s in per_company.values():
        all_classes.update(s["classes"])

    print("-" * 110)
    print(f"{'TOTAL':<24} {'':<10} {totals_current:>8} {totals_proposed:>11}")
    print(f"\nPool change under F2: {totals_current} -> {totals_proposed} "
          f"({totals_current - totals_proposed:+d} rows).")
    print("Exclusion classes across the CURRENT pool (overlapping, not additive):")
    for k, v in all_classes.most_common():
        pct = (v / totals_current * 100) if totals_current else 0
        print(f"  {k:<16} {v:>6}  ({pct:.1f}% of current pool)")

    if flagged_samples:
        print(f"\nSamples ({len(flagged_samples)}):")
        for name, cls_name, q, a in flagged_samples:
            print(f"  [{cls_name}] {name[:20]} | Q: {(q or '')[:60]!r}\n      A: {a!r}")


def probe_ingest(cur, company: str | None, samples: int) -> None:
    """F4: company_knowledge rows that came from our own FAQPage markup. DRY RUN."""
    print("\n## Probe: self-ingested FAQ rows (F4 dry run)\n")

    where_company = "AND ck.company_id = %s" if company else ""
    params: list = [company] if company else []

    # `_flatten_entity` renders a FAQPage as "- FAQPage" / "  - name: ..." /
    # "  - acceptedAnswer: text: ...", so those literal shapes are the fingerprint.
    cur.execute(
        f"""
        SELECT ck.id, ck.company_id, COALESCE(c.company_name, '(unnamed)'),
               ck.url, ck.chunk_type, ck.parent_id, ck.content, ck.created_at
        FROM company_knowledge ck
        LEFT JOIN companies c ON c.id = ck.company_id
        WHERE (
            ck.content ILIKE '%%- FAQPage%%'
            OR ck.content ILIKE '%%acceptedAnswer%%'
            OR ck.content LIKE '%%📎 Source:%%'
            OR ck.content ILIKE '%%- Question%%'
        )
        {where_company}
        ORDER BY ck.company_id, ck.created_at
        """,
        params,
    )
    rows = cur.fetchall()

    if not rows:
        print("No self-ingested rows detected.")
        return

    per_company: dict = {}
    ids: list = []
    for row_id, company_id, name, url, chunk_type, parent_id, content, created in rows:
        key = (str(company_id), name)
        s = per_company.setdefault(key, {"parent": 0, "child": 0, "urls": Counter()})
        s[chunk_type if chunk_type in ("parent", "child") else "child"] += 1
        s["urls"][url or "(no url)"] += 1
        ids.append(row_id)

    print(f"{'company':<28} {'parents':>8} {'children':>9}  top source urls")
    print("-" * 110)
    for (cid, name), s in sorted(per_company.items(), key=lambda kv: -(kv[1]['parent'] + kv[1]['child'])):
        top_urls = ", ".join(f"{u} ({n})" for u, n in s["urls"].most_common(2))
        print(f"{name[:27]:<28} {s['parent']:>8} {s['child']:>9}  {top_urls[:44]}")

    print("-" * 100)
    print(f"TOTAL rows matched: {len(rows)}")

    # Children whose parent is also matched must be deleted together — deleting a
    # parent alone leaves rows retrieval can surface but not expand (plan §1.4 F4).
    matched = set(ids)
    orphan_risk = sum(
        1 for r in rows if r[5] is not None and r[5] not in matched
    )
    print(f"Children whose parent is NOT in the matched set: {orphan_risk} "
          f"(these need the parent checked before any delete).")

    print(f"\nSamples ({min(samples, len(rows))}):")
    for row in rows[:samples]:
        row_id, _, name, url, chunk_type, parent_id, content, created = row
        snippet = " ".join((content or "").split())[:160]
        print(f"  {name[:20]} | {chunk_type} | {url} | {created:%Y-%m-%d %H:%M}")
        print(f"    {snippet!r}")

    print("\nDRY RUN — nothing was deleted. Review these counts before F4's delete step.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--probe", choices=("pool", "ingest", "all"), default="all")
    ap.add_argument("--company", help="restrict to one company_id (uuid)")
    ap.add_argument("--samples", type=int, default=8)
    args = ap.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    conn.set_session(readonly=True)
    try:
        cur = conn.cursor()
        if args.probe in ("pool", "all"):
            probe_pool(cur, args.company, args.samples)
        if args.probe in ("ingest", "all"):
            probe_ingest(cur, args.company, args.samples)
        cur.close()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
