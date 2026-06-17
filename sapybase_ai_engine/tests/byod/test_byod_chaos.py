"""Phase 8.2 test gate: chaos / graceful-degradation + auto-recovery (§16.5, §16.9).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 8.2):
    "Chaos: KMS outage, tenant DB down/read-only/recovery, password rotation,
     breaker storms. Each degrades gracefully + isolated; recovers automatically."

All pure (no Postgres), deterministic via injected clocks/fakes → engine-regression.
Each test maps to a row of the §16.9 exceptional-state matrix:

  * KMS unavailable -> serve from the decrypted-DSN cache; cold tenant fails alone;
    recovers when KMS returns (§16.5).
  * Tenant DB read-only / in recovery -> the chat_log write degrades soft (skipped),
    the answer is still served.
  * Breaker open (storm) -> every failing tenant is isolated and fast-fails, and
    each recovers automatically after the cooldown (half-open -> closed).
  * Credential rotated -> auth failure is detected (NEEDS_RECONNECT signal),
    distinct from an unreachable DB.
  * KMS master-key rotation -> old + new keys coexist, so no decrypt outage.
"""
from __future__ import annotations

import os
from contextlib import contextmanager

import pytest

import byod_crypto
import byod_dsn_cache
import byod_engine
from byod_breaker import BreakerConfig, BreakerRegistry, BreakerState
from byod_crypto import KmsUnavailable, LocalKmsProvider
from byod_engine import TenantDataError


# ── KMS outage: serve from the decrypted-DSN cache (§16.5) ───────────────────────
class _Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class _FakeControlConn:
    def cursor(self):
        return self

    def close(self):
        pass


@pytest.fixture
def kms_chaos(monkeypatch):
    """Wire byod_engine's credential resolution to a controllable fake KMS decrypt
    + an injected decrypted-DSN cache with a fake clock, validate_db_url no-op'd."""
    clk = _Clock()
    cache = byod_dsn_cache.DecryptedDsnCache(
        ttl_seconds=10.0, max_stale_seconds=100.0, max_entries=8, clock=clk
    )
    byod_dsn_cache.set_dsn_cache(cache)

    state = {"down": False, "calls": 0, "dsn": "postgresql://u:p@db.example.com/d?sslmode=require"}

    def fake_load(cur, company_id, kms):
        state["calls"] += 1
        if state["down"]:
            raise KmsUnavailable("KMS unavailable")
        return state["dsn"]

    monkeypatch.setattr(byod_engine._Deps, "control_conn_factory", lambda: _FakeControlConn())
    monkeypatch.setattr(byod_engine._Deps, "control_conn_release", lambda c: None)
    monkeypatch.setattr(byod_engine._Deps, "kms_factory", lambda: object())
    monkeypatch.setattr(byod_engine, "load_decrypted_runtime_dsn", fake_load)
    monkeypatch.setattr(byod_engine, "validate_db_url", lambda dsn: None)
    try:
        yield clk, cache, state
    finally:
        byod_dsn_cache.reset_dsn_cache()


def test_kms_outage_serves_warm_tenant_from_cache(kms_chaos):
    clk, cache, state = kms_chaos
    # Warm the cache with one good resolve.
    assert byod_engine._resolve_runtime_dsn("c1") == state["dsn"]
    # KMS goes down + the fresh window expires (so a re-decrypt is attempted).
    state["down"] = True
    clk.t += 20.0  # past ttl(10), within max_stale(100)
    calls_before = state["calls"]
    # Still served — from the cache (degraded), no raise.
    assert byod_engine._resolve_runtime_dsn("c1") == state["dsn"]
    assert state["calls"] == calls_before + 1  # it DID try KMS, then fell back


def test_kms_outage_within_ttl_is_invisible(kms_chaos):
    clk, cache, state = kms_chaos
    byod_engine._resolve_runtime_dsn("c1")  # warm
    state["down"] = True
    calls_before = state["calls"]
    # Within the TTL the cached DSN is served WITHOUT touching KMS at all.
    assert byod_engine._resolve_runtime_dsn("c1") == state["dsn"]
    assert state["calls"] == calls_before  # KMS never called → blip invisible


def test_kms_outage_cold_tenant_fails_alone(kms_chaos):
    clk, cache, state = kms_chaos
    state["down"] = True  # never warmed → nothing cached for c2
    with pytest.raises(TenantDataError):
        byod_engine._resolve_runtime_dsn("c2")


def test_kms_recovers_automatically(kms_chaos):
    clk, cache, state = kms_chaos
    byod_engine._resolve_runtime_dsn("c1")  # warm
    state["down"] = True
    clk.t += 20.0
    byod_engine._resolve_runtime_dsn("c1")  # served from cache
    # KMS comes back; after the fresh window a real decrypt succeeds again.
    state["down"] = False
    clk.t += 20.0
    assert byod_engine._resolve_runtime_dsn("c1") == state["dsn"]


