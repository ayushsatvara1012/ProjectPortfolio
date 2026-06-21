"""Phase 3.2 test gate: /api/chat engine cutover to the tenant DB (byod_engine).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 3.2):
    "Chat works on tenant DB; oversized/wrong-dim/NULL rows skipped not crash; no
     raw DB error leaks." (rules E3, E6, §16.2)

Layers:
  * Pure (no DB) — the dark routing gate (off by default → shared-DB path
    unchanged), E3 output validation (NULL/oversized/wrong-type rows skipped, not
    fatal), E6 error sanitization (raw driver text never surfaces), and the
    failure-mode mapping of tenant_connection / tenant_log_chat with a fake
    registry.
  * Functional (real Postgres) — the data-plane read AND write run through
    get_tenant_db using the **DML-only vaayu_runtime** runtime DSN: a vector
    search returns the right chunk, a chat_log row lands on the tenant DB, real
    malformed rows are filtered, and a real driver error is sanitized. Skips
    cleanly when no tenant Postgres backend is available.
"""
from __future__ import annotations

from contextlib import contextmanager
from urllib.parse import urlsplit

import psycopg2
import pytest

import byod_dataplane
import byod_engine
from byod_engine import (
    MAX_KNOWLEDGE_CONTENT_CHARS,
    MAX_URL_CHARS,
    TenantDataError,
    TenantNotProvisioned,
    sanitize_db_error,
    validate_knowledge_rows,
)
from byod_pool import CeilingExceeded, RoutingIntegrityError
from byod_breaker import BreakerOpen

from .tenant_harness import (
    KNOWLEDGE_FIXTURES,
    TENANT_COMPANY_ID,
    make_embedding,
    vector_literal,
)


# ── Fakes for the pure failure-mode tests ────────────────────────────────────────
class _FakeRegistry:
    """Stands in for TenantPoolRegistry: its get_tenant_db raises a chosen error so
    tenant_connection's sanitization can be tested with no Postgres."""

    def __init__(self, raise_exc: BaseException) -> None:
        self._raise = raise_exc

    @contextmanager
    def get_tenant_db(self, company_id):
        raise self._raise
        yield  # pragma: no cover


# ── Pure: routing gate (dark by default) ─────────────────────────────────────────
def test_routing_inactive_by_default(monkeypatch):
    monkeypatch.delenv("BYOD_ENABLED", raising=False)
    monkeypatch.delenv("BYOD_CANARY_COMPANY_IDS", raising=False)
    assert byod_engine.routing_active("company-123") is False
    assert byod_engine.routing_active(None) is False


def test_routing_active_only_when_enabled_and_canary(monkeypatch):
    # Phase 3: routing now also requires status == LIVE. Seed the routing-decision
    # cache so this stays a pure (no-DB) test; company-123 is a LIVE tenant whose
    # routing_enabled flag is still FALSE (it routes only via the env-canary fallback).
    import byod_routing_cache
    cache = byod_routing_cache.RoutingDecisionCache()
    cache.put("company-123", byod_routing_cache.RoutingDecision("LIVE", False))
    cache.put("company-xyz", byod_routing_cache.RoutingDecision("LIVE", False))
    cache.put("company-other", byod_routing_cache.RoutingDecision("LIVE", False))
    byod_routing_cache.set_routing_cache(cache)

    monkeypatch.setenv("BYOD_ENABLED", "true")
    monkeypatch.setenv("BYOD_CANARY_COMPANY_IDS", "company-123, company-xyz")
    assert byod_engine.routing_active("company-123") is True
    # LIVE but NOT a canary and routing_enabled=False → still off.
    assert byod_engine.routing_active("company-other") is False
    # Canary + LIVE but global switch off → off (master kill wins).
    monkeypatch.setenv("BYOD_ENABLED", "false")
    assert byod_engine.routing_active("company-123") is False

    byod_routing_cache.reset_routing_cache()


# ── Pure: E3 output validation ───────────────────────────────────────────────────
def test_validate_knowledge_rows_keeps_good_rows_and_shape():
    rows = [("hello world", "https://acme.test/a"), ("another", None)]
    out = validate_knowledge_rows(rows)
    assert out == [("hello world", "https://acme.test/a"), ("another", None)]


def test_validate_knowledge_rows_skips_null_empty_and_wrong_type_content():
    rows = [
        (None, "u1"),            # NULL content
        ("   ", "u2"),           # whitespace-only
        (12345, "u3"),           # wrong type
        ("good", "u4"),          # keeper
    ]
    out = validate_knowledge_rows(rows)
    assert out == [("good", "u4")]


