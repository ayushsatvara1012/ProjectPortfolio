"""Phase 8.3 test gate: security pen-test matrix (DSN/SSRF, routing, role, errors).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 8.3):
    "Security test matrix: pen-test DSN/SSRF/role/routing. No cross-tenant leakage,
     no error leakage, runtime role can't escalate." (rules E4, E5, E6)

The defenses were built across Phase 1.4 (DSN allowlist + SSRF, E4), 1.5
(connection routing tag, E5), 2.3 (DML-only vaayu_runtime, §5.4) and 3.2 (error
sanitization, E6). This sub-phase is the consolidated ADVERSARIAL matrix that
attacks each surface:

  * E4 — a malicious DSN of every shape (private/loopback/metadata IP, DNS
    rebinding, DSN-param injection, plaintext) is rejected; no password leaks into
    the rejection message.
  * E5 — a DSN ciphertext is bound to its tenant (cross-tenant decrypt fails), and a
    connection handed to the wrong tenant aborts instead of serving.
  * E6 — raw driver errors carrying host/IP/DSN/password are sanitized to a class
    name before they could reach a log or the client.
  * role — connected AS vaayu_runtime, every privilege-escalation attempt (DDL,
    role creation, reading password hashes, SET ROLE, server-side program exec) is
    denied while ordinary DML still works.

The first three layers are pure (no DB); the role-escalation gate needs Postgres
and skips cleanly when no backend is available.
"""
from __future__ import annotations

from urllib.parse import urlsplit, urlunsplit

import psycopg2
import pytest

import byod_crypto
import byod_dataplane
import byod_engine
from byod_crypto import LocalKmsProvider
from byod_dsn import DsnValidationError, validate_db_url
from byod_dataplane import RUNTIME_ROLE_NAME
from byod_pool import PoolConfig, RoutingIntegrityError, TenantPoolRegistry


_PW = "S3cretPass_do_not_leak"


def _resolver(mapping):
    """A DNS resolver stub: hostname -> [ips]; IP literals resolve to themselves."""
    def resolve(host):
        return mapping.get(host, [host])
    return resolve


# ── E4: DSN / SSRF allowlist (pure) ──────────────────────────────────────────────
@pytest.mark.parametrize(
    "dsn, mapping",
    [
        # RFC-1918 private address.
        (f"postgresql://u:{_PW}@10.0.0.5/d?sslmode=require", {}),
        # Loopback.
        (f"postgresql://u:{_PW}@127.0.0.1/d?sslmode=require", {}),
        # Cloud metadata / link-local.
        (f"postgresql://u:{_PW}@169.254.169.254/d?sslmode=require", {}),
        # DNS rebinding: public name resolves to a private IP.
        (f"postgresql://u:{_PW}@evil.example.com/d?sslmode=require",
         {"evil.example.com": ["10.1.2.3"]}),
        # DSN-parameter injection (options=).
        (f"postgresql://u:{_PW}@db.example.com/d?sslmode=require&options=-csearch_path%3Devil",
         {"db.example.com": ["93.184.216.34"]}),
        # DSN-parameter injection (sslrootcert=).
        (f"postgresql://u:{_PW}@db.example.com/d?sslmode=require&sslrootcert=/etc/x",
         {"db.example.com": ["93.184.216.34"]}),
        # Plaintext (TLS disabled).
        (f"postgresql://u:{_PW}@db.example.com/d?sslmode=disable",
         {"db.example.com": ["93.184.216.34"]}),
        # TLS not specified at all.
        (f"postgresql://u:{_PW}@db.example.com/d",
         {"db.example.com": ["93.184.216.34"]}),
        # libpq key-value form (not a URI) — wrong shape.
        (f"host=db.example.com user=u password={_PW} options=-cx", {}),
    ],
)
def test_malicious_dsns_are_rejected_without_leaking_password(dsn, mapping):
    with pytest.raises(DsnValidationError) as ei:
        validate_db_url(dsn, resolver=_resolver(mapping))
    assert _PW not in str(ei.value)  # rule 7: never echo the credential


def test_valid_dsn_accepted():
    validated = validate_db_url(
        f"postgresql://u:{_PW}@db.example.com/d?sslmode=require",
        resolver=_resolver({"db.example.com": ["93.184.216.34"]}),
    )
    assert validated.host == "db.example.com"


