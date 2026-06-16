"""Phase 3.6 test gate: destructive-endpoint guards (offboarding).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 3.6, rule E10 / §16.6):
    "Cancel/offboard removes routing+creds only; tenant tables intact."

For a BYOD tenant the operational rows (knowledge vectors, chat_logs, leads)
live in the CLIENT's own database. Cancellation / deletion / offboarding on the
control plane (DELETE /api/companies/{id}, DELETE /api/admin/companies/{id})
MUST remove only the control-plane routing pointer + encrypted credentials —
Sapybase stops connecting — and MUST NOT drop or delete anything in the client's
DB. Deleting client data is a separate, explicitly-confirmed action (the explicit
purge below, which deletes ROWS via the DML-only role but can never DROP a table).

These exercise the real seams the endpoints use:
  * the offboard primitive (``byod_store.delete_tenant_db_record``) is
    control-plane-only — proven structurally (no DB) and end-to-end (a real
    tenant DB seeded with data stays byte-for-byte intact after an offboard);
  * the explicit bulk purge runs as a DML DELETE through the vaayu_runtime role,
    so rows go but the table — and the role's inability to DROP it — remain.

DB-backed tests skip cleanly when no tenant Postgres backend is available.
"""
from __future__ import annotations

import uuid
from urllib.parse import urlsplit

import psycopg2
import pytest

import byod_dataplane
import byod_engine
import byod_store
from byod_store import (
    TenantDbStatus,
    delete_tenant_db_record,
    get_tenant_db_record,
    store_tenant_db_record,
)

# The three data-plane tables that live in the client's own DB and must survive
# an offboard untouched (mirrors byod_dataplane.DATA_PLANE_SCHEMA_SQL).
_TENANT_TABLES = ("company_knowledge", "chat_logs", "lead_capture")


# ── Structural (no DB) — the offboard primitive never touches the tenant DB ───────
class _RecordingCursor:
    """Minimal fake cursor that records executed SQL and reports one affected row."""

    def __init__(self) -> None:
        self.executed: list[tuple[str, object]] = []
        self.rowcount = 1

    def execute(self, sql, params=None):
        self.executed.append((sql, params))


def test_offboard_primitive_is_control_plane_only():
    """delete_tenant_db_record issues exactly ONE control-plane DELETE — never a
    statement against any tenant data table — so offboarding can never delete the
    client's data (E10/§16.6)."""
    cur = _RecordingCursor()
    removed = delete_tenant_db_record(cur, "company-abc")

    assert removed is True  # rowcount > 0
    assert len(cur.executed) == 1, "offboard must be a single statement"
    sql, params = cur.executed[0]
    assert sql.strip().upper().startswith("DELETE")
    assert byod_store.TABLE_NAME in sql  # the control-plane routing/creds table
    # It must NOT reference any tenant data table, and must never DROP/TRUNCATE.
    upper = sql.upper()
    for table in _TENANT_TABLES:
        assert table not in sql, f"offboard must not touch tenant table {table}"
    assert "DROP" not in upper and "TRUNCATE" not in upper
    assert params == ("company-abc",)


# ── Functional (needs Postgres) ──────────────────────────────────────────────────
def _runtime_setup(tenant_db_dsn: str):
    """Provision the DML-only vaayu_runtime role on the tenant DB and return
    ``(registry, runtime_dsn)`` — the credential + pool the engine request path
    uses (NOT the privileged migrate DSN)."""
    dbname = urlsplit(tenant_db_dsn).path.lstrip("/")
    admin = psycopg2.connect(tenant_db_dsn)
    admin.autocommit = True
    try:
        with admin.cursor() as cur:
            byod_dataplane.create_runtime_role(cur, password="rt_offboard_pw", dbname=dbname)
    finally:
        admin.close()
    runtime_dsn = byod_dataplane.build_runtime_dsn(tenant_db_dsn, "rt_offboard_pw")
    return byod_engine.build_registry(lambda _cid: runtime_dsn), runtime_dsn


def _seed_tenant_data(registry, company_id: str) -> dict[str, int]:
    """Insert a few rows into each tenant data table; return the row counts."""
    with byod_engine.tenant_connection(company_id, registry=registry) as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO company_knowledge (company_id, url, content, chunk_type) "
            "VALUES (%s, 'https://acme.test/a', 'alpha', 'child'), "
            "(%s, 'https://acme.test/b', 'beta', 'child')",
            (company_id, company_id),
        )
        cur.execute(
            "INSERT INTO chat_logs (company_id, user_query, bot_response, is_unanswered) "
            "VALUES (%s, 'q', 'a', false)",
            (company_id,),
        )
        cur.execute(
            "INSERT INTO lead_capture (company_id, email, status) VALUES (%s, 'l@acme.test', 'new')",
            (company_id,),
        )
        conn.commit()
        cur.close()
    return _tenant_counts(registry, company_id)


