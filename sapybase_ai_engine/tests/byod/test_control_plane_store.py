"""Phase 1.2 test gate: control-plane encrypted-DSN store + routing.

Exit criteria (RFC docs/rfc-byod.md §13, Phase 1.2):
    "Migration applies; store/read round-trip of a dummy record."

Two layers:
  * Structural tests (no database) — the Alembic migration 0014 is correctly
    chained and runs the canonical DDL; the store API surface is coherent.
  * Functional round-trip — against a *real* Postgres (ephemeral): apply the
    exact migration DDL, store a dummy encrypted-DSN record, read it back
    unchanged, transition status/schema_version, and offboard (delete routing +
    creds). Skips cleanly when no Postgres backend is available.
"""
from __future__ import annotations

import importlib.util
import uuid
from pathlib import Path

import psycopg2
import pytest

from byod_store import (
    CONTROL_PLANE_SCHEMA_SQL,
    TABLE_NAME,
    TENANT_DB_STATUSES,
    TenantDbRecord,
    TenantDbStatus,
    delete_tenant_db_record,
    get_tenant_db_record,
    store_tenant_db_record,
    update_tenant_db_schema_version,
    update_tenant_db_status,
)

_ENGINE_ROOT = Path(__file__).resolve().parents[2]
_MIGRATION_PATH = (
    _ENGINE_ROOT / "alembic_migrations" / "versions" / "0014_byod_control_plane.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("byod_migration_0014", _MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


# ── Structural (no DB) ───────────────────────────────────────────────────────

class TestMigrationWiring:
    def test_migration_file_exists(self):
        assert _MIGRATION_PATH.exists(), _MIGRATION_PATH

    def test_revision_chain(self):
        m = _load_migration()
        assert m.revision == "0014"
        assert m.down_revision == "0013"

    def test_upgrade_downgrade_callable(self):
        m = _load_migration()
        assert callable(m.upgrade) and callable(m.downgrade)

    def test_uses_canonical_ddl(self):
        # The migration imports the single-source-of-truth DDL — no drift.
        m = _load_migration()
        assert m.CONTROL_PLANE_SCHEMA_SQL is CONTROL_PLANE_SCHEMA_SQL


class TestSchemaConstant:
    def test_table_and_columns_present(self):
        sql = CONTROL_PLANE_SCHEMA_SQL
        assert TABLE_NAME in sql
        for col in (
            "company_id", "dsn_ciphertext", "dsn_data_key", "dsn_nonce",
            "dsn_key_id", "schema_version", "status",
        ):
            assert col in sql, f"DDL missing column {col}"

    def test_routing_fk_and_status_guard(self):
        sql = CONTROL_PLANE_SCHEMA_SQL
        assert "REFERENCES companies(id)" in sql  # routing key → company
        assert "ON DELETE CASCADE" in sql          # offboard removes metadata, not data
        # Every Python status must appear in the DB CHECK constraint.
        for status in TENANT_DB_STATUSES:
            assert status in sql, f"CHECK missing status {status}"

    def test_status_constants_match_set(self):
        named = {
            TenantDbStatus.PENDING, TenantDbStatus.PROVISIONING, TenantDbStatus.LIVE,
            TenantDbStatus.NEEDS_RECONNECT, TenantDbStatus.DISABLED, TenantDbStatus.ERROR,
        }
        assert named == set(TENANT_DB_STATUSES)


# ── Functional round-trip (needs Postgres) ───────────────────────────────────
# The `cp_conn` and `make_company` fixtures are shared via tests/byod/conftest.py.

def test_schema_applies_and_table_exists(cp_conn):
    with cp_conn.cursor() as cur:
        cur.execute("SELECT to_regclass(%s)", (TABLE_NAME,))
        assert cur.fetchone()[0] == TABLE_NAME


def test_store_read_roundtrip(cp_conn, make_company):
    company_id = make_company()
    ciphertext = b"\x00\x01\x02enc-dsn\xff"
    data_key = b"wrapped-data-key"
    nonce = b"nonce-123"

    with cp_conn.cursor() as cur:
        stored = store_tenant_db_record(
            cur,
            company_id,
            dsn_ciphertext=ciphertext,
            dsn_key_id="kms-key-v1",
            dsn_data_key=data_key,
            dsn_nonce=nonce,
            schema_version="0001",
            status=TenantDbStatus.PROVISIONING,
        )
    cp_conn.commit()

    assert isinstance(stored, TenantDbRecord)
    assert stored.company_id == company_id
    assert stored.dsn_ciphertext == ciphertext
    assert stored.dsn_key_id == "kms-key-v1"

    # Read back via the routing lookup — bytes survive the bytea round-trip intact.
    with cp_conn.cursor() as cur:
        got = get_tenant_db_record(cur, company_id)
    assert got is not None
    assert got.dsn_ciphertext == ciphertext
    assert got.dsn_data_key == data_key
    assert got.dsn_nonce == nonce
    assert got.dsn_key_id == "kms-key-v1"
    assert got.schema_version == "0001"
    assert got.status == TenantDbStatus.PROVISIONING
    assert got.created_at is not None and got.updated_at is not None


def test_get_missing_returns_none(cp_conn):
    with cp_conn.cursor() as cur:
        assert get_tenant_db_record(cur, str(uuid.uuid4())) is None


def test_store_is_upsert_and_never_persists_plaintext(cp_conn, make_company):
    company_id = make_company()
    with cp_conn.cursor() as cur:
        store_tenant_db_record(cur, company_id, dsn_ciphertext=b"v1", dsn_key_id="k1")
        store_tenant_db_record(cur, company_id, dsn_ciphertext=b"v2", dsn_key_id="k2",
                               status=TenantDbStatus.LIVE)
    cp_conn.commit()

    with cp_conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM {TABLE_NAME} WHERE company_id = %s", (company_id,))
        assert cur.fetchone()[0] == 1  # upsert, not a second row
        got = get_tenant_db_record(cur, company_id)
    assert got.dsn_ciphertext == b"v2"
    assert got.dsn_key_id == "k2"
    assert got.status == TenantDbStatus.LIVE
    # There is no plaintext-DSN column at all — credentials are ciphertext-only.
    with cp_conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = %s",
            (TABLE_NAME,),
        )
        cols = {r[0] for r in cur.fetchall()}
    assert not any("plain" in c or c in {"dsn", "dsn_url", "connection_string"} for c in cols)