# ── E5: cross-tenant isolation (pure) ────────────────────────────────────────────
def test_dsn_ciphertext_is_bound_to_its_tenant():
    """A runtime DSN encrypted for company A cannot be decrypted as company B
    (company_id is bound as AEAD additional data) — no cross-tenant credential
    leakage even if the rows were swapped."""
    kms = LocalKmsProvider({"v1": b"k" * 32}, "v1")
    company_a = "11111111-1111-1111-1111-111111111111"
    company_b = "22222222-2222-2222-2222-222222222222"
    dsn = f"postgresql://u:{_PW}@db.example.com/d?sslmode=require"
    enc = byod_crypto.encrypt_dsn(dsn, company_a, kms)

    assert byod_crypto.decrypt_dsn(enc, company_a, kms) == dsn  # right tenant ok
    with pytest.raises(byod_crypto.CryptoError):
        byod_crypto.decrypt_dsn(enc, company_b, kms)  # wrong tenant → fails closed


def test_connection_tag_mismatch_aborts_not_serves():
    """A connection checked out for tenant A, asserted against tenant B, aborts
    (RoutingIntegrityError) — the engine never serves one tenant's connection for
    another's request (E5)."""
    class _Conn:  # weakref-able (the registry tags connections in a WeakKeyDictionary)
        pass

    def factory(dsn, minconn, maxconn):
        class _P:
            def getconn(self):
                return _Conn()
            def putconn(self, c, close=False):
                pass
            def closeall(self):
                pass
        return _P()

    reg = TenantPoolRegistry(
        PoolConfig(), pool_factory=factory, dsn_provider=lambda cid: f"dsn://{cid}"
    )
    with reg.get_tenant_db("A") as conn:
        reg.assert_tenant(conn, "A")  # correct tenant: fine
        with pytest.raises(RoutingIntegrityError):
            reg.assert_tenant(conn, "B")  # cross-tenant: abort


# ── E6: error sanitization (pure) ────────────────────────────────────────────────
def test_raw_driver_errors_are_sanitized():
    """Raw driver errors carrying host/IP/DSN/password never survive sanitization."""
    raw = psycopg2.OperationalError(
        'connection to server at "db.internal" (10.0.0.5), port 5432 failed: '
        'FATAL: password authentication failed for user "vaayu_runtime"; '
        "dsn=postgresql://vaayu_runtime:hunter2@db.internal/tenant"
    )
    reason = byod_engine.sanitize_db_error(raw)
    for secret in ("db.internal", "10.0.0.5", "hunter2", "password", "postgresql://"):
        assert secret not in reason
    assert "OperationalError" in reason  # only the class name is safe to surface

    # And the wrapper exception carries only the sanitized reason.
    wrapped = byod_engine.TenantDataError(reason)
    assert "db.internal" not in str(wrapped) and "hunter2" not in str(wrapped)


# ── runtime role cannot escalate (real Postgres) ─────────────────────────────────
def _runtime_dsn(base_dsn: str, password: str) -> str:
    parts = urlsplit(base_dsn)
    netloc = f"{RUNTIME_ROLE_NAME}:{password}@{parts.hostname}"
    if parts.port:
        netloc += f":{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


_ESCALATION_ATTEMPTS = [
    "CREATE TABLE evil_escalation (id int)",          # no CREATE on schema public
    "DROP TABLE company_knowledge",                   # not the owner
    "TRUNCATE chat_logs",                             # not the owner
    "ALTER TABLE lead_capture ADD COLUMN evil int",   # not the owner
    "CREATE ROLE hacker SUPERUSER LOGIN",             # cannot create roles
    "SELECT rolname, rolpassword FROM pg_authid",     # cannot read password hashes
    "SET ROLE postgres",                              # cannot become superuser
    "COPY (SELECT 1) TO PROGRAM 'echo pwned'",        # cannot run server programs
]


def test_runtime_role_cannot_escalate(control_plane_db_dsn):
    """THE GATE: connected AS vaayu_runtime, every escalation attempt is denied,
    while ordinary DML still works (least privilege, §5.4 / E5)."""
    password = "rt_sec_pw_123"
    dbname = urlsplit(control_plane_db_dsn).path.lstrip("/")

    owner = psycopg2.connect(control_plane_db_dsn)
    owner.autocommit = True
    try:
        with owner.cursor() as cur:
            byod_dataplane.apply_data_plane_schema(cur)
            byod_dataplane.create_runtime_role(cur, password=password, dbname=dbname)
    finally:
        owner.close()

    rconn = psycopg2.connect(_runtime_dsn(control_plane_db_dsn, password))
    rconn.autocommit = True  # each attempt is its own txn; an error never wedges the next
    try:
        for stmt in _ESCALATION_ATTEMPTS:
            with rconn.cursor() as cur:
                with pytest.raises(psycopg2.Error):
                    cur.execute(stmt)

        # The role is still functional for its intended DML.
        with rconn.cursor() as cur:
            cur.execute(
                "INSERT INTO chat_logs (company_id, user_query, bot_response) "
                "VALUES (gen_random_uuid(), 'q', 'a')"
            )
            cur.execute("SELECT count(*) FROM chat_logs")
            assert cur.fetchone()[0] >= 1
    finally:
        rconn.close()