def _tenant_counts(registry, company_id: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    with byod_engine.tenant_connection(company_id, registry=registry) as conn:
        cur = conn.cursor()
        for table in _TENANT_TABLES:
            # Tables are a fixed allowlist constant — not user input (no injection).
            cur.execute(f"SELECT to_regclass('{table}') IS NOT NULL")
            assert cur.fetchone()[0] is True, f"tenant table {table} must still exist"
            cur.execute(f"SELECT COUNT(*) FROM {table} WHERE company_id = %s", (company_id,))
            counts[table] = cur.fetchone()[0]
        cur.close()
    return counts


def test_offboard_removes_routing_creds_and_leaves_tenant_intact(cp_conn, make_company, tenant_db_dsn):
    """THE GATE: offboarding deletes the control-plane routing + credential record
    (Sapybase stops connecting) while every tenant table and row stays intact."""
    company_id = make_company()
    registry, _ = _runtime_setup(tenant_db_dsn)
    try:
        # Control plane: a LIVE BYOD routing/credential record.
        with cp_conn.cursor() as cur:
            store_tenant_db_record(
                cur, company_id, dsn_ciphertext=b"enc", dsn_key_id="k1",
                schema_version="0001", status=TenantDbStatus.LIVE,
            )
        cp_conn.commit()

        # Tenant plane: seed real data in the client's own DB.
        before = _seed_tenant_data(registry, company_id)
        assert before == {"company_knowledge": 2, "chat_logs": 1, "lead_capture": 1}

        # Offboard (the seam both delete endpoints call): control-plane only.
        with cp_conn.cursor() as cur:
            assert delete_tenant_db_record(cur, company_id) is True
        cp_conn.commit()

        # Routing + creds gone → engine will no longer connect to this tenant.
        with cp_conn.cursor() as cur:
            assert get_tenant_db_record(cur, company_id) is None
            # The company row itself is the caller's concern; the creds are gone.
            cur.execute("SELECT 1 FROM companies WHERE id = %s", (company_id,))
            assert cur.fetchone() is not None

        # Tenant tables + rows untouched — the offboard never opened a tenant conn.
        assert _tenant_counts(registry, company_id) == before
    finally:
        registry.close_all()


def test_offboard_is_idempotent_and_never_touches_tenant(cp_conn, make_company, tenant_db_dsn):
    """A second offboard is a clean no-op (returns False); the tenant DB is still
    fully intact — re-running cancellation can never escalate into data loss."""
    company_id = make_company()
    registry, _ = _runtime_setup(tenant_db_dsn)
    try:
        with cp_conn.cursor() as cur:
            store_tenant_db_record(cur, company_id, dsn_ciphertext=b"enc", dsn_key_id="k1")
        cp_conn.commit()
        before = _seed_tenant_data(registry, company_id)

        with cp_conn.cursor() as cur:
            assert delete_tenant_db_record(cur, company_id) is True
            assert delete_tenant_db_record(cur, company_id) is False  # idempotent
        cp_conn.commit()

        assert _tenant_counts(registry, company_id) == before
    finally:
        registry.close_all()


def test_explicit_purge_deletes_rows_but_keeps_table_and_role_cannot_drop(tenant_db_dsn):
    """The explicit, user-confirmed purge (DELETE /api/train/{id}) deletes ROWS on
    the tenant DB via the DML-only runtime role — but the table survives, and the
    role cannot DROP/TRUNCATE it, so 'tenant tables intact' holds even here."""
    company_id = str(uuid.uuid4())
    registry, runtime_dsn = _runtime_setup(tenant_db_dsn)
    try:
        before = _seed_tenant_data(registry, company_id)
        assert before["company_knowledge"] == 2

        # The exact purge_knowledge SQL, routed to the tenant DB.
        with byod_engine.tenant_connection(company_id, registry=registry) as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM company_knowledge WHERE company_id = %s", (company_id,))
            conn.commit()
            cur.execute("SELECT to_regclass('company_knowledge') IS NOT NULL")
            assert cur.fetchone()[0] is True  # rows gone, table intact
            cur.execute("SELECT COUNT(*) FROM company_knowledge WHERE company_id = %s", (company_id,))
            assert cur.fetchone()[0] == 0
            cur.close()

        # The DML-only role can never DROP/TRUNCATE the table (blast-radius bound).
        rconn = psycopg2.connect(runtime_dsn)
        try:
            with rconn.cursor() as cur:
                with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                    cur.execute("DROP TABLE company_knowledge")
            rconn.rollback()
            with rconn.cursor() as cur:
                with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                    cur.execute("TRUNCATE chat_logs")
            rconn.rollback()
        finally:
            rconn.close()
    finally:
        registry.close_all()
