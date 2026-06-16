"""Phase 4.1 test gate: Insights & caching — analytics on the tenant DB.

Exit criteria (RFC docs/rfc-byod.md §13 Phase 4.1):
    "Insight numbers match a fixture; clock-skewed tenant doesn't skew windows."

These exercise the exact data-plane SQL that the analytics endpoints
(``/api/funnel``, ``/api/roi-benchmarks``, ``/api/leads/{id}/attribution``,
``/api/analytics/generate-report``, ``/api/fixes-needed``) run, against the
tenant's own ``chat_logs`` / ``lead_capture`` through the DML-only
``vaayu_runtime`` role (the credential the request path uses):

* the aggregates match a hand-computed fixture, and
* window boundaries are anchored to **engine / control-plane time** passed as a
  bound parameter (E12 / §16.8) — proving a tenant whose own clock is skewed
  cannot widen or narrow an analytics window.

The window clause mirrors ``main._byod_window_clause`` for a routed tenant:
``" AND created_at >= %s"`` with an engine-computed cutoff (never the tenant
``NOW()``). Skips when no tenant Postgres backend is available.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

import psycopg2
import pytest

import byod_dataplane
import byod_engine

# Pure aggregation helpers shared with the endpoints — the "insight numbers"
# are the endpoint output, so we feed the tenant-DB rows through the same math.
from funnel import build_funnel, build_quality_breakdown
from attribution import summarize_attribution


# Engine-time window cutoff, mirroring main._byod_window_clause for a routed
# tenant: the cutoff is a control-plane timestamp passed as a parameter.
def _engine_cutoff(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _runtime_registry(tenant_db_dsn: str):
    """Provision the DML-only vaayu_runtime role and return a registry whose
    dsn_provider yields the runtime DSN (what the engine request path uses)."""
    dbname = urlsplit(tenant_db_dsn).path.lstrip("/")
    admin = psycopg2.connect(tenant_db_dsn)
    admin.autocommit = True
    try:
        with admin.cursor() as cur:
            byod_dataplane.create_runtime_role(cur, password="rt_insights_pw", dbname=dbname)
    finally:
        admin.close()
    runtime_dsn = byod_dataplane.build_runtime_dsn(tenant_db_dsn, "rt_insights_pw")
    return byod_engine.build_registry(lambda _cid: runtime_dsn)


def _insert_chat(cur, company_id, *, query="q", answered=True, session_id=None,
                 confidence=None, created_at=None):
    cur.execute(
        "INSERT INTO chat_logs "
        "(company_id, user_query, bot_response, is_unanswered, session_id, confidence, created_at) "
        "VALUES (%s, %s, 'a', %s, %s, %s, COALESCE(%s, now()))",
        (company_id, query, not answered, session_id, confidence, created_at),
    )


def _insert_lead(cur, company_id, email, *, status="new", value_usd=None, band=None,
                 referrer=None, utm_source=None, created_at=None):
    cur.execute(
        "INSERT INTO lead_capture "
        "(company_id, email, status, value_usd, score_band, referrer, utm_source, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, COALESCE(%s, now()))",
        (company_id, email, status, value_usd, band, referrer, utm_source, created_at),
    )


# ── Funnel: numbers match a fixture on the tenant DB ─────────────────────────────
def test_funnel_numbers_match_fixture_on_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    s1, s2 = str(uuid.uuid4()), str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    cutoff = _engine_cutoff(30)
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            # 2 engaged sessions in-window, plus a NULL-session row (excluded).
            _insert_chat(cur, company_id, session_id=s1)
            _insert_chat(cur, company_id, session_id=s2)
            _insert_chat(cur, company_id, session_id=None)
            # Leads: 3 total in-window — 1 won ($1500), 1 contacted, 1 new.
            _insert_lead(cur, company_id, "won@x.test", status="won", value_usd=1500, band="HOT")
            _insert_lead(cur, company_id, "ctd@x.test", status="contacted", band="WARM")
            _insert_lead(cur, company_id, "new@x.test", status="new", band="COLD")
            # Out-of-window noise (40 days old) — must NOT count.
            _insert_lead(cur, company_id, "old@x.test", status="won", value_usd=999,
                         band="HOT", created_at=_engine_cutoff(40))
            conn.commit()

            win = " AND created_at >= %s"
            cur.execute(
                "SELECT COUNT(DISTINCT session_id) FROM chat_logs "
                "WHERE company_id = %s AND session_id IS NOT NULL" + win,
                (company_id, cutoff),
            )
            conversations = cur.fetchone()[0] or 0

            cur.execute(
                "SELECT COUNT(*), "
                "COUNT(*) FILTER (WHERE status <> 'new'), "
                "COUNT(*) FILTER (WHERE status = 'won'), "
                "COALESCE(SUM(value_usd) FILTER (WHERE status = 'won'), 0) "
                "FROM lead_capture WHERE company_id = %s" + win,
                (company_id, cutoff),
            )
            leads_total, contacted, won, won_value = cur.fetchone()

            cur.execute(
                "SELECT score_band, COUNT(*) FROM lead_capture "
                "WHERE company_id = %s" + win + " GROUP BY score_band",
                (company_id, cutoff),
            )
            quality_counts = {r[0]: r[1] for r in cur.fetchall()}
            cur.close()
    finally:
        reg.close_all()

    assert conversations == 2
    assert (leads_total, contacted, won) == (3, 2, 1)
    assert round(float(won_value), 2) == 1500.0
    funnel = build_funnel({
        "conversations": conversations, "leads": leads_total,
        "contacted": contacted, "won": won,
    })
    stages = {s["key"]: s for s in funnel["stages"]}
    assert funnel["top"] == 2
    assert stages["conversations"]["count"] == 2
    assert stages["leads"]["count"] == 3
    assert stages["contacted"]["count"] == 2
    assert funnel["won"] == 1
    quality = build_quality_breakdown(quality_counts)
    assert quality["total_scored"] == 3
    assert {b["band"]: b["count"] for b in quality["bands"]} == {"hot": 1, "warm": 1, "cold": 1}


# ── ROI: live 30-day numbers match a fixture on the tenant DB ────────────────────
def test_roi_30day_numbers_match_fixture_on_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    cutoff = _engine_cutoff(30)
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            _insert_chat(cur, company_id, answered=True)
            _insert_chat(cur, company_id, answered=True)
            _insert_chat(cur, company_id, answered=False)
            _insert_lead(cur, company_id, "l1@x.test", status="new")
            _insert_lead(cur, company_id, "l2@x.test", status="won", value_usd=500)
            # Out-of-window answered chat + lead (40 days) — excluded.
            _insert_chat(cur, company_id, answered=True, created_at=_engine_cutoff(40))
            _insert_lead(cur, company_id, "old@x.test", status="new", created_at=_engine_cutoff(40))
            conn.commit()

            win = " AND created_at >= %s"
            cur.execute(
                "SELECT COUNT(*) FROM chat_logs WHERE company_id = %s AND is_unanswered = false" + win,
                (company_id, cutoff),
            )
            answered_30d = cur.fetchone()[0] or 0
            cur.execute(
                "SELECT COUNT(*) FROM chat_logs WHERE company_id = %s" + win,
                (company_id, cutoff),
            )
            total_30d = cur.fetchone()[0] or 0
            cur.execute(
                "SELECT COUNT(*) FROM lead_capture WHERE company_id = %s" + win,
                (company_id, cutoff),
            )
            leads_30d = cur.fetchone()[0] or 0
            cur.execute(
                "SELECT COALESCE(SUM(value_usd), 0), COUNT(*) FROM lead_capture "
                "WHERE company_id = %s AND status = 'won'",
                (company_id,),
            )
            realized_revenue, won_deals = cur.fetchone()
            cur.close()
    finally:
        reg.close_all()

    assert (answered_30d, total_30d, leads_30d) == (2, 3, 2)
    # won query is unwindowed → counts the in-window won lead only here.
    assert won_deals == 1
    assert round(float(realized_revenue), 2) == 500.0
    # Mirror the endpoint's ROI math with default benchmarks.
    avg_cost, avg_lead = 5.00, 50.00
    support_savings = round(answered_30d * avg_cost, 2)
    potential_revenue = round(leads_30d * avg_lead, 2)
    assert support_savings == 10.0
    assert potential_revenue == 100.0
    assert round(support_savings + float(realized_revenue), 2) == 510.0


# ── Attribution: numbers match a fixture on the tenant DB ────────────────────────
def test_attribution_numbers_match_fixture_on_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    cutoff = _engine_cutoff(30)
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            _insert_lead(cur, company_id, "a@x.test", status="won", value_usd=200, utm_source="google")
            _insert_lead(cur, company_id, "b@x.test", status="new", utm_source="google")
            _insert_lead(cur, company_id, "c@x.test", status="new", referrer="https://ref.test")
            _insert_lead(cur, company_id, "old@x.test", status="won", value_usd=9999,
                         utm_source="google", created_at=_engine_cutoff(40))
            conn.commit()

            cur.execute(
                "SELECT referrer, utm_source, status, value_usd FROM lead_capture "
                "WHERE company_id = %s AND created_at >= %s",
                (company_id, cutoff),
            )
            leads = [
                {"referrer": r[0], "utm_source": r[1], "status": r[2], "value_usd": r[3]}
                for r in cur.fetchall()
            ]
            cur.close()
    finally:
        reg.close_all()

    assert len(leads) == 3  # 40-day-old lead excluded by the engine window
    result = summarize_attribution(leads, limit=8)
    sources = {s["source"]: s for s in result["sources"]}
    assert "google" in sources
    assert sources["google"]["leads"] == 2
    assert round(float(sources["google"]["won_value"]), 2) == 200.0


# ── generate-report: peak-block / recent / spam reads on the tenant DB ───────────
def test_generate_report_reads_on_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    win30, win30p = " AND created_at >= %s", [_engine_cutoff(30)]
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            for i in range(6):
                _insert_chat(cur, company_id, query=f"how do i reset device {i}",
                             answered=(i % 2 == 0), session_id=str(uuid.uuid4()))
            _insert_chat(cur, company_id, query="hi")  # spam word, filtered out
            conn.commit()

            # recent conversations (always-fresh)
            cur.execute(
                "SELECT user_query, is_unanswered, created_at FROM chat_logs "
                "WHERE company_id = %s ORDER BY created_at DESC LIMIT 15",
                (company_id,),
            )
            recent = cur.fetchall()
            assert len(recent) == 7

            # peak-activity DailyStats CTE (engine-time window)
            cur.execute(
                "SELECT COUNT(DISTINCT session_id), COUNT(id), "
                "SUM(CASE WHEN is_unanswered = false THEN 1 ELSE 0 END) "
                "FROM chat_logs WHERE company_id = %s" + win30,
                tuple([company_id] + win30p),
            )
            sessions, total_q, answered_q = cur.fetchone()
            assert total_q == 7
            assert answered_q == 4  # 3 even-index answered + the "hi" row

            # spam-filtered trend logs
            cur.execute(
                "SELECT user_query FROM chat_logs WHERE company_id = %s "
                "AND LENGTH(TRIM(user_query)) >= 3 AND LOWER(TRIM(user_query)) NOT IN %s "
                "ORDER BY created_at DESC LIMIT 200",
                (company_id, ("hi", "hello", "test")),
            )
            kept = [r[0] for r in cur.fetchall()]
            cur.close()
    finally:
        reg.close_all()

    assert len(kept) == 6
    assert all("reset device" in q for q in kept)


# ── fixes-needed: failing-question worklist on the tenant DB ─────────────────────
def test_fixes_needed_read_on_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    cutoff = _engine_cutoff(30)
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            # Same question asked twice (one unanswered) + an out-of-window ask.
            _insert_chat(cur, company_id, query="Do you ship to Canada?", answered=False, confidence=0.2)
            _insert_chat(cur, company_id, query="do you ship to canada?", answered=True, confidence=0.3)
            _insert_chat(cur, company_id, query="Old question", answered=False,
                         confidence=0.1, created_at=_engine_cutoff(40))
            conn.commit()

            cur.execute(
                """
                SELECT (array_agg(user_query ORDER BY created_at DESC))[1],
                       COUNT(*), MAX(created_at), AVG(confidence), BOOL_OR(is_unanswered)
                FROM chat_logs
                WHERE company_id = %s AND created_at >= %s
                  AND btrim(COALESCE(user_query, '')) <> ''
                GROUP BY lower(btrim(user_query))
                """,
                (company_id, cutoff),
            )
            rows = cur.fetchall()
            cur.close()
    finally:
        reg.close_all()

    # The two case-variant asks collapse into one group; the 40-day ask is gone.
    assert len(rows) == 1
    rep_query, ask_count, _last, _conf, has_unanswered = rows[0]
    assert ask_count == 2
    assert has_unanswered is True


# ── THE GATE: a clock-skewed tenant cannot skew an engine-anchored window ─────────
def test_clock_skewed_tenant_does_not_skew_windows(tenant_db_dsn):
    """A row written while the tenant's clock was skewed far into the future has a
    ``created_at`` beyond the engine's window upper bound. The billing-cycle query
    (generate-report) bounds on engine/control-plane timestamps (E12), so the
    skewed row is correctly EXCLUDED — whereas a tenant-``NOW()`` upper bound on a
    fast tenant clock would have wrongly included it."""
    company_id = str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    # Engine-authoritative billing window: [now-30d, now] from the control plane.
    period_start = _engine_cutoff(30)
    period_end = datetime.now(timezone.utc)
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            # Legitimate in-window answered row.
            _insert_chat(cur, company_id, answered=True, created_at=_engine_cutoff(5))
            # Tenant clock skewed +100 days: a "now" row by the tenant's reckoning
            # lands in the engine's future.
            tenant_skewed_now = datetime.now(timezone.utc) + timedelta(days=100)
            _insert_chat(cur, company_id, answered=True, created_at=tenant_skewed_now)
            conn.commit()

            # Sanity: the skewed row IS visible to the tenant's own NOW() lower-only
            # window (the naive/unsafe behavior we are protecting against would
            # count it).
            cur.execute(
                "SELECT COUNT(*) FROM chat_logs WHERE company_id = %s "
                "AND created_at >= NOW() - INTERVAL '30 days'",
                (company_id,),
            )
            naive_count = cur.fetchone()[0]

            # Engine-anchored billing window (params, not tenant NOW()).
            cur.execute(
                "SELECT COUNT(*) FROM chat_logs WHERE company_id = %s "
                "AND is_unanswered = false AND created_at >= %s AND created_at <= %s",
                (company_id, period_start, period_end),
            )
            engine_count = cur.fetchone()[0]
            cur.close()
    finally:
        reg.close_all()

    assert naive_count == 2          # tenant NOW() lower-bound counts the future row
    assert engine_count == 1         # engine upper bound excludes the skewed row
