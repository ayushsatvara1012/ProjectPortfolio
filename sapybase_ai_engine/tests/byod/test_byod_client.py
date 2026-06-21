"""BYOD client self-serve gate (UI plan Phase 4).

Covers ``byod_client`` — the own-company-only surface a BYOD-entitled customer
drives themselves. The security-critical contracts here are:

  * the client may store a DSN **only while onboarding** (no row yet, or status
    PENDING / NEEDS_RECONNECT) — a LIVE connection is frozen to them (plan §0);
  * storage reuses the admin validate → encrypt → store path verbatim (no parallel
    weaker secret path), so an unsafe DSN is rejected and nothing is stored;
  * ``request_change`` performs no mutation;
  * the projection carries no credential material.

Pure tests (frozen/editable logic, request-kind validation, requirements shape)
run everywhere via monkeypatch. The control-plane round-trip tests reuse an
ephemeral Postgres and skip cleanly when no backend is available.
"""
from __future__ import annotations

import os
import uuid

import psycopg2
import pytest

import byod_admin
import byod_client
import byod_store
from byod_client import (
    CLIENT_EDITABLE_STATUSES,
    CLIENT_REQUIREMENTS,
    REQUEST_KINDS,
    ConnectionFrozen,
    InvalidRequestKind,
    get_client_view,
    request_change,
    set_own_connection,
)
from byod_crypto import LocalKmsProvider, load_decrypted_dsn
from byod_dsn import DsnValidationError
from byod_store import (
    CONTROL_PLANE_SCHEMA_SQL,
    TenantDbStatus,
    get_tenant_db_record,
)

GOOD_DSN = "postgresql://app:s3cr3t@db.tenant.example.com:5432/tenantdb?sslmode=require"


def _resolver(host):  # public IP for any host → SSRF check passes
    return ["8.8.8.8"]


# ── Pure: constants + requirements ────────────────────────────────────────────
def test_editable_statuses_are_onboarding_only():
    # LIVE must NOT be editable by the client (the §0 freeze); only the two
    # onboarding states are.
    assert CLIENT_EDITABLE_STATUSES == frozenset(
        {TenantDbStatus.PENDING, TenantDbStatus.NEEDS_RECONNECT}
    )
    assert TenantDbStatus.LIVE not in CLIENT_EDITABLE_STATUSES


def test_request_kinds_are_reconnect_and_leave():
    assert REQUEST_KINDS == frozenset({"reconnect", "leave"})


def test_requirements_expose_egress_ips_and_no_secrets():
    reqs = CLIENT_REQUIREMENTS
    assert "74.220.48.0/24" in reqs["egress_ip_ranges"]
    assert "74.220.56.0/24" in reqs["egress_ip_ranges"]
    assert reqs["tls_required"] is True
    assert reqs["embedding_dimensions"] == 768
    # The only "PASSWORD" present is the DSN-format placeholder, never a real value.
    assert reqs["dsn_format"].count("PASSWORD") == 1
    assert "USER:PASSWORD@HOST" in reqs["dsn_format"]


# ── Pure: freeze / editable logic via monkeypatch (no DB needed) ──────────────
class _LiveRecord:
    status = TenantDbStatus.LIVE
    runtime_dsn_ciphertext = b"enc"
    schema_version = "0001"
    created_at = None
    updated_at = None


def test_set_own_connection_frozen_when_live(monkeypatch):
    monkeypatch.setattr(byod_admin, "resolve_company_id", lambda cur, cid: "co-1")
    monkeypatch.setattr(byod_store, "get_tenant_db_record", lambda cur, cid: _LiveRecord())
    # Should refuse BEFORE touching the validate/encrypt path.
    def _boom(*a, **k):  # pragma: no cover - must not be reached
        raise AssertionError("set_connection must not run when frozen")
    monkeypatch.setattr(byod_admin, "set_connection", _boom)

    with pytest.raises(ConnectionFrozen) as exc:
        set_own_connection(object(), "clerk_x", GOOD_DSN, object())
    assert exc.value.status == TenantDbStatus.LIVE


def test_set_own_connection_allowed_when_no_row_yet(monkeypatch):
    monkeypatch.setattr(byod_admin, "resolve_company_id", lambda cur, cid: "co-1")
    monkeypatch.setattr(byod_store, "get_tenant_db_record", lambda cur, cid: None)
    called = {}
    monkeypatch.setattr(
        byod_admin, "set_connection",
        lambda cur, cid, dsn, kms, resolver=None: called.update(dsn=dsn) or {"ok": True},
    )
    set_own_connection(object(), "clerk_x", GOOD_DSN, object())
    assert called["dsn"] == GOOD_DSN  # delegates to the shared admin path


def test_set_own_connection_no_company_raises(monkeypatch):
    monkeypatch.setattr(byod_admin, "resolve_company_id", lambda cur, cid: None)
    with pytest.raises(byod_admin.CompanyNotFound):
        set_own_connection(object(), "clerk_x", GOOD_DSN, object())


def test_request_change_rejects_unknown_kind_before_db(monkeypatch):
    # Bad kind must fail before any company resolution (no DB hit).
    def _boom(*a, **k):  # pragma: no cover
        raise AssertionError("resolve_company_id must not run for a bad kind")
    monkeypatch.setattr(byod_admin, "resolve_company_id", _boom)
    with pytest.raises(InvalidRequestKind):
        request_change(object(), "clerk_x", "delete-everything")


