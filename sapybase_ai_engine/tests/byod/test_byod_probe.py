"""Phase 2.2 tests: the tenant-database capability probe (byod_probe).

Exit criteria (RFC docs/rfc-byod.md §13, Phase 2.2):
    "DB without pgvector / old version rejected; double-submit idempotent
     (advisory lock)." (rules 16.7, 16.6)

The pure tests drive the probe with an injected fake connector (no Postgres),
covering the full pgvector/version/dimension matrix and error sanitization. The
real-DB tests exercise the SQL core (``_run_probe``) against the ephemeral
pgvector tenant database from the Phase 0.1 harness, and skip cleanly when no
backend is available. The advisory-locked, idempotent *provisioning* gate lives
in test_byod_admin.py (it needs the control-plane store).
"""
from __future__ import annotations

import pytest

import byod_probe
from byod_dsn import DsnValidationError
from byod_probe import (
    PgvectorUnavailable,
    PgvectorVersionTooOld,
    ProbeConfig,
    TenantConnectionError,
    VectorDimensionUnsupported,
    probe_tenant_database,
)
from embedding_config import EMBEDDING_DIMENSIONS

GOOD_DSN = "postgresql://app:s3cr3t@db.tenant.example.com:5432/tenantdb?sslmode=require"


def _resolver(host):  # any host → public IP, so the SSRF re-check passes
    return ["8.8.8.8"]


class FakeDbError(Exception):
    """A stand-in driver error carrying a SQLSTATE ``pgcode`` (for classifying
    auth / data-plane failures in health + probe tests)."""

    def __init__(self, message: str = "db error", pgcode: str | None = None):
        super().__init__(message)
        self.pgcode = pgcode


# ── Fake connection (shared with test_byod_admin/health via make_fake_connector) ─
class _FakeCursor:
    """A minimal DB-API cursor that answers the probe + health + role query set."""

    def __init__(self, conn: "FakeConn"):
        self._conn = conn

    def execute(self, sql, params=None):
        self._conn.calls.append(sql)
        s = " ".join(sql.lower().split())
        if "from pg_available_extensions" in s:
            self._conn._result = self._conn.available_row
        elif "create extension" in s:
            if self._conn.create_extension_error is not None:
                raise self._conn.create_extension_error
            self._conn._result = None
        elif "from pg_extension" in s:
            self._conn._result = (self._conn.extversion,) if self._conn.extversion else None
        elif "create temp table" in s:
            if self._conn.temp_table_error is not None:
                raise self._conn.temp_table_error
            self._conn._result = None
        elif "show server_version" in s:
            self._conn._result = (self._conn.server_version,)
        elif "from company_knowledge" in s:  # health: data-plane reachability
            if self._conn.health_query_error is not None:
                raise self._conn.health_query_error
            self._conn._result = (1,)
        elif s == "select 1":  # health: liveness
            self._conn._result = (1,)
        else:  # SET statement_timeout, DDL, GRANT/role SQL, etc.
            self._conn._result = None

    def fetchone(self):
        return self._conn._result


class FakeConn:
    """A scriptable fake tenant connection — no Postgres required."""

    def __init__(
        self,
        *,
        available_row=("0.7.0", "0.7.0"),
        extversion="0.7.0",
        server_version="16.2",
        create_extension_error=None,
        temp_table_error=None,
        health_query_error=None,
    ):
        self.available_row = available_row
        self.extversion = extversion
        self.server_version = server_version
        self.create_extension_error = create_extension_error
        self.temp_table_error = temp_table_error
        self.health_query_error = health_query_error
        self.calls: list[str] = []
        self.rolled_back = False
        self.committed = False
        self.closed = False
        self._result = None

    def cursor(self):
        return _FakeCursor(self)

    def rollback(self):
        self.rolled_back = True

    def commit(self):
        self.committed = True

    def close(self):
        self.closed = True


def make_fake_connector(**kwargs):
    """Build an injectable connector that yields configured :class:`FakeConn`s.

    The returned callable exposes ``.created`` (the list of connections it
    handed out) so a test can assert how many times the DB was actually probed.
    """
    created: list[FakeConn] = []

    def _connect(dsn: str) -> FakeConn:
        conn = FakeConn(**kwargs)
        created.append(conn)
        return conn

    _connect.created = created  # type: ignore[attr-defined]
    return _connect


def make_failing_connector(exc: Exception):
    def _connect(dsn: str):
        raise exc

    return _connect


