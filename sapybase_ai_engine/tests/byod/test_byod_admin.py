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
import byod_probe
from byod_admin import (
    CompanyNotFound,
    ConnectionNotConfigured,
    MASKED_URL,
    UserNotFound,
    enroll_in_byod,
    get_admin_view,
    provision,
    seed_byod_config,
    set_connection,
)
from byod_admin import test_dsn as run_test_dsn  # aliased: bare `test_dsn` would be collected as a test
import os

from byod_crypto import LocalKmsProvider, load_decrypted_dsn, load_decrypted_runtime_dsn
from byod_dsn import DsnValidationError
from byod_store import CONTROL_PLANE_SCHEMA_SQL, TenantDbStatus, get_tenant_db_record
from config import CUSTOM_PLAN_FEATURE_KEYS

from .test_byod_probe import FakeDbError, make_fake_connector

GOOD_DSN = "postgresql://app:s3cr3t@db.tenant.example.com:5432/tenantdb?sslmode=require"


def _resolver(host):  # public IP for any host → SSRF check passes
    return ["8.8.8.8"]


def _healthy_connector():
    """A fake tenant connection reporting a supported pgvector (for the probe)."""
    return make_fake_connector(available_row=("0.7.0", "0.7.0"), extversion="0.7.0")


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
    # Phase 2.2: Test now opens a real connection and asserts pgvector. The fake
    # connector stands in for a healthy tenant DB.
    result = run_test_dsn(GOOD_DSN, resolver=_resolver, connect=_healthy_connector())
    assert result["ok"] is True
    assert result["host"] == "db.tenant.example.com"
    assert result["sslmode"] == "require"
    assert result["masked_url"] == MASKED_URL
    assert result["pgvector_version"] == "0.7.0"
    assert result["embedding_dimensions"] == 768


def test_test_dsn_rejects_db_without_pgvector():
    connector = make_fake_connector(available_row=None)
    with pytest.raises(byod_probe.PgvectorUnavailable):
        run_test_dsn(GOOD_DSN, resolver=_resolver, connect=connector)


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


# ── Provisioning: real-connect probe + idempotent advisory lock (Phase 2.2) ───
def _enroll_and_connect(admin_conn, make_user, kms):
    """Helper: a user enrolled in BYOD with a stored PENDING DSN."""
    clerk_id, company_id = make_user()
    enroll_in_byod(admin_conn.cursor(), clerk_id)
    admin_conn.commit()
    set_connection(admin_conn.cursor(), clerk_id, GOOD_DSN, kms, resolver=_resolver)
    admin_conn.commit()
    return clerk_id, company_id


def test_provision_runs_full_pipeline_to_live(admin_conn, make_user, kms):
    clerk_id, company_id = _enroll_and_connect(admin_conn, make_user, kms)
    connector = _healthy_connector()

    result = provision(admin_conn.cursor(), clerk_id, kms, resolver=_resolver, connect=connector)
    admin_conn.commit()

    assert result["status"] == TenantDbStatus.LIVE
    assert result["idempotent"] is False
    assert result["pgvector_version"] == "0.7.0"
    assert result["schema_version"] == "0001"  # data-plane version recorded
    assert "s3cr3t" not in json.dumps(result)  # rule 7 — no DSN echoed

    record = get_tenant_db_record(admin_conn.cursor(), company_id)
    assert record.status == TenantDbStatus.LIVE
    assert record.schema_version == "0001"
    assert record.runtime_dsn_ciphertext is not None  # runtime DSN stored

    # The runtime DSN decrypts to a vaayu_runtime credential — NOT the migrate one.
    runtime_dsn = load_decrypted_runtime_dsn(admin_conn.cursor(), company_id, kms)
    assert runtime_dsn.startswith("postgresql://vaayu_runtime:")
    assert "sslmode=require" in runtime_dsn
    assert "s3cr3t" not in runtime_dsn  # not the migrate password


def test_provision_is_idempotent_on_double_submit(admin_conn, make_user, kms):
    """§16.6: a double-click must not re-run the pipeline or corrupt state."""
    clerk_id, _ = _enroll_and_connect(admin_conn, make_user, kms)
    connector = _healthy_connector()

    first = provision(admin_conn.cursor(), clerk_id, kms, resolver=_resolver, connect=connector)
    admin_conn.commit()
    connections_after_first = len(connector.created)  # probe + apply
    second = provision(admin_conn.cursor(), clerk_id, kms, resolver=_resolver, connect=connector)
    admin_conn.commit()

    assert first["idempotent"] is False
    assert second["idempotent"] is True
    assert second["status"] == TenantDbStatus.LIVE
    # The LIVE short-circuit opened NO new tenant connections (no re-probe/re-apply).
    assert len(connector.created) == connections_after_first


