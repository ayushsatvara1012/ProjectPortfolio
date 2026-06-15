"""Phase 2.1 test gate: super-admin BYOD config.

Exit criteria (RFC docs/rfc-byod.md §13, Phase 2.1):
    "Create-from-template; URL masked; override persists & resolves." (§3.1)

Pure tests (template seed, DSN Test, masking) run everywhere. The config round-
trip tests (enroll → view → set-connection → override) run against an ephemeral
control-plane Postgres and skip cleanly when no backend is available.
"""
from __future__ import annotations

import json
import uuid

import psycopg2
import pytest

import byod_admin
from byod_admin import (
    CompanyNotFound,
    MASKED_URL,
    UserNotFound,
    enroll_in_byod,
    get_admin_view,
    seed_byod_config,
    set_connection,
)
from byod_admin import test_dsn as run_test_dsn  # aliased: bare `test_dsn` would be collected as a test
import os

from byod_crypto import LocalKmsProvider, load_decrypted_dsn
from byod_dsn import DsnValidationError
from byod_store import CONTROL_PLANE_SCHEMA_SQL, TenantDbStatus, get_tenant_db_record
from config import CUSTOM_PLAN_FEATURE_KEYS

GOOD_DSN = "postgresql://app:s3cr3t@db.tenant.example.com:5432/tenantdb?sslmode=require"


def _resolver(host):  # public IP for any host → SSRF check passes
    return ["8.8.8.8"]


# ── Pure: template seed (create-from-template) ────────────────────────────────
def test_seed_is_all_features_on_byod_template():
    cfg = seed_byod_config()
    assert cfg["byo_database"] is True
    assert cfg["plan_name"] == "BYOD"
    assert cfg["monthly_price_usd"] == 149
    assert cfg["gemini_model"] == "gemini-2.5-pro"
    assert cfg["max_messages"] == 50000
    assert all(cfg[k] for k in CUSTOM_PLAN_FEATURE_KEYS)


# ── Pure: Test button + masking ───────────────────────────────────────────────
def test_test_dsn_accepts_valid():
    result = run_test_dsn(GOOD_DSN, resolver=_resolver)
    assert result["ok"] is True
    assert result["host"] == "db.tenant.example.com"
    assert result["sslmode"] == "require"
    assert result["masked_url"] == MASKED_URL


@pytest.mark.parametrize(
    "dsn",
    [
        "postgresql://app:pw@10.0.0.5/db?sslmode=require",            # private IP
        "postgresql://app:pw@db.example.com/db?sslmode=disable",      # no TLS
        "postgresql://app:pw@db.example.com/db?options=-cfoo&sslmode=require",  # bad param
        "mysql://app:pw@db.example.com/db",                            # wrong scheme
    ],
)
def test_test_dsn_rejects_malicious(dsn):
    with pytest.raises(DsnValidationError):
        run_test_dsn(dsn, resolver=_resolver)


def test_masked_url_has_no_secrets():
    assert "s3cr3t" not in MASKED_URL
    assert "tenant" not in MASKED_URL
    assert MASKED_URL.startswith("postgresql://")


# ── Control-plane round-trip fixtures ─────────────────────────────────────────
@pytest.fixture
def admin_conn(control_plane_db_dsn: str):
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
def make_user(admin_conn):
    """Factory: create a user (+ optional company); returns (clerk_id, company_id)."""

    def _create(with_company: bool = True):
        clerk_id = f"user_{uuid.uuid4().hex[:12]}"
        company_id = None
        with admin_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (clerk_id, tier) VALUES (%s, 'FREE') RETURNING id",
                (clerk_id,),
            )
            user_id = cur.fetchone()[0]
            if with_company:
                company_id = str(uuid.uuid4())
                cur.execute(
                    "INSERT INTO companies (id, user_id) VALUES (%s, %s)",
                    (company_id, user_id),
                )
        admin_conn.commit()
        return clerk_id, company_id

    return _create


@pytest.fixture
def kms():
    return LocalKmsProvider({"k1": os.urandom(32)}, active_key_id="k1")


