"""Phase 8.1 test gate: noisy-neighbor load isolation (byod_pool + byod_breaker).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 8.1):
    "Load test: many slow/broken simulated tenant DBs. Shared-tenant latency/error
     SLO holds under noisy-neighbor load." (§7 perf isolation, §16.3 conn mgmt at scale)

The isolation machinery itself was built in Phase 1.5 (bounded + lazy + LRU pools
under a global ceiling, per-tenant bulkhead) and 1.6 (per-tenant circuit breaker +
timeouts). This sub-phase is the LOAD VALIDATION: under a fleet of broken + slow
simulated tenant DBs, prove the three guarantees that keep one bad tenant from
degrading the shared plane or other tenants —

  1. A broken tenant (its queries fail/time out) trips its breaker and then
     **fast-fails without consuming a global ceiling slot** (``before_request``
     runs before the ceiling acquire), so a fleet of broken tenants can never
     exhaust capacity.
  2. A slow tenant is **bulkheaded** at ``per_tenant_max`` and bounded by the global
     ceiling, so it can hold only its share of connections, never all of them.
  3. A healthy ("good"/shared-proxy) tenant is therefore **never starved**: it keeps
     serving within the tenant SLO while the fleet thrashes — and the registry's
     global in-flight count never exceeds the ceiling.

NOTE on the failure model: a connect/getconn failure is backpressure
(``TenantBusy``) and intentionally does NOT trip the breaker; the breaker tracks
DB-HEALTH failures — a query that fails or hits the statement timeout
(``db_failure_types``) raised from inside the checked-out connection. So "broken"
here means the work in the connection raises, the realistic slow/dead-DB signal.

All pure (fake pools, no Postgres) and deterministic → runs in the no-DB
engine-regression suite. Measurements are fed through the real
``observability.slo.evaluate_regression`` to assert the SLO holds.
"""
from __future__ import annotations

import threading
import time

import pytest

from byod_breaker import BreakerConfig, BreakerOpen, BreakerState
from byod_pool import PoolConfig, TenantPoolRegistry
from observability import slo


class _TenantDbError(Exception):
    """Stand-in for a driver DB/timeout error (e.g. psycopg2 OperationalError /
    QueryCanceled) raised by a failing or timed-out tenant query."""


class _FakeConn:
    def __init__(self) -> None:
        self.closed = False


class _FakePool:
    """ThreadedConnectionPool stand-in that hands out connections up to maxconn."""

    def __init__(self, dsn: str, minconn: int, maxconn: int) -> None:
        self.maxconn = maxconn
        self.checked_out = 0
        self._lock = threading.Lock()

    def getconn(self):
        with self._lock:
            if self.checked_out >= self.maxconn:
                raise RuntimeError("pool exhausted")
            self.checked_out += 1
        return _FakeConn()

    def putconn(self, conn, close: bool = False):
        with self._lock:
            self.checked_out -= 1

    def closeall(self):
        pass


def _registry():
    """A production-shaped registry over fake pools, with breakers tracking
    _TenantDbError (the db-health failure class)."""
    def factory(dsn: str, minconn: int, maxconn: int):
        return _FakePool(dsn, minconn, maxconn)

    cfg = PoolConfig(
        per_tenant_max=2,
        global_ceiling=8,
        acquire_timeout_seconds=0.3,
        idle_ttl_seconds=60.0,
        max_pools=64,
    )
    return TenantPoolRegistry(
        cfg,
        pool_factory=factory,
        dsn_provider=lambda cid: f"dsn://{cid}",
        breaker_config=BreakerConfig(failure_threshold=2, reset_timeout_seconds=60.0),
        db_failure_types=(_TenantDbError,),
    )


def _fail_query(reg, cid):
    """Simulate one failing/timed-out tenant query (trips the breaker)."""
    with pytest.raises(_TenantDbError):
        with reg.get_tenant_db(cid):
            raise _TenantDbError("query failed / statement timeout")


def _p95(values):
    s = sorted(values)
    return s[min(len(s) - 1, int(0.95 * (len(s) - 1)))]