def test_validate_knowledge_rows_skips_oversized_content():
    big = "x" * (MAX_KNOWLEDGE_CONTENT_CHARS + 1)
    out = validate_knowledge_rows([(big, "u"), ("ok", "u2")])
    assert out == [("ok", "u2")]


def test_validate_knowledge_rows_sanitizes_url():
    long_url = "h" * (MAX_URL_CHARS + 50)
    out = validate_knowledge_rows([("c1", 999), ("c2", long_url)])
    # Non-str url coerced to None; oversized url truncated; rows still kept.
    assert out[0] == ("c1", None)
    assert out[1][0] == "c2"
    assert len(out[1][1]) == MAX_URL_CHARS


def test_validate_knowledge_rows_handles_empty_and_malformed_input():
    assert validate_knowledge_rows(None) == []
    assert validate_knowledge_rows([]) == []
    # A malformed/too-short row is skipped, not fatal.
    assert validate_knowledge_rows([(), ("ok", "u")]) == [("ok", "u")]


# ── Pure: E6 error sanitization ──────────────────────────────────────────────────
def test_sanitize_passes_through_our_sanitized_errors():
    assert sanitize_db_error(TenantDataError("custom reason")) == "custom reason"
    assert "circuit open" in sanitize_db_error(BreakerOpen("x"))


def test_sanitize_never_leaks_raw_driver_text():
    # A raw driver error whose message embeds host/DSN internals.
    raw = psycopg2.OperationalError(
        'could not connect to host "secret-db.internal" port 5432 user "vaayu_runtime"'
    )
    reason = sanitize_db_error(raw)
    assert "secret-db.internal" not in reason
    assert "5432" not in reason
    assert "OperationalError" in reason  # class name is safe


def test_sanitize_pool_errors_use_class_name_only():
    assert "CeilingExceeded" in sanitize_db_error(CeilingExceeded("ceiling reached for tenant abc"))
    assert "RoutingIntegrityError" in sanitize_db_error(RoutingIntegrityError("mismatch"))


# ── Pure: tenant_connection / tenant_log_chat failure mapping (fake registry) ────
def test_tenant_connection_sanitizes_raw_driver_error():
    reg = _FakeRegistry(psycopg2.OperationalError('host "db.internal" down'))
    with pytest.raises(TenantDataError) as ei:
        with byod_engine.tenant_connection("c1", registry=reg):
            pass
    assert "db.internal" not in ei.value.reason


def test_tenant_connection_maps_breaker_open():
    reg = _FakeRegistry(BreakerOpen("open"))
    with pytest.raises(TenantDataError) as ei:
        with byod_engine.tenant_connection("c1", registry=reg):
            pass
    assert "unavailable" in ei.value.reason


def test_tenant_log_chat_degrades_soft_on_failure():
    reg = _FakeRegistry(psycopg2.OperationalError('host "db.internal" down'))
    # Must NOT raise — a background analytics write degrades soft (§16.9).
    ok = byod_engine.tenant_log_chat("c1", "q", "a", False, False, None, None, registry=reg)
    assert ok is False


def test_resolve_runtime_dsn_unprovisioned_raises_sanitized(monkeypatch):
    # No control-plane deps configured-with-data → TenantNotProvisioned (a
    # sanitized TenantDataError); proves the not-provisioned path is safe.
    class _Cur:
        def cursor(self):
            return self

        def close(self):
            pass

    monkeypatch.setattr(byod_engine._Deps, "control_conn_factory", lambda: _Cur())
    monkeypatch.setattr(byod_engine._Deps, "control_conn_release", lambda c: None)
    monkeypatch.setattr(byod_engine._Deps, "kms_factory", lambda: object())
    monkeypatch.setattr(byod_engine, "load_decrypted_runtime_dsn", lambda cur, cid, kms: None)
    with pytest.raises(TenantNotProvisioned):
        byod_engine._resolve_runtime_dsn("c1")


# ── Functional: real data-plane read + write via the vaayu_runtime DSN ───────────
def _runtime_registry(tenant_db_dsn: str):
    """Provision the DML-only vaayu_runtime role on the seeded tenant DB and return
    a registry whose dsn_provider yields the runtime DSN (the exact credential the
    engine request path uses in production)."""
    dbname = urlsplit(tenant_db_dsn).path.lstrip("/")
    admin = psycopg2.connect(tenant_db_dsn)
    admin.autocommit = True
    try:
        with admin.cursor() as cur:
            byod_dataplane.create_runtime_role(cur, password="rt_engine_pw", dbname=dbname)
    finally:
        admin.close()
    runtime_dsn = byod_dataplane.build_runtime_dsn(tenant_db_dsn, "rt_engine_pw")
    return byod_engine.build_registry(lambda _cid: runtime_dsn)


