"""Phase 2.4 tests: tenant health probe (byod_health).

Exit criteria (RFC docs/rfc-byod.md §13, Phase 2.4):
    "Healthy -> LIVE; unreachable -> error state, no partial state left." (§10)

Pure tests drive ``run_health_check`` with a fake connector (liveness, data-plane
reachability, auth-vs-unreachable classification, error sanitization). The
real-DB tests exercise the query core (``_run_health_queries``) against an actual
runtime role provisioned by byod_dataplane, and skip cleanly without a backend.
The provisioning health *gate* (healthy -> LIVE, failure -> ERROR with no partial
state) is covered in test_byod_admin.py.
"""
from __future__ import annotations

from urllib.parse import urlsplit, urlunsplit

import psycopg2
import pytest

import byod_dataplane
import byod_health
from byod_dsn import DsnValidationError
from byod_health import (
    DataPlaneUnavailable,
    HealthConfig,
    TenantAuthFailed,
    TenantUnreachable,
    run_health_check,
)

from .test_byod_probe import FakeDbError, make_fake_connector, make_failing_connector

# A runtime-style DSN (vaayu_runtime user) that passes validation with _resolver.
RUNTIME_DSN = "postgresql://vaayu_runtime:rtpw@db.tenant.example.com:5432/tenantdb?sslmode=require"


def _resolver(host):
    return ["8.8.8.8"]


# ── Pure ──────────────────────────────────────────────────────────────────────
def test_health_check_passes_for_healthy_db():
    connector = make_fake_connector()
    result = run_health_check(RUNTIME_DSN, resolver=_resolver, connect=connector)
    assert result.healthy is True
    assert result.host == "db.tenant.example.com"
    # Read-only: rolled back + closed, never committed.
    conn = connector.created[0]
    assert conn.rolled_back is True and conn.closed is True and conn.committed is False


def test_health_check_rejects_unsafe_dsn_before_connecting():
    connector = make_fake_connector()
    with pytest.raises(DsnValidationError):
        run_health_check(
            "postgresql://vaayu_runtime:pw@10.0.0.5/db?sslmode=require",
            resolver=lambda h: ["10.0.0.5"],
            connect=connector,
        )
    assert connector.created == []


def test_health_check_classifies_auth_failure():
    connector = make_failing_connector(FakeDbError("auth failed", pgcode="28P01"))
    with pytest.raises(TenantAuthFailed):
        run_health_check(RUNTIME_DSN, resolver=_resolver, connect=connector)


def test_health_check_classifies_unreachable():
    connector = make_failing_connector(OSError("connection refused at db.tenant.example.com:5432"))
    with pytest.raises(TenantUnreachable) as ei:
        run_health_check(RUNTIME_DSN, resolver=_resolver, connect=connector)
    # Sanitized (E6): no host:port leakage.
    assert "db.tenant.example.com" not in str(ei.value)
    assert "5432" not in str(ei.value)


def test_health_check_detects_unreadable_data_plane():
    connector = make_fake_connector(health_query_error=FakeDbError("no such table", pgcode="42P01"))
    with pytest.raises(DataPlaneUnavailable):
        run_health_check(RUNTIME_DSN, resolver=_resolver, connect=connector)


def test_health_check_data_plane_auth_revoked_is_auth_failure():
    connector = make_fake_connector(health_query_error=FakeDbError("denied", pgcode="28000"))
    with pytest.raises(TenantAuthFailed):
        run_health_check(RUNTIME_DSN, resolver=_resolver, connect=connector)


# ── Real Postgres: the query core against a real runtime role ─────────────────
def _swap_credentials(dsn: str, user: str, password: str) -> str:
    parts = urlsplit(dsn)
    port = f":{parts.port}" if parts.port else ""
    netloc = f"{user}:{password}@{parts.hostname}{port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def test_run_health_queries_against_real_runtime_role(control_plane_db_dsn):
    """A provisioned DB + runtime role passes the liveness + reachability checks."""
    dbname = urlsplit(control_plane_db_dsn).path.lstrip("/")
    owner = psycopg2.connect(control_plane_db_dsn)
    owner.autocommit = True
    try:
        with owner.cursor() as cur:
            byod_dataplane.apply_data_plane_schema(cur)
            byod_dataplane.create_runtime_role(cur, password="hp_pw", dbname=dbname)
    finally:
        owner.close()

    rconn = psycopg2.connect(_swap_credentials(control_plane_db_dsn, "vaayu_runtime", "hp_pw"))
    try:
        byod_health._run_health_queries(rconn, HealthConfig())  # no raise == healthy
    finally:
        rconn.rollback()
        rconn.close()


def test_run_health_queries_flags_missing_data_plane(control_plane_db_dsn):
    """A bare DB (no data-plane tables) is reachable but unhealthy for serving."""
    conn = psycopg2.connect(control_plane_db_dsn)
    try:
        with pytest.raises(DataPlaneUnavailable):
            byod_health._run_health_queries(conn, HealthConfig())
    finally:
        conn.rollback()
        conn.close()
