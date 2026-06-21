"""Phase 3 gate: the DB-driven routing rule (byod_engine.routing_active).

No database — the control-plane read is faked, and the routing-decision cache is
the seam used to drive the truth table. Covers:
  * the full truth table (global kill × status × routing_enabled × env-canary),
  * the backwards-compat env-canary OR fallback (the existing canary keeps routing
    while routing_enabled is still FALSE),
  * the cache-miss control-plane read + negative caching,
  * fail-safe behaviour (control plane down → not routed, never fail-open),
  * explicit invalidation making a flip visible immediately.
"""
from __future__ import annotations

import pytest

import byod_engine
import byod_routing_cache
from byod_routing_cache import RoutingDecision, RoutingDecisionCache
from byod_store import TenantDbStatus

CID = "11111111-1111-4111-8111-111111111111"


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    """Fresh cache + no env + no control-plane deps per test."""
    monkeypatch.delenv("BYOD_ENABLED", raising=False)
    monkeypatch.delenv("BYOD_CANARY_COMPANY_IDS", raising=False)
    byod_routing_cache.set_routing_cache(RoutingDecisionCache())
    monkeypatch.setattr(byod_engine._Deps, "control_conn_factory", None)
    monkeypatch.setattr(byod_engine._Deps, "control_conn_release", None)
    yield
    byod_routing_cache.reset_routing_cache()


def _seed(status, routing_enabled):
    byod_routing_cache.get_routing_cache().put(CID, RoutingDecision(status, routing_enabled))


# ── Truth table (global on unless noted) ─────────────────────────────────────────
def test_live_and_routing_enabled_routes(monkeypatch):
    monkeypatch.setenv("BYOD_ENABLED", "true")
    _seed(TenantDbStatus.LIVE, True)
    assert byod_engine.routing_active(CID) is True


def test_live_but_not_enabled_and_not_canary_does_not_route(monkeypatch):
    monkeypatch.setenv("BYOD_ENABLED", "true")
    _seed(TenantDbStatus.LIVE, False)
    assert byod_engine.routing_active(CID) is False


@pytest.mark.parametrize("status", [
    TenantDbStatus.PENDING, TenantDbStatus.PROVISIONING,
    TenantDbStatus.NEEDS_RECONNECT, TenantDbStatus.DISABLED, TenantDbStatus.ERROR,
])
def test_non_live_never_routes_even_if_enabled(monkeypatch, status):
    monkeypatch.setenv("BYOD_ENABLED", "true")
    _seed(status, True)
    assert byod_engine.routing_active(CID) is False


def test_no_row_does_not_route(monkeypatch):
    monkeypatch.setenv("BYOD_ENABLED", "true")
    _seed(None, False)  # cached negative
    assert byod_engine.routing_active(CID) is False


def test_global_kill_overrides_db_flag(monkeypatch):
    # The master env kill switch wins over a LIVE + enabled row.
    monkeypatch.setenv("BYOD_ENABLED", "false")
    _seed(TenantDbStatus.LIVE, True)
    assert byod_engine.routing_active(CID) is False


def test_empty_company_id_is_off(monkeypatch):
    monkeypatch.setenv("BYOD_ENABLED", "true")
    assert byod_engine.routing_active(None) is False
    assert byod_engine.routing_active("") is False


# ── Backwards-compat: env-canary OR fallback (one release) ───────────────────────
def test_canary_live_routes_even_when_flag_false(monkeypatch):
    monkeypatch.setenv("BYOD_ENABLED", "true")
    monkeypatch.setenv("BYOD_CANARY_COMPANY_IDS", CID)
    _seed(TenantDbStatus.LIVE, False)  # flag not yet migrated to TRUE
    assert byod_engine.routing_active(CID) is True


def test_canary_but_not_live_does_not_route(monkeypatch):
    # The fallback still requires LIVE — a canary that is not LIVE must not route.
    monkeypatch.setenv("BYOD_ENABLED", "true")
    monkeypatch.setenv("BYOD_CANARY_COMPANY_IDS", CID)
    _seed(TenantDbStatus.PENDING, False)
    assert byod_engine.routing_active(CID) is False


# ── Control-plane read path + negative caching ───────────────────────────────────
class _FakeCursor:
    def __init__(self, row):
        self._row = row
    def execute(self, sql, params=None):
        pass
    def fetchone(self):
        return self._row
    def close(self):
        pass


class _FakeConn:
    def __init__(self, row):
        self._row = row
    def cursor(self):
        return _FakeCursor(self._row)


def test_cache_miss_reads_control_plane_then_caches(monkeypatch):
    monkeypatch.setenv("BYOD_ENABLED", "true")
    calls = {"n": 0}

    def factory():
        calls["n"] += 1
        return _FakeConn(("LIVE", True))

    monkeypatch.setattr(byod_engine._Deps, "control_conn_factory", factory)
    monkeypatch.setattr(byod_engine._Deps, "control_conn_release", lambda c: None)

    assert byod_engine.routing_active(CID) is True
    assert byod_engine.routing_active(CID) is True
    assert calls["n"] == 1  # second call served from cache, no second DB read


def test_control_plane_unreachable_fails_safe(monkeypatch):
    monkeypatch.setenv("BYOD_ENABLED", "true")

    def boom():
        raise RuntimeError("control plane down")

    monkeypatch.setattr(byod_engine._Deps, "control_conn_factory", boom)
    # Fail CLOSED to the shared path — a routing read must never open a tenant DB
    # on a guess.
    assert byod_engine.routing_active(CID) is False


def test_unconfigured_engine_does_not_route(monkeypatch):
    monkeypatch.setenv("BYOD_ENABLED", "true")
    # _Deps.control_conn_factory is None (fixture) → no row → not routed.
    assert byod_engine.routing_active(CID) is False


# ── Explicit invalidation makes a flip immediate ─────────────────────────────────
def test_invalidate_forces_reread(monkeypatch):
    monkeypatch.setenv("BYOD_ENABLED", "true")
    row = {"v": ("LIVE", True)}

    monkeypatch.setattr(byod_engine._Deps, "control_conn_factory", lambda: _FakeConn(row["v"]))
    monkeypatch.setattr(byod_engine._Deps, "control_conn_release", lambda c: None)

    assert byod_engine.routing_active(CID) is True
    # Simulate a disable: DB now says routing_enabled=False, but the cache is stale.
    row["v"] = ("LIVE", False)
    assert byod_engine.routing_active(CID) is True  # still cached
    byod_engine.invalidate_routing_cache(CID)
    assert byod_engine.routing_active(CID) is False  # re-read picks up the flip
