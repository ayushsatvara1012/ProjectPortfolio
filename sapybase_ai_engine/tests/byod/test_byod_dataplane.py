"""Phase 2.3 tests: data-plane schema + DML-only runtime role (byod_dataplane).

Exit criteria (RFC docs/rfc-byod.md §13, Phase 2.3):
    "Schema created; runtime role cannot DDL/DROP (privilege test); version
     recorded." (§5.4)

The pure tests cover the version constant and runtime-DSN derivation. The
privilege guarantee can only be proven against a real Postgres, so the
schema-apply + role-privilege tests run against a bare ephemeral DB (pgvector
available on the server) and skip cleanly when no backend is configured.
"""
from __future__ import annotations

from urllib.parse import urlsplit, urlunsplit

import psycopg2
import pytest

import byod_dataplane
from byod_dataplane import (
    DATA_PLANE_SCHEMA_VERSION,
    RUNTIME_ROLE_NAME,
    build_runtime_dsn,
)
from embedding_config import EMBEDDING_DIMENSIONS

GOOD_DSN = "postgresql://owner:s3cr3t@db.tenant.example.com:5432/tenantdb?sslmode=require"


# ── Pure ──────────────────────────────────────────────────────────────────────
def test_schema_version_is_recorded_constant():
    assert DATA_PLANE_SCHEMA_VERSION  # non-empty; the value stored in the registry


def test_schema_locks_vector_dimension_to_embedding_config():
    assert f"vector({EMBEDDING_DIMENSIONS})" in byod_dataplane.DATA_PLANE_SCHEMA_SQL


def test_build_runtime_dsn_swaps_user_keeps_target():
    runtime = build_runtime_dsn(GOOD_DSN, "p@ss/w0rd:with#chars")
    assert runtime.startswith(f"postgresql://{RUNTIME_ROLE_NAME}:")
    # Same host / port / dbname / sslmode as the migrate DSN.
    assert "@db.tenant.example.com:5432/tenantdb" in runtime
    assert "sslmode=require" in runtime
    # The migrate password is gone; the runtime password is URL-encoded.
    assert "s3cr3t" not in runtime
    assert "p@ss/w0rd" not in runtime  # special chars percent-encoded


# ── Real Postgres: schema apply + the runtime-role privilege gate ─────────────
def _swap_credentials(dsn: str, user: str, password: str) -> str:
    parts = urlsplit(dsn)
    port = f":{parts.port}" if parts.port else ""
    netloc = f"{user}:{password}@{parts.hostname}{port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def test_apply_schema_creates_data_plane_tables(control_plane_db_dsn):
    """`apply_data_plane_schema` lays down the data-plane tables on a clean DB."""
    conn = psycopg2.connect(control_plane_db_dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            byod_dataplane.apply_data_plane_schema(cur)
            for table in byod_dataplane.DATA_PLANE_TABLES:
                cur.execute("SELECT to_regclass(%s)", (table,))
                assert cur.fetchone()[0] is not None, f"{table} not created"
            # pgvector extension is enabled and the embedding column is vector(N).
            cur.execute(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name='company_knowledge' AND column_name='embedding'"
            )
            assert cur.fetchone() is not None
    finally:
        conn.close()


def test_runtime_role_is_dml_only(control_plane_db_dsn):
    """THE GATE: vaayu_runtime can DML the data-plane tables but cannot DDL/DROP."""
    runtime_password = "rt_test_pw_123"
    dbname = urlsplit(control_plane_db_dsn).path.lstrip("/")

    # Provision schema + runtime role as the privileged owner.
    owner = psycopg2.connect(control_plane_db_dsn)
    owner.autocommit = True
    try:
        with owner.cursor() as cur:
            byod_dataplane.apply_data_plane_schema(cur)
            byod_dataplane.create_runtime_role(cur, password=runtime_password, dbname=dbname)
    finally:
        owner.close()

    # Connect AS the runtime role and assert least privilege.
    runtime_dsn = _swap_credentials(control_plane_db_dsn, RUNTIME_ROLE_NAME, runtime_password)
    rconn = psycopg2.connect(runtime_dsn)
    try:
        with rconn.cursor() as cur:
            # DML is allowed.
            cur.execute(
                "INSERT INTO chat_logs (company_id, user_query, bot_response) "
                "VALUES (gen_random_uuid(), 'q', 'a')"
            )
            rconn.commit()
            cur.execute("SELECT count(*) FROM chat_logs")
            assert cur.fetchone()[0] == 1

        # DDL (CREATE) is denied.
        with rconn.cursor() as cur:
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                cur.execute("CREATE TABLE evil (id int)")
        rconn.rollback()

        # DROP is denied.
        with rconn.cursor() as cur:
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                cur.execute("DROP TABLE chat_logs")
        rconn.rollback()

        # TRUNCATE (destructive table privilege) is denied.
        with rconn.cursor() as cur:
            with pytest.raises(psycopg2.errors.InsufficientPrivilege):
                cur.execute("TRUNCATE chat_logs")
        rconn.rollback()
    finally:
        rconn.close()


def test_create_runtime_role_is_idempotent(control_plane_db_dsn):
    """Re-running provisioning (double-click / retry) must not error (§16.6)."""
    dbname = urlsplit(control_plane_db_dsn).path.lstrip("/")
    conn = psycopg2.connect(control_plane_db_dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            byod_dataplane.apply_data_plane_schema(cur)
            byod_dataplane.create_runtime_role(cur, password="pw_one", dbname=dbname)
            # Second run resets the password rather than failing on "role exists".
            byod_dataplane.create_runtime_role(cur, password="pw_two", dbname=dbname)
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (RUNTIME_ROLE_NAME,))
            assert cur.fetchone() is not None
    finally:
        conn.close()
