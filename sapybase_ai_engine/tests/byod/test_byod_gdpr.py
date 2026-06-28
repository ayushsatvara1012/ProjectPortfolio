"""GDPR Right-to-Erasure correctness for BYOD (control-plane erasure + offboard-only).

The /api/user/gdpr-delete endpoint previously selected ``companies.owner_id`` and
deleted from ``chunks``/``knowledge_sources``/``leads`` — a column and tables that
exist nowhere else in the engine, so erasure 500'd. This guards the fix:

  * a pure source-guard (runs in engine-regression) that the endpoint uses the real
    schema names and never the bogus ones; and
  * a real-PG test that the corrected erasure removes the user's whole control-plane
    footprint, cascades company-scoped rows, and *offboards* BYOD bots (drops routing
    + credentials) WITHOUT opening a tenant connection — the client's own DB is left
    to the client (E10/§16.6).
"""
from __future__ import annotations

import re
import uuid
from pathlib import Path

import psycopg2
import pytest

from db import byod_store

_MAIN_PY = Path(__file__).resolve().parents[1].parent / "main.py"


# ── Pure source-guard: the exact bug must never come back ─────────────────────

def _gdpr_source() -> str:
    text = _MAIN_PY.read_text()
    start = text.index("async def gdpr_delete_user")
    end = text.index("\n@app.", start)  # next route decorator
    return text[start:end]


def test_gdpr_uses_real_schema_names_not_the_bug():
    src = _gdpr_source()
    # The fix: select bots by the real owner column.
    assert "companies WHERE user_id" in src
    # The bug: these column/table names exist nowhere else in the engine.
    assert "owner_id" not in src, "regressed: gdpr-delete uses companies.owner_id"
    for bogus in ("FROM chunks", "FROM knowledge_sources", "FROM leads"):
        assert bogus not in src, f"regressed: gdpr-delete references nonexistent {bogus!r}"
    # Offboard-only for BYOD: routing/creds removed, client DB never opened.
    assert "_byod_offboard" in src
    assert "tenant_connection" not in src, "gdpr-delete must not open a tenant DB (offboard-only)"


# ── Real-PG: corrected erasure + offboard-only semantics ─────────────────────

def _build_control_schema(cur) -> None:
    cur.execute("CREATE TABLE users (id UUID PRIMARY KEY, clerk_id TEXT)")
    cur.execute(
        "CREATE TABLE companies (id UUID PRIMARY KEY, "
        "user_id UUID REFERENCES users(id) ON DELETE CASCADE)"
    )
    cur.execute(
        "CREATE TABLE usage_tracking (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
        "user_id UUID, company_id UUID REFERENCES companies(id) ON DELETE CASCADE)"
    )
    # Shared-DB knowledge copy (endpoint deletes explicitly; no FK needed).
    cur.execute(
        "CREATE TABLE company_knowledge (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
        "company_id UUID)"
    )
    for t in ("exact_query_cache", "chat_logs", "lead_capture"):
        cur.execute(
            f"CREATE TABLE {t} (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
            "company_id UUID REFERENCES companies(id) ON DELETE CASCADE)"
        )
    # byod_tenant_databases (references companies(id) ON DELETE CASCADE).
    cur.execute(byod_store.CONTROL_PLANE_SCHEMA_SQL)


def _count(cur, table, where, params) -> int:
    cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}", params)
    return cur.fetchone()[0]


def _run_gdpr_erasure(cur, user_id: str) -> list[str]:
    """Mirror the control-plane erasure the endpoint performs."""
    cur.execute("SELECT id FROM companies WHERE user_id = %s", (user_id,))
    company_ids = [r[0] for r in cur.fetchall()]
    for cid in company_ids:
        byod_store.delete_tenant_db_record(cur, cid)  # _byod_offboard
        cur.execute("DELETE FROM company_knowledge WHERE company_id = %s", (cid,))
        cur.execute("DELETE FROM exact_query_cache WHERE company_id = %s", (cid,))
    cur.execute("DELETE FROM companies WHERE user_id = %s", (user_id,))
    cur.execute("DELETE FROM usage_tracking WHERE user_id = %s", (user_id,))
    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    return company_ids


def test_gdpr_erases_control_plane_footprint_and_offboards_byod(control_plane_db_dsn):
    conn = psycopg2.connect(control_plane_db_dsn)
    try:
        cur = conn.cursor()
        _build_control_schema(cur)

        # User U: a shared bot (C1) + a BYOD bot (C2). Another user U2 (C3) is the
        # control group that must survive untouched.
        u, u2 = str(uuid.uuid4()), str(uuid.uuid4())
        c1, c2, c3 = (str(uuid.uuid4()) for _ in range(3))
        cur.execute("INSERT INTO users (id, clerk_id) VALUES (%s,'clk_u'),(%s,'clk_u2')", (u, u2))
        cur.execute(
            "INSERT INTO companies (id, user_id) VALUES (%s,%s),(%s,%s),(%s,%s)",
            (c1, u, c2, u, c3, u2),
        )
        for cid, uid in ((c1, u), (c2, u), (c3, u2)):
            cur.execute("INSERT INTO usage_tracking (user_id, company_id) VALUES (%s,%s)", (uid, cid))
            for t in ("company_knowledge", "exact_query_cache", "chat_logs", "lead_capture"):
                cur.execute(f"INSERT INTO {t} (company_id) VALUES (%s)", (cid,))
        # C2 is BYOD-enrolled: a registry record with routing + (stub) credentials.
        cur.execute(
            "INSERT INTO byod_tenant_databases (company_id, dsn_ciphertext, dsn_key_id, status) "
            "VALUES (%s,%s,%s,'LIVE')",
            (c2, psycopg2.Binary(b"ciphertext"), "key-1"),
        )
        conn.commit()

        purged = _run_gdpr_erasure(cur, u)
        conn.commit()
        assert set(purged) == {c1, c2}

        # User U fully erased.
        assert _count(cur, "users", "id = %s", (u,)) == 0
        assert _count(cur, "companies", "user_id = %s", (u,)) == 0
        assert _count(cur, "usage_tracking", "user_id = %s", (u,)) == 0
        # Shared-DB knowledge copy gone for both of U's bots (incl. BYOD residual).
        assert _count(cur, "company_knowledge", "company_id IN %s", ((c1, c2),)) == 0
        # Company-scoped rows cascaded away.
        for t in ("exact_query_cache", "chat_logs", "lead_capture"):
            assert _count(cur, t, "company_id IN %s", ((c1, c2),)) == 0, t
        # BYOD bot offboarded: routing + credentials removed (engine stops connecting).
        assert _count(cur, "byod_tenant_databases", "company_id = %s", (c2,)) == 0

        # Control group U2/C3 is completely untouched.
        assert _count(cur, "users", "id = %s", (u2,)) == 1
        assert _count(cur, "companies", "id = %s", (c3,)) == 1
        for t in ("usage_tracking", "company_knowledge", "exact_query_cache", "chat_logs", "lead_capture"):
            assert _count(cur, t, "company_id = %s", (c3,)) == 1, t
    finally:
        conn.close()