# ── Pure: happy path ──────────────────────────────────────────────────────────
def test_probe_accepts_healthy_database():
    connector = make_fake_connector(available_row=("0.7.0", "0.7.0"), extversion="0.7.0")
    result = probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector)

    assert result.host == "db.tenant.example.com"
    assert result.sslmode == "require"
    assert result.pgvector_version == "0.7.0"
    assert result.pgvector_version_tuple == (0, 7, 0)
    assert result.embedding_dimensions == EMBEDDING_DIMENSIONS
    assert result.server_version == "16.2"


def test_probe_is_side_effect_free():
    """The probe must roll back + close and never commit (no mutation of the
    client DB)."""
    connector = make_fake_connector()
    probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector)
    conn = connector.created[0]
    assert conn.rolled_back is True
    assert conn.closed is True
    assert conn.committed is False


def test_probe_installs_extension_when_available_but_not_created():
    # installed_version is NULL → probe issues CREATE EXTENSION, then reads version.
    connector = make_fake_connector(available_row=("0.7.0", None), extversion="0.7.0")
    result = probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector)
    assert result.pgvector_version == "0.7.0"
    assert any("create extension" in c.lower() for c in connector.created[0].calls)


# ── Pure: rejection matrix (DB without pgvector / old version) ────────────────
def test_probe_rejects_when_pgvector_unavailable():
    connector = make_fake_connector(available_row=None)
    with pytest.raises(PgvectorUnavailable):
        probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector)


def test_probe_rejects_when_extension_cannot_be_created():
    connector = make_fake_connector(
        available_row=("0.7.0", None),
        create_extension_error=RuntimeError("permission denied for database"),
    )
    with pytest.raises(PgvectorUnavailable):
        probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector)


def test_probe_rejects_old_pgvector_version():
    connector = make_fake_connector(available_row=("0.4.0", "0.4.0"), extversion="0.4.0")
    with pytest.raises(PgvectorVersionTooOld):
        probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector)


def test_probe_accepts_exact_minimum_version():
    connector = make_fake_connector(available_row=("0.5.0", "0.5.0"), extversion="0.5.0")
    result = probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector)
    assert result.pgvector_version_tuple == (0, 5, 0)


def test_probe_rejects_when_vector_dimension_uncreatable():
    connector = make_fake_connector(
        available_row=("0.7.0", "0.7.0"),
        extversion="0.7.0",
        temp_table_error=RuntimeError("type modifier is not allowed"),
    )
    with pytest.raises(VectorDimensionUnsupported):
        probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector)


def test_probe_rejects_unparseable_version():
    connector = make_fake_connector(available_row=("x", "x"), extversion="not-a-version")
    with pytest.raises(PgvectorUnavailable):
        probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector)


# ── Pure: connection failure is sanitized (E6) ────────────────────────────────
def test_probe_sanitizes_connection_error():
    # The raw driver error leaks host:port; the surfaced error must not.
    raw = OSError("could not connect to server at db.tenant.example.com:5432: timeout")
    connector = make_failing_connector(raw)
    with pytest.raises(TenantConnectionError) as ei:
        probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector)
    msg = str(ei.value)
    assert "db.tenant.example.com" not in msg
    assert "5432" not in msg


def test_probe_rejects_unsafe_dsn_before_connecting():
    connector = make_fake_connector()
    with pytest.raises(DsnValidationError):
        probe_tenant_database(
            "postgresql://app:pw@10.0.0.5/db?sslmode=require",
            resolver=lambda h: ["10.0.0.5"],
            connect=connector,
        )
    assert connector.created == []  # never opened a connection


def test_min_version_is_configurable():
    connector = make_fake_connector(available_row=("0.6.0", "0.6.0"), extversion="0.6.0")
    cfg = ProbeConfig(min_pgvector_version=(0, 7, 0))
    with pytest.raises(PgvectorVersionTooOld):
        probe_tenant_database(GOOD_DSN, resolver=_resolver, connect=connector, config=cfg)


# ── Real-DB: the SQL core against an actual pgvector tenant database ───────────
def test_run_probe_against_real_pgvector_db(tenant_conn):
    """_run_probe proves pgvector + vector(768) on a real ephemeral tenant DB."""
    try:
        version_str, version_tuple, server_version = byod_probe._run_probe(
            tenant_conn, ProbeConfig()
        )
    finally:
        tenant_conn.rollback()  # discard the probe's transaction

    assert version_tuple >= (0, 5, 0)
    assert version_str
    assert server_version


def test_run_probe_real_db_enforces_minimum(tenant_conn):
    """An impossibly-high floor rejects even a healthy real DB (§16.7)."""
    cfg = ProbeConfig(min_pgvector_version=(99, 0, 0))
    try:
        with pytest.raises(PgvectorVersionTooOld):
            byod_probe._run_probe(tenant_conn, cfg)
    finally:
        tenant_conn.rollback()