def test_request_change_no_company_raises(monkeypatch):
    monkeypatch.setattr(byod_admin, "resolve_company_id", lambda cur, cid: None)
    with pytest.raises(byod_admin.CompanyNotFound):
        request_change(object(), "clerk_x", "reconnect")


def test_request_change_acknowledges_valid_kind(monkeypatch):
    monkeypatch.setattr(byod_admin, "resolve_company_id", lambda cur, cid: "co-1")
    result = request_change(object(), "clerk_x", "leave", note="going self-hosted")
    assert result == {"company_id": "co-1", "kind": "leave", "acknowledged": True}


# ── Control-plane round-trip fixtures (skip cleanly without a backend) ─────────
@pytest.fixture
def client_conn(control_plane_db_dsn: str):
    """Control-plane DB with stub users + companies + the BYOD schema applied."""
    conn = psycopg2.connect(control_plane_db_dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "CREATE TABLE users ("
                " id SERIAL PRIMARY KEY,"
                " clerk_id TEXT UNIQUE,"
                " tier TEXT,"
                " custom_plan_config JSONB)"
            )
            cur.execute(
                "CREATE TABLE companies ("
                " id UUID PRIMARY KEY,"
                " user_id INTEGER REFERENCES users(id))"
            )
            cur.execute(CONTROL_PLANE_SCHEMA_SQL)
        conn.commit()
        yield conn
    finally:
        conn.close()


@pytest.fixture
def make_user(client_conn):
    """Factory: create a user (+ optional company); returns (clerk_id, company_id)."""

    def _create(with_company: bool = True):
        clerk_id = f"user_{uuid.uuid4().hex[:12]}"
        company_id = None
        with client_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (clerk_id, tier) VALUES (%s, 'CUSTOM') RETURNING id",
                (clerk_id,),
            )
            user_id = cur.fetchone()[0]
            if with_company:
                company_id = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO companies (id, user_id) VALUES (%s, %s)",
                    (company_id, user_id),
                )
        client_conn.commit()
        return clerk_id, company_id

    return _create


@pytest.fixture
def kms():
    return LocalKmsProvider({"k1": os.urandom(32)}, active_key_id="k1")


def test_view_not_started_for_entitled_user_without_row(client_conn, make_user):
    clerk_id, _ = make_user()
    view = get_client_view(client_conn.cursor(), clerk_id)
    assert view["status"] is None          # not started
    assert view["can_edit_connection"] is True
    assert view["connection"] is None
    assert "74.220.48.0/24" in view["requirements"]["egress_ip_ranges"]


def test_set_then_view_round_trip_masked(client_conn, make_user, kms):
    clerk_id, company_id = make_user()
    result = set_own_connection(
        client_conn.cursor(), clerk_id, GOOD_DSN, kms, resolver=_resolver
    )
    client_conn.commit()
    assert result["status"] == TenantDbStatus.PENDING
    assert result["masked_url"].startswith("postgresql://")

    # The DSN is recoverable via the admin/KMS path (proves it was actually stored
    # through the shared encrypt path) but never surfaced to the client view.
    assert load_decrypted_dsn(client_conn.cursor(), company_id, kms) == GOOD_DSN

    view = get_client_view(client_conn.cursor(), clerk_id)
    assert view["status"] == TenantDbStatus.PENDING
    assert view["can_edit_connection"] is True
    assert view["connection"]["is_live"] is False
    assert view["connection"]["masked_url"] == result["masked_url"]
    # No credential material in the client projection.
    assert not any("dsn" in k or "cipher" in k for k in view["connection"])


def test_set_rejects_malicious_dsn_and_stores_nothing(client_conn, make_user, kms):
    clerk_id, company_id = make_user()
    with pytest.raises(DsnValidationError):
        set_own_connection(
            client_conn.cursor(), clerk_id,
            "postgresql://app:p@metadata.internal:5432/db?sslmode=require",
            kms, resolver=lambda h: ["169.254.169.254"],
        )
    client_conn.rollback()
    assert get_tenant_db_record(client_conn.cursor(), company_id) is None


def test_set_frozen_once_live(client_conn, make_user, kms):
    clerk_id, company_id = make_user()
    set_own_connection(client_conn.cursor(), clerk_id, GOOD_DSN, kms, resolver=_resolver)
    byod_store.update_tenant_db_status(client_conn.cursor(), company_id, TenantDbStatus.LIVE)
    client_conn.commit()

    with pytest.raises(ConnectionFrozen):
        set_own_connection(
            client_conn.cursor(), clerk_id,
            "postgresql://app:new@db2.example.com:5432/d?sslmode=require",
            kms, resolver=_resolver,
        )
    # The LIVE view reflects the freeze.
    view = get_client_view(client_conn.cursor(), clerk_id)
    assert view["status"] == TenantDbStatus.LIVE
    assert view["can_edit_connection"] is False
    assert view["connection"]["is_live"] is True


def test_set_allowed_again_under_needs_reconnect(client_conn, make_user, kms):
    clerk_id, company_id = make_user()
    set_own_connection(client_conn.cursor(), clerk_id, GOOD_DSN, kms, resolver=_resolver)
    byod_store.update_tenant_db_status(
        client_conn.cursor(), company_id, TenantDbStatus.NEEDS_RECONNECT
    )
    client_conn.commit()

    # Re-onboarding after a password rotation is allowed and lands PENDING again.
    result = set_own_connection(
        client_conn.cursor(), clerk_id,
        "postgresql://app:rotated@db.tenant.example.com:5432/tenantdb?sslmode=require",
        kms, resolver=_resolver,
    )
    client_conn.commit()
    assert result["status"] == TenantDbStatus.PENDING