def test_broken_tenants_trip_breaker_and_fast_fail_without_consuming_ceiling():
    """A fleet of broken tenant DBs trips each breaker, then fast-fails WITHOUT
    taking a global ceiling slot — so broken tenants can never exhaust capacity and
    leak no in-flight slots (E8)."""
    broken = {"broke1", "broke2", "broke3", "broke4", "broke5"}
    reg = _registry()

    # Drive each broken tenant to its failure threshold → breaker opens.
    for cid in broken:
        for _ in range(2):
            _fail_query(reg, cid)
        assert reg.breaker_state(cid) is BreakerState.OPEN

    # Now every broken tenant fast-fails via the breaker, quickly, and the global
    # in-flight count is back to zero (no leaked slots, no ceiling consumption).
    for cid in broken:
        t0 = time.perf_counter()
        with pytest.raises(BreakerOpen):
            with reg.get_tenant_db(cid):
                pass
        # Fast-fail: nowhere near the 0.3s ceiling acquire-timeout.
        assert (time.perf_counter() - t0) < 0.1
    assert reg.stats()["global_in_flight"] == 0


def test_good_tenant_not_starved_by_slow_and_broken_neighbors():
    """THE GATE: while broken tenants thrash and slow tenants hold their bulkhead
    share of connections, a healthy tenant keeps serving within the tenant SLO and
    the global in-flight never exceeds the ceiling."""
    broken = {"broke1", "broke2", "broke3"}
    reg = _registry()

    # Trip the broken breakers (they now fast-fail, consuming no ceiling slots).
    for cid in broken:
        for _ in range(2):
            _fail_query(reg, cid)
        assert reg.breaker_state(cid) is BreakerState.OPEN

    # Saturate slow tenants: 3 tenants x per_tenant_max(2) = 6 held connections,
    # leaving 2 of the ceiling-8 free. Each holder waits on a release event.
    release = threading.Event()
    holders = []

    def _hold(cid):
        try:
            with reg.get_tenant_db(cid):
                release.wait(3.0)
        except Exception:
            pass

    for cid in ("slowA", "slowB", "slowC"):
        for _ in range(2):
            t = threading.Thread(target=_hold, args=(cid,), daemon=True)
            t.start()
            holders.append(t)

    # Wait until the slow tenants have actually grabbed their 6 slots.
    deadline = time.time() + 3.0
    while reg.stats()["global_in_flight"] < 6 and time.time() < deadline:
        time.sleep(0.01)
    assert reg.stats()["global_in_flight"] == 6

    # Keep hammering broken neighbors in parallel (they fast-fail via the breaker).
    stop = threading.Event()

    def _broken_noise():
        while not stop.is_set():
            for cid in broken:
                try:
                    with reg.get_tenant_db(cid):
                        pass
                except Exception:
                    pass

    noise = threading.Thread(target=_broken_noise, daemon=True)
    noise.start()

    # The good tenant keeps serving (2 free slots) — measure it under the load.
    latencies_ms = []
    errors = 0
    try:
        for _ in range(40):
            t0 = time.perf_counter()
            try:
                with reg.get_tenant_db("good"):
                    pass
            except Exception:
                errors += 1
            latencies_ms.append((time.perf_counter() - t0) * 1000.0)
            # Global in-flight is always bounded by the ceiling, even under load.
            assert reg.stats()["global_in_flight"] <= 8
    finally:
        stop.set()
        release.set()
        for t in holders:
            t.join(timeout=3.0)
        noise.join(timeout=3.0)

    # The healthy tenant was never starved by its noisy neighbors.
    assert errors == 0

    # Feed the measured signals through the real SLO gate (tenant plane).
    measured = {
        "error_rate": errors / 40.0,
        "latency_p95_ms": _p95(latencies_ms),
        "latency_p99_ms": max(latencies_ms),
    }
    clean_baseline = {"error_rate": 0.0, "latency_p95_ms": 0.0, "latency_p99_ms": 0.0}
    verdict = slo.evaluate_regression(clean_baseline, measured, plane="tenant")
    assert verdict["ok"], verdict["violations"]


def test_slow_tenant_cannot_exceed_its_bulkhead_share():
    """A single slow tenant is capped at per_tenant_max regardless of demand, so it
    cannot monopolize the global ceiling (§16.3 bulkhead)."""
    reg = _registry()
    release = threading.Event()
    holders = []

    def _hold():
        try:
            with reg.get_tenant_db("hog"):
                release.wait(3.0)
        except Exception:
            pass

    # Far more concurrent demand than per_tenant_max(2).
    for _ in range(6):
        t = threading.Thread(target=_hold, daemon=True)
        t.start()
        holders.append(t)

    time.sleep(0.3)  # let them contend
    try:
        # Even with 6 threads clamoring, the one tenant holds at most its bulkhead.
        assert reg.stats()["global_in_flight"] <= 2
    finally:
        release.set()
        for t in holders:
            t.join(timeout=3.0)
