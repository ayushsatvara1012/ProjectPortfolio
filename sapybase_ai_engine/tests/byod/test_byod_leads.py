"""Phase 3.5 test gate: /api/leads/* + /api/conversations/* on the tenant DB.

Exit criteria (RFC docs/rfc-byod.md §13 Phase 3.5):
    "Lead capture/scoring writes & reads correct on tenant DB."

These exercise the exact data-plane SQL the leads + conversations endpoints run,
against the tenant's own lead_capture / chat_logs through the DML-only
vaayu_runtime role (the credential the request path uses) — proving capture,
list, outcome-update, delete, pipeline/action-center reads, and conversation
session-grouping all behave on the tenant DB. Skips when no backend is available.
"""
from __future__ import annotations

import uuid
from urllib.parse import urlsplit

import psycopg2
import pytest

import byod_dataplane
import byod_engine

from .tenant_harness import TENANT_COMPANY_ID


def _runtime_registry(tenant_db_dsn: str):
    """Provision the DML-only vaayu_runtime role and return a registry whose
    dsn_provider yields the runtime DSN (what the engine request path uses)."""
    dbname = urlsplit(tenant_db_dsn).path.lstrip("/")
    admin = psycopg2.connect(tenant_db_dsn)
    admin.autocommit = True
    try:
        with admin.cursor() as cur:
            byod_dataplane.create_runtime_role(cur, password="rt_leads_pw", dbname=dbname)
    finally:
        admin.close()
    runtime_dsn = byod_dataplane.build_runtime_dsn(tenant_db_dsn, "rt_leads_pw")
    return byod_engine.build_registry(lambda _cid: runtime_dsn)