def test_kms_outage_beyond_max_stale_fails(kms_chaos):
    clk, cache, state = kms_chaos
    byod_engine._resolve_runtime_dsn("c1")  # warm
    state["down"] = True
    clk.t += 200.0  # past max_stale(100) → cache entry too old to trust
    with pytest.raises(TenantDataError):
        byod_engine._resolve_runtime_dsn("c1")


# ── Tenant DB read-only / in recovery: chat_log write degrades soft (§16.9) ──────
class _ReadOnlyConn:
    def cursor(self):
        return self

    def execute(self, *a, **k):
        pass

    def commit(self):
        raise _OperationalError("cannot execute INSERT in a read-only transaction")

    def close(self):
        pass


class _OperationalError(Exception):
    pass


class _ReadOnlyRegistry:
    @contextmanager
    def get_tenant_db(self, company_id):
        yield _ReadOnlyConn()


def test_readonly_tenant_chat_log_write_degrades_soft():
    # §16.9: write fails (read-only / in recovery) -> skip the chat_log write,
    # degrade soft, never raise (the answer was already served to the user).
    ok = byod_engine.tenant_log_chat(
        "c1", "q", "a", False, False, None, None, registry=_ReadOnlyRegistry()
    )
    assert ok is False


# ── Breaker storm + automatic recovery (§16.9, rule 15) ──────────────────────────
def test_breaker_storm_isolates_each_tenant_and_auto_recovers():
    clk = _Clock()
    reg = BreakerRegistry(
        BreakerConfig(failure_threshold=2, reset_timeout_seconds=30.0, success_threshold=1),
        clock=clk,
    )
    broken = [f"broke{i}" for i in range(50)]

    # A storm: every broken tenant trips its own breaker open.
    for cid in broken:
        reg.get(cid).on_failure()
        reg.get(cid).on_failure()
    assert all(reg.state_of(cid) is BreakerState.OPEN for cid in broken)
    # A healthy tenant is unaffected by the storm (isolation, rule 15).
    assert reg.state_of("healthy") is BreakerState.CLOSED

    # After the cooldown each broken tenant probes (half-open) and recovers on a
    # successful probe — automatically, no operator action.
    clk.t += 30.0
    for cid in broken:
        assert reg.state_of(cid) is BreakerState.HALF_OPEN
        b = reg.get(cid)
        b.before_request()  # reserve the probe slot
        b.on_success()
        assert b.state is BreakerState.CLOSED


# ── Credential rotation: auth failure detected (NEEDS_RECONNECT signal, §16.5) ───
def _public_resolver(host):
    return ["8.8.8.8"]


class _AuthError(Exception):
    pgcode = "28P01"  # invalid_password


class _DownError(Exception):
    pgcode = None


def test_password_rotation_detected_as_auth_failure():
    import byod_health

    dsn = "postgresql://u:p@db.example.com/d?sslmode=require"
    # Client rotated the DB password → connect rejected with 28P01.
    with pytest.raises(byod_health.TenantAuthFailed):
        byod_health.run_health_check(
            dsn, resolver=_public_resolver, connect=lambda d: (_ for _ in ()).throw(_AuthError())
        )


def test_unreachable_is_classified_distinctly_from_auth():
    import byod_health

    dsn = "postgresql://u:p@db.example.com/d?sslmode=require"
    with pytest.raises(byod_health.TenantUnreachable):
        byod_health.run_health_check(
            dsn, resolver=_public_resolver, connect=lambda d: (_ for _ in ()).throw(_DownError())
        )


# ── KMS master-key rotation: old + new keys coexist (no outage, §16.5) ───────────
def test_kms_key_rotation_keeps_old_ciphertext_decryptable():
    cid = "11111111-1111-1111-1111-111111111111"
    dsn = "postgresql://u:p@db.example.com/d?sslmode=require"
    key_v1 = os.urandom(32)
    kms_v1 = LocalKmsProvider({"v1": key_v1}, "v1")
    enc = byod_crypto.encrypt_dsn(dsn, cid, kms_v1)
    assert enc.key_id == "v1"

    # Rotate the master key: both keys present, v2 active (mid-rollout state).
    kms_v2 = LocalKmsProvider({"v1": key_v1, "v2": os.urandom(32)}, "v2")
    # The OLD ciphertext still decrypts during rollout — no outage.
    assert byod_crypto.decrypt_dsn(enc, cid, kms_v2) == dsn
    # Re-encrypt pins it to the new active key; still decryptable.
    rotated = byod_crypto.rotate_dsn(enc, cid, kms_v2)
    assert rotated.key_id == "v2"
    assert byod_crypto.decrypt_dsn(rotated, cid, kms_v2) == dsn