def test_provision_health_failure_leaves_clean_error_state(admin_conn, make_user, kms):
    """§10 / Phase 2.4 gate: a failed health probe → ERROR with NO partial state —
    not LIVE, no runtime DSN persisted, no schema version recorded."""
    import byod_health

    clerk_id, company_id = _enroll_and_connect(admin_conn, make_user, kms)
    # Probe + schema/role apply succeed; only the health (data-plane) query fails.
    connector = make_fake_connector(health_query_error=FakeDbError("no table", pgcode="42P01"))

    with pytest.raises(byod_health.DataPlaneUnavailable):
        provision(admin_conn.cursor(), clerk_id, kms, resolver=_resolver, connect=connector)
    admin_conn.commit()  # the endpoint persists the ERROR transition

    record = get_tenant_db_record(admin_conn.cursor(), company_id)
    assert record.status == TenantDbStatus.ERROR
    assert record.runtime_dsn_ciphertext is None  # not stored — no partial state
    assert record.schema_version is None           # version not recorded


def test_check_health_recovers_and_reports_live(admin_conn, make_user, kms):
    clerk_id, company_id = _enroll_and_connect(admin_conn, make_user, kms)
    provision(admin_conn.cursor(), clerk_id, kms, resolver=_resolver, connect=_healthy_connector())
    admin_conn.commit()

    result = byod_admin.check_health(
        admin_conn.cursor(), clerk_id, kms, resolver=_resolver, connect=_healthy_connector()
    )
    admin_conn.commit()
    assert result["healthy"] is True
    assert result["status"] == TenantDbStatus.LIVE


def test_check_health_auth_failure_marks_needs_reconnect(admin_conn, make_user, kms):
    import byod_health

    clerk_id, company_id = _enroll_and_connect(admin_conn, make_user, kms)
    provision(admin_conn.cursor(), clerk_id, kms, resolver=_resolver, connect=_healthy_connector())
    admin_conn.commit()

    # Client rotated their DB password → runtime connect now auth-fails (§16.5).
    def auth_fail(dsn):
        raise FakeDbError("auth", pgcode="28P01")

    with pytest.raises(byod_health.TenantAuthFailed):
        byod_admin.check_health(admin_conn.cursor(), clerk_id, kms, resolver=_resolver, connect=auth_fail)
    admin_conn.commit()

    record = get_tenant_db_record(admin_conn.cursor(), company_id)
    assert record.status == TenantDbStatus.NEEDS_RECONNECT


def test_check_health_unprovisioned_raises(admin_conn, make_user, kms):
    clerk_id, _ = make_user()
    enroll_in_byod(admin_conn.cursor(), clerk_id)
    admin_conn.commit()
    # No runtime DSN stored yet (never provisioned).
    with pytest.raises(ConnectionNotConfigured):
        byod_admin.check_health(admin_conn.cursor(), clerk_id, kms, resolver=_resolver,
                                connect=_healthy_connector())


def test_provision_rejects_old_pgvector_and_marks_error(admin_conn, make_user, kms):
    clerk_id, company_id = _enroll_and_connect(admin_conn, make_user, kms)
    connector = make_fake_connector(available_row=("0.4.0", "0.4.0"), extversion="0.4.0")

    with pytest.raises(byod_probe.PgvectorVersionTooOld):
        provision(admin_conn.cursor(), clerk_id, kms, resolver=_resolver, connect=connector)
    admin_conn.commit()  # the endpoint persists the ERROR transition

    record = get_tenant_db_record(admin_conn.cursor(), company_id)
    assert record.status == TenantDbStatus.ERROR


def test_provision_without_connection_raises(admin_conn, make_user, kms):
    clerk_id, _ = make_user()
    enroll_in_byod(admin_conn.cursor(), clerk_id)
    admin_conn.commit()
    with pytest.raises(ConnectionNotConfigured):
        provision(admin_conn.cursor(), clerk_id, kms, resolver=_resolver, connect=_healthy_connector())


def test_provision_no_company_raises(admin_conn, make_user, kms):
    clerk_id, _ = make_user(with_company=False)
    with pytest.raises(CompanyNotFound):
        provision(admin_conn.cursor(), clerk_id, kms, resolver=_resolver)


def test_provision_advisory_lock_serializes_per_tenant(admin_conn, control_plane_db_dsn, make_user):
    """The provisioning advisory lock blocks a concurrent provision of the SAME
    tenant, while a different tenant's lock stays free (§16.6 serialization)."""
    _, company_id = make_user()
    _, other_company_id = make_user()

    c1 = psycopg2.connect(control_plane_db_dsn)
    c2 = psycopg2.connect(control_plane_db_dsn)
    try:
        # c1 holds the lock for company_id (transaction left open → lock held).
        with c1.cursor() as cur1:
            byod_admin._acquire_provision_lock(cur1, company_id)

            # c2 cannot take the same tenant's lock within the timeout.
            with c2.cursor() as cur2:
                cur2.execute("SET lock_timeout = '300ms'")
                with pytest.raises(psycopg2.errors.LockNotAvailable):
                    byod_admin._acquire_provision_lock(cur2, company_id)
            c2.rollback()

            # …but a DIFFERENT tenant's lock is free (no false serialization).
            with c2.cursor() as cur2:
                cur2.execute("SET lock_timeout = '300ms'")
                byod_admin._acquire_provision_lock(cur2, other_company_id)
            c2.rollback()

        c1.commit()  # releases company_id's lock

        # Now c2 can acquire company_id's lock.
        with c2.cursor() as cur2:
            cur2.execute("SET lock_timeout = '300ms'")
            byod_admin._acquire_provision_lock(cur2, company_id)
        c2.commit()
    finally:
        c1.close()
        c2.close()