def test_update_status_and_schema_version(cp_conn, make_company):
    company_id = make_company()
    with cp_conn.cursor() as cur:
        store_tenant_db_record(cur, company_id, dsn_ciphertext=b"x", dsn_key_id="k")
        assert update_tenant_db_status(cur, company_id, TenantDbStatus.LIVE) is True
        assert update_tenant_db_schema_version(cur, company_id, "0007") is True
        got = get_tenant_db_record(cur, company_id)
    assert got.status == TenantDbStatus.LIVE
    assert got.schema_version == "0007"


def test_update_missing_company_returns_false(cp_conn):
    with cp_conn.cursor() as cur:
        assert update_tenant_db_status(cur, str(uuid.uuid4()), TenantDbStatus.LIVE) is False


def test_invalid_status_rejected_in_python_and_db(cp_conn, make_company):
    company_id = make_company()
    # Python guard.
    with cp_conn.cursor() as cur:
        with pytest.raises(ValueError):
            store_tenant_db_record(cur, company_id, dsn_ciphertext=b"x",
                                   dsn_key_id="k", status="HACKED")
    cp_conn.rollback()
    # DB CHECK constraint (defense in depth) — raw insert of a bad status fails.
    with pytest.raises(psycopg2.errors.CheckViolation):
        with cp_conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {TABLE_NAME} (company_id, dsn_ciphertext, dsn_key_id, status) "
                "VALUES (%s, %s, %s, %s)",
                (company_id, psycopg2.Binary(b"x"), "k", "HACKED"),
            )
    cp_conn.rollback()


def test_offboard_deletes_routing_only(cp_conn, make_company):
    company_id = make_company()
    with cp_conn.cursor() as cur:
        store_tenant_db_record(cur, company_id, dsn_ciphertext=b"x", dsn_key_id="k")
        assert delete_tenant_db_record(cur, company_id) is True
        assert get_tenant_db_record(cur, company_id) is None
        # The company itself (and, in production, the client's DB) is untouched.
        cur.execute("SELECT 1 FROM companies WHERE id = %s", (company_id,))
        assert cur.fetchone() is not None
    cp_conn.commit()


def test_company_delete_cascades_routing_row(cp_conn, make_company):
    company_id = make_company()
    with cp_conn.cursor() as cur:
        store_tenant_db_record(cur, company_id, dsn_ciphertext=b"x", dsn_key_id="k")
        cur.execute("DELETE FROM companies WHERE id = %s", (company_id,))
        assert get_tenant_db_record(cur, company_id) is None
    cp_conn.commit()