# ── Create-from-template ──────────────────────────────────────────────────────
def test_enroll_creates_from_template(admin_conn, make_user):
    clerk_id, _ = make_user()
    cfg = enroll_in_byod(admin_conn.cursor(), clerk_id)
    admin_conn.commit()
    assert cfg["byo_database"] is True

    view = get_admin_view(admin_conn.cursor(), clerk_id)
    assert view["tier"] == "CUSTOM"
    assert view["byo_database"] is True
    assert view["overrides"]["plan_name"] == "BYOD"
    assert view["connection"] is None  # no DSN yet


def test_enroll_unknown_user_raises(admin_conn):
    with pytest.raises(UserNotFound):
        enroll_in_byod(admin_conn.cursor(), "user_does_not_exist")


# ── URL masked + connection persists ──────────────────────────────────────────
def test_set_connection_stores_masked(admin_conn, make_user, kms):
    clerk_id, company_id = make_user()
    enroll_in_byod(admin_conn.cursor(), clerk_id)
    admin_conn.commit()

    result = set_connection(admin_conn.cursor(), clerk_id, GOOD_DSN, kms, resolver=_resolver)
    admin_conn.commit()
    assert result["status"] == TenantDbStatus.PENDING
    assert result["masked_url"] == MASKED_URL

    # The record is stored ciphertext-only; the plaintext DSN is never in it.
    record = get_tenant_db_record(admin_conn.cursor(), company_id)
    assert record is not None
    assert record.status == TenantDbStatus.PENDING
    assert b"s3cr3t" not in record.dsn_ciphertext

    # View shows the masked URL, never the real DSN.
    view = get_admin_view(admin_conn.cursor(), clerk_id)
    assert view["connection"]["masked_url"] == MASKED_URL
    assert view["connection"]["status"] == TenantDbStatus.PENDING
    assert "s3cr3t" not in json.dumps(view)

    # And it actually decrypts back to the original (proves it was stored right).
    assert load_decrypted_dsn(admin_conn.cursor(), company_id, kms) == GOOD_DSN


def test_set_connection_rejects_malicious_and_stores_nothing(admin_conn, make_user, kms):
    clerk_id, company_id = make_user()
    with pytest.raises(DsnValidationError):
        set_connection(
            admin_conn.cursor(), clerk_id,
            "postgresql://app:pw@169.254.169.254/db?sslmode=require",  # metadata IP
            kms, resolver=lambda h: ["169.254.169.254"],
        )
    admin_conn.rollback()
    assert get_tenant_db_record(admin_conn.cursor(), company_id) is None


def test_set_connection_no_company_raises(admin_conn, make_user, kms):
    clerk_id, _ = make_user(with_company=False)
    with pytest.raises(CompanyNotFound):
        set_connection(admin_conn.cursor(), clerk_id, GOOD_DSN, kms, resolver=_resolver)


# ── Override persists & resolves ──────────────────────────────────────────────
def test_override_persists_and_resolves(admin_conn, make_user):
    clerk_id, _ = make_user()
    enroll_in_byod(admin_conn.cursor(), clerk_id)
    admin_conn.commit()

    # Simulate a super-admin override of a limit (what /custom-plan/override does).
    with admin_conn.cursor() as cur:
        cur.execute("SELECT custom_plan_config FROM users WHERE clerk_id = %s", (clerk_id,))
        cfg = cur.fetchone()[0]
        cfg["max_messages"] = 12345
        cur.execute(
            "UPDATE users SET custom_plan_config = %s WHERE clerk_id = %s",
            (json.dumps(cfg), clerk_id),
        )
    admin_conn.commit()

    view = get_admin_view(admin_conn.cursor(), clerk_id)
    assert view["overrides"]["max_messages"] == 12345  # persisted

    # Resolves through the entitlement engine exactly like CUSTOM does.
    from main import get_plan

    plan = get_plan("CUSTOM", custom_plan_config=view["overrides"])
    assert plan["messages"] == 12345
    assert plan["byo_database"] is True