def test_tenant_rag_read_runs_on_tenant_db(tenant_db_dsn):
    """THE GATE (read): a vector search through get_tenant_db / vaayu_runtime
    returns the right chunk from the tenant's OWN database."""
    reg = _runtime_registry(tenant_db_dsn)
    try:
        pricing = next(f for f in KNOWLEDGE_FIXTURES if f.url.endswith("/pricing"))
        qvec = vector_literal(make_embedding(pricing.seed))
        with byod_engine.tenant_connection(TENANT_COMPANY_ID, registry=reg) as conn:
            reg.assert_tenant(conn, TENANT_COMPANY_ID)  # E5 re-assert on query path
            cur = conn.cursor()
            cur.execute(
                """
                SELECT content, url FROM company_knowledge
                WHERE company_id = %s AND chunk_type = 'child'
                ORDER BY embedding <=> %s::vector
                LIMIT 1
                """,
                (TENANT_COMPANY_ID, qvec),
            )
            rows = validate_knowledge_rows(cur.fetchall())
            cur.close()
        assert rows and rows[0][1] == pricing.url
    finally:
        reg.close_all()


def test_tenant_chat_log_write_lands_on_tenant_db(tenant_db_dsn):
    """THE GATE (write): tenant_log_chat persists a chat_logs row on the tenant DB
    via the DML-only runtime role."""
    reg = _runtime_registry(tenant_db_dsn)
    try:
        ok = byod_engine.tenant_log_chat(
            TENANT_COMPANY_ID, "what is pricing?", "Our Pro plan is $149/mo.",
            False, False, None, 0.9, registry=reg,
        )
        assert ok is True
    finally:
        reg.close_all()

    # Verify independently (fresh connection as the owner).
    conn = psycopg2.connect(tenant_db_dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_query, bot_response, confidence FROM chat_logs WHERE company_id = %s",
                (TENANT_COMPANY_ID,),
            )
            row = cur.fetchone()
        assert row is not None
        assert row[0] == "what is pricing?"
        assert float(row[2]) == pytest.approx(0.9)
    finally:
        conn.close()


def test_malformed_tenant_rows_skipped_not_crash(tenant_db_dsn):
    """E3 end-to-end: a NULL-content and an oversized-content row inserted into the
    tenant DB are filtered out; the good rows survive and nothing crashes."""
    other_company = "00000000-0000-4000-8000-0000000000ff"
    conn = psycopg2.connect(tenant_db_dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO company_knowledge (company_id, url, content, chunk_type) "
                "VALUES (%s, %s, NULL, 'child')",
                (other_company, "https://acme.test/null"),
            )
            cur.execute(
                "INSERT INTO company_knowledge (company_id, url, content, chunk_type) "
                "VALUES (%s, %s, %s, 'child')",
                (other_company, "https://acme.test/big", "y" * (MAX_KNOWLEDGE_CONTENT_CHARS + 10)),
            )
            cur.execute(
                "INSERT INTO company_knowledge (company_id, url, content, chunk_type) "
                "VALUES (%s, %s, %s, 'child')",
                (other_company, "https://acme.test/good", "a clean answer chunk"),
            )
    finally:
        conn.close()

    reg = _runtime_registry(tenant_db_dsn)
    try:
        with byod_engine.tenant_connection(other_company, registry=reg) as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT content, url FROM company_knowledge WHERE company_id = %s",
                (other_company,),
            )
            cleaned = validate_knowledge_rows(cur.fetchall())
            cur.close()
    finally:
        reg.close_all()

    urls = {u for _c, u in cleaned}
    assert urls == {"https://acme.test/good"}  # NULL + oversized dropped


def test_real_driver_error_is_sanitized(tenant_db_dsn):
    """E6 end-to-end: a real Postgres error (bad column) surfaces as a sanitized
    TenantDataError — no raw SQL/schema/driver text leaks."""
    reg = _runtime_registry(tenant_db_dsn)
    try:
        with pytest.raises(TenantDataError) as ei:
            with byod_engine.tenant_connection(TENANT_COMPANY_ID, registry=reg) as conn:
                cur = conn.cursor()
                cur.execute("SELECT this_column_does_not_exist FROM company_knowledge LIMIT 1")
                cur.fetchall()
        reason = ei.value.reason
        assert "this_column_does_not_exist" not in reason
        assert "company_knowledge" not in reason
    finally:
        reg.close_all()