def _insert_lead(cur, company_id, email, *, name=None, context=None, score=None,
                 band=None, status="new", value_usd=None):
    cur.execute(
        """
        INSERT INTO lead_capture
            (company_id, email, name, context, score, score_band, score_reasons, status, value_usd)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (company_id, email, name, context, score, band, "reason", status, value_usd),
    )
    return cur.fetchone()[0]


# ── Lead capture write + list read (the gate) ────────────────────────────────────
def test_lead_capture_write_and_read_on_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            # Dedup probe (capture_lead) finds nothing yet.
            cur.execute(
                "SELECT id FROM lead_capture WHERE company_id = %s AND email = %s "
                "AND created_at > NOW() - INTERVAL '24 hours'",
                (company_id, "a@acme.test"),
            )
            assert cur.fetchone() is None

            _insert_lead(cur, company_id, "a@acme.test", name="Ann", score=90, band="HOT")
            _insert_lead(cur, company_id, "b@acme.test", name="Bob", score=20, band="COLD")
            conn.commit()

            # list_leads: count + ordered select (by score) with a band filter.
            cur.execute(
                "SELECT COUNT(*) FROM lead_capture WHERE company_id = %s AND score_band = %s",
                (company_id, "HOT"),
            )
            assert cur.fetchone()[0] == 1

            cur.execute(
                "SELECT email, score, score_band FROM lead_capture WHERE company_id = %s "
                "ORDER BY score DESC NULLS LAST, created_at DESC",
                (company_id,),
            )
            rows = cur.fetchall()
            assert [r[0] for r in rows] == ["a@acme.test", "b@acme.test"]
            assert rows[0][1] == 90 and rows[0][2] == "HOT"
            cur.close()
    finally:
        reg.close_all()


def test_lead_outcome_update_on_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            lead_id = _insert_lead(cur, company_id, "deal@acme.test", score=80, band="HOT")
            conn.commit()

            # update_lead_outcome: status → won + value, by (id, company_id).
            cur.execute(
                "UPDATE lead_capture SET status = %s, value_usd = %s, status_updated_at = NOW() "
                "WHERE id = %s AND company_id = %s "
                "RETURNING id, status, value_usd, status_updated_at",
                ("won", 1500, lead_id, company_id),
            )
            row = cur.fetchone()
            conn.commit()
            assert row is not None
            assert row[1] == "won"
            assert float(row[2]) == 1500.0
            assert row[3] is not None
            cur.close()
    finally:
        reg.close_all()


def test_lead_delete_on_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            lead_id = _insert_lead(cur, company_id, "gone@acme.test")
            conn.commit()

            # delete_lead: DELETE by (id, company_id) RETURNING (ownership already
            # checked on the control plane).
            cur.execute(
                "DELETE FROM lead_capture WHERE id = %s AND company_id = %s RETURNING id",
                (lead_id, company_id),
            )
            assert cur.fetchone() is not None
            conn.commit()

            cur.execute("SELECT COUNT(*) FROM lead_capture WHERE company_id = %s", (company_id,))
            assert cur.fetchone()[0] == 0
            cur.close()
    finally:
        reg.close_all()


def test_pipeline_and_action_center_reads_on_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            _insert_lead(cur, company_id, "won@acme.test", status="won", value_usd=1000)
            _insert_lead(cur, company_id, "new@acme.test", status="new")
            _insert_lead(cur, company_id, "contacted@acme.test", status="contacted")
            _insert_lead(cur, company_id, "lost@acme.test", status="lost")
            conn.commit()

            # get_lead_pipeline: status + value across all leads.
            cur.execute("SELECT status, value_usd FROM lead_capture WHERE company_id = %s", (company_id,))
            statuses = {r[0] for r in cur.fetchall()}
            assert statuses == {"won", "new", "contacted", "lost"}

            # get_action_center: only open (new/contacted) leads.
            cur.execute(
                "SELECT status FROM lead_capture WHERE company_id = %s AND status IN ('new', 'contacted')",
                (company_id,),
            )
            open_statuses = sorted(r[0] for r in cur.fetchall())
            assert open_statuses == ["contacted", "new"]
            cur.close()
    finally:
        reg.close_all()


# ── Conversations (chat_logs) read on the tenant DB ──────────────────────────────
def test_conversations_session_grouping_on_tenant_db(tenant_db_dsn):
    company_id = str(uuid.uuid4())
    session_a = str(uuid.uuid4())
    reg = _runtime_registry(tenant_db_dsn)
    try:
        with byod_engine.tenant_connection(company_id, registry=reg) as conn:
            cur = conn.cursor()
            # Two messages in one session, one standalone (NULL session_id).
            cur.execute(
                "INSERT INTO chat_logs (company_id, user_query, bot_response, is_unanswered, session_id) "
                "VALUES (%s, 'q1', 'a1', false, %s), (%s, 'q2', 'a2', true, %s)",
                (company_id, session_a, company_id, session_a),
            )
            cur.execute(
                "INSERT INTO chat_logs (company_id, user_query, bot_response, is_unanswered, session_id) "
                "VALUES (%s, 'solo', 'a', false, NULL)",
                (company_id,),
            )
            conn.commit()

            # list_conversations: distinct session count (NULL grouped individually).
            cur.execute(
                """
                SELECT COUNT(*) FROM (
                    SELECT COALESCE(session_id::text, id::text) AS grp
                    FROM chat_logs cl WHERE company_id = %s GROUP BY grp
                ) sub
                """,
                (company_id,),
            )
            assert cur.fetchone()[0] == 2  # one real session + one standalone

            # The grouped session rolls up its 2 messages and flags unanswered.
            cur.execute(
                """
                SELECT COUNT(*) AS message_count, BOOL_OR(is_unanswered) AS has_unanswered
                FROM chat_logs cl
                WHERE company_id = %s AND COALESCE(session_id::text, id::text) = %s
                GROUP BY COALESCE(session_id::text, id::text)
                """,
                (company_id, session_a),
            )
            msg_count, has_unanswered = cur.fetchone()
            assert msg_count == 2
            assert has_unanswered is True
            cur.close()
    finally:
        reg.close_all()
