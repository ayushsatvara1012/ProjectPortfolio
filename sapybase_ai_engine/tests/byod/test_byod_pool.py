"""Phase 1.5 test gate: get_tenant_db() per-tenant pool registry.

Exit criteria (RFC docs/rfc-byod.md §13, Phase 1.5):
    "Pool reuse/evict; ceiling->503 shed; tag-mismatch aborts; leak test
     (exception still releases)." (rules E5, E7, E8)

All tests use a fake connection pool — no Postgres required. The registry core is
pure Python, so these exercise the real LRU / ceiling / tagging / release logic.
"""
from __future__ import annotations

import threading

import pytest

from byod_breaker import BreakerConfig, BreakerOpen, BreakerState
from db.byod_pool import (
    CeilingExceeded,
    PoolConfig,
    RoutingIntegrityError,
    TenantBusy,
    TenantPoolRegistry,
    statement_timeout_on_acquire,
)


# ── Fakes ─────────────────────────────────────────────────────────────────────
class FakeConn:
    def __init__(self, pool: "FakePool", idx: int) -> None:
        self.pool = pool
        self.idx = idx
        self.closed = False


class FakePool:
    """Minimal ThreadedConnectionPool stand-in with a hard maxconn."""

    def __init__(self, dsn: str, minconn: int, maxconn: int) -> None:
        self.dsn = dsn
        self.minconn = minconn
        self.maxconn = maxconn
        self.checked_out = 0
        self._counter = 0
        self.closed_all = False
        self.live: list[FakeConn] = []

    def getconn(self):
        if self.checked_out >= self.maxconn:
            raise RuntimeError("pool exhausted")
        self.checked_out += 1
        self._counter += 1
        c = FakeConn(self, self._counter)
        self.live.append(c)
        return c

    def putconn(self, conn, close: bool = False):
        self.checked_out -= 1

    def closeall(self):
        self.closed_all = True


def make_registry(config=None, **kwargs):
    pools: dict[str, FakePool] = {}

    def factory(dsn: str, minconn: int, maxconn: int) -> FakePool:
        p = FakePool(dsn, minconn, maxconn)
        pools[dsn] = p
        return p

    reg = TenantPoolRegistry(
        config or PoolConfig(),
        pool_factory=factory,
        dsn_provider=lambda cid: f"dsn://{cid}",
        **kwargs,
    )
    return reg, pools


class TenantDbError(Exception):
    """Stand-in for a driver DB/timeout error (e.g. psycopg2 OperationalError)."""


# ── Pool reuse ────────────────────────────────────────────────────────────────
def test_pool_created_lazily_and_reused():
    reg, pools = make_registry()
    assert reg.stats()["pools"] == 0  # nothing built until first use

    with reg.get_tenant_db("A") as c1:
        assert c1 is not None
    with reg.get_tenant_db("A") as c2:
        assert c2 is not None

    # One pool for tenant A, reused across both acquisitions.
    assert len(pools) == 1
    assert reg.stats()["pools"] == 1
    assert reg.stats()["global_in_flight"] == 0  # fully released


def test_distinct_tenants_get_distinct_pools():
    reg, pools = make_registry()
    with reg.get_tenant_db("A"):
        with reg.get_tenant_db("B"):
            assert reg.stats()["pools"] == 2
            assert reg.stats()["global_in_flight"] == 2
    assert len(pools) == 2


# ── LRU eviction ──────────────────────────────────────────────────────────────
def test_lru_eviction_at_max_pools():
    reg, pools = make_registry(PoolConfig(max_pools=2))
    for cid in ("A", "B", "C"):  # third tenant forces eviction of LRU (A)
        with reg.get_tenant_db(cid):
            pass
    assert reg.stats()["pools"] == 2
    assert pools["dsn://A"].closed_all is True   # A evicted + closed
    assert pools["dsn://C"].closed_all is False  # newest retained


def test_busy_pool_is_never_evicted_midquery():
    reg, pools = make_registry(PoolConfig(max_pools=1))
    with reg.get_tenant_db("A"):  # A is in-flight (busy)
        # B wants a pool but max_pools=1 and A is busy → A is NOT evicted; both live
        with reg.get_tenant_db("B"):
            assert pools["dsn://A"].closed_all is False
            assert reg.stats()["pools"] == 2  # soft-exceeded rather than evict busy A


def test_idle_ttl_eviction():
    t = {"now": 1000.0}
    reg, pools = make_registry(
        PoolConfig(idle_ttl_seconds=60.0), clock=lambda: t["now"]
    )
    with reg.get_tenant_db("A"):
        pass
    t["now"] = 1030.0
    assert reg.evict_idle() == 0          # 30s < ttl → kept
    t["now"] = 1100.0
    assert reg.evict_idle() == 1          # 100s >= ttl → evicted
    assert pools["dsn://A"].closed_all is True


# ── Global ceiling → shed ─────────────────────────────────────────────────────
def test_global_ceiling_sheds_when_full():
    reg, _ = make_registry(
        PoolConfig(global_ceiling=2, per_tenant_max=5, acquire_timeout_seconds=0.05)
    )
    with reg.get_tenant_db("A"):
        with reg.get_tenant_db("B"):
            assert reg.stats()["global_in_flight"] == 2
            with pytest.raises(CeilingExceeded):
                with reg.get_tenant_db("C"):
                    pass


def test_ceiling_slot_freed_after_release():
    reg, _ = make_registry(PoolConfig(global_ceiling=1, acquire_timeout_seconds=0.05))
    with reg.get_tenant_db("A"):
        with pytest.raises(CeilingExceeded):
            with reg.get_tenant_db("B"):
                pass
    # A released → ceiling has room again.
    with reg.get_tenant_db("B"):
        assert reg.stats()["global_in_flight"] == 1


def test_ceiling_waiter_unblocks_when_slot_frees():
    reg, _ = make_registry(PoolConfig(global_ceiling=1, acquire_timeout_seconds=2.0))
    started = threading.Event()
    got = threading.Event()

    def worker():
        started.wait()
        with reg.get_tenant_db("B"):  # blocks until A releases
            got.set()

    t = threading.Thread(target=worker)
    t.start()
    with reg.get_tenant_db("A"):
        started.set()
        # B is waiting on the ceiling; it must not have acquired yet.
        assert not got.wait(timeout=0.2)
    # A released here → B should unblock quickly.
    assert got.wait(timeout=1.0)
    t.join(timeout=1.0)


# ── Per-tenant bulkhead ───────────────────────────────────────────────────────
def test_per_tenant_pool_exhaustion_raises_tenant_busy():
    reg, _ = make_registry(PoolConfig(per_tenant_max=1, global_ceiling=10))
    with reg.get_tenant_db("A"):
        with pytest.raises(TenantBusy):
            with reg.get_tenant_db("A"):  # same tenant, pool maxconn=1 hit
                pass


# ── Routing-tag integrity (E5) ────────────────────────────────────────────────
def test_connection_is_tagged_with_company_id():
    reg, _ = make_registry()
    with reg.get_tenant_db("A") as conn:
        assert reg.tenant_of(conn) == "A"
        reg.assert_tenant(conn, "A")  # matches → no raise


def test_tag_mismatch_aborts():
    reg, _ = make_registry()
    with reg.get_tenant_db("A") as conn:
        with pytest.raises(RoutingIntegrityError):
            reg.assert_tenant(conn, "B")  # wrong tenant → abort


def test_tag_cleared_after_release():
    reg, _ = make_registry()
    with reg.get_tenant_db("A") as conn:
        pass
    assert reg.tenant_of(conn) is None  # untagged on release


# ── Leak prevention (E8) ──────────────────────────────────────────────────────
def test_exception_in_body_still_releases():
    reg, pools = make_registry()
    with pytest.raises(ValueError):
        with reg.get_tenant_db("A"):
            raise ValueError("boom")
    # Connection returned, slot freed despite the exception.
    assert reg.stats()["global_in_flight"] == 0
    assert pools["dsn://A"].checked_out == 0


def test_release_even_if_getconn_fails():
    # per_tenant_max=1: first holder occupies the pool; a second concurrent acquire
    # fails in getconn — its reserved ceiling slot must still be freed.
    reg, _ = make_registry(PoolConfig(per_tenant_max=1, global_ceiling=10))
    with reg.get_tenant_db("A"):
        with pytest.raises(TenantBusy):
            with reg.get_tenant_db("A"):
                pass
        # The failed acquire must not have leaked a ceiling slot.
        assert reg.stats()["global_in_flight"] == 1
    assert reg.stats()["global_in_flight"] == 0


def test_dsn_provider_called_once_per_pool():
    calls: list[str] = []

    def factory(dsn, minconn, maxconn):
        return FakePool(dsn, minconn, maxconn)

    def provider(cid):
        calls.append(cid)
        return f"dsn://{cid}"

    reg = TenantPoolRegistry(
        PoolConfig(), pool_factory=factory, dsn_provider=provider
    )
    for _ in range(3):
        with reg.get_tenant_db("A"):
            pass
    assert calls == ["A"]  # DSN resolved once; pool reused thereafter


# ── Circuit breaker integration (Phase 1.6, rule 15, §7.3) ───────────────────
def make_breaker_registry(breaker_config, clock=None, **kwargs):
    pools: dict[str, FakePool] = {}

    def factory(dsn, minconn, maxconn):
        p = FakePool(dsn, minconn, maxconn)
        pools[dsn] = p
        return p

    extra = {"clock": clock} if clock is not None else {}
    reg = TenantPoolRegistry(
        PoolConfig(),
        pool_factory=factory,
        dsn_provider=lambda cid: f"dsn://{cid}",
        breaker_config=breaker_config,
        db_failure_types=(TenantDbError,),
        **extra,
        **kwargs,
    )
    return reg, pools


def _fail_once(reg, cid):
    with pytest.raises(TenantDbError):
        with reg.get_tenant_db(cid):
            raise TenantDbError("db down")


def test_breaker_disabled_by_default():
    reg, _ = make_registry()
    assert reg.breaker_state("A") is None  # no breaker unless configured


def test_repeated_db_failures_open_breaker_and_fast_fail():
    reg, pools = make_breaker_registry(BreakerConfig(failure_threshold=3))
    for _ in range(3):
        _fail_once(reg, "A")
    assert reg.breaker_state("A") is BreakerState.OPEN
    # Now fast-fail WITHOUT acquiring a connection.
    before = pools["dsn://A"].checked_out
    with pytest.raises(BreakerOpen):
        with reg.get_tenant_db("A"):
            pass
    assert pools["dsn://A"].checked_out == before  # no checkout happened


def test_other_tenants_unaffected_when_one_breaker_open():
    reg, _ = make_breaker_registry(BreakerConfig(failure_threshold=2))
    for _ in range(2):
        _fail_once(reg, "A")
    assert reg.breaker_state("A") is BreakerState.OPEN
    # Tenant B still serves normally.
    with reg.get_tenant_db("B") as conn:
        assert conn is not None
    assert reg.breaker_state("B") is BreakerState.CLOSED


def test_clean_success_keeps_breaker_closed():
    reg, _ = make_breaker_registry(BreakerConfig(failure_threshold=2))
    _fail_once(reg, "A")
    with reg.get_tenant_db("A"):  # success resets the streak
        pass
    _fail_once(reg, "A")
    assert reg.breaker_state("A") is BreakerState.CLOSED


def test_backpressure_does_not_trip_breaker():
    # CeilingExceeded / TenantBusy are not DB-health failures, so a bulkhead hit
    # (per_tenant_max=1, nested acquire) must NOT open the breaker.
    pools: dict[str, FakePool] = {}

    def factory(dsn, minconn, maxconn):
        p = FakePool(dsn, minconn, maxconn)
        pools[dsn] = p
        return p

    reg = TenantPoolRegistry(
        PoolConfig(per_tenant_max=1, global_ceiling=10),
        pool_factory=factory,
        dsn_provider=lambda cid: f"dsn://{cid}",
        breaker_config=BreakerConfig(failure_threshold=1),
        db_failure_types=(TenantDbError,),
    )
    with reg.get_tenant_db("A"):
        with pytest.raises(TenantBusy):
            with reg.get_tenant_db("A"):
                pass
    assert reg.breaker_state("A") is BreakerState.CLOSED  # not tripped


def test_half_open_recovery_restores_service():
    t = {"now": 1000.0}
    reg, _ = make_breaker_registry(
        BreakerConfig(failure_threshold=2, reset_timeout_seconds=30.0),
        clock=lambda: t["now"],
    )
    for _ in range(2):
        _fail_once(reg, "A")
    assert reg.breaker_state("A") is BreakerState.OPEN
    t["now"] += 31  # cooldown elapses → half-open
    assert reg.breaker_state("A") is BreakerState.HALF_OPEN
    with reg.get_tenant_db("A") as conn:  # probe succeeds
        assert conn is not None
    assert reg.breaker_state("A") is BreakerState.CLOSED


# ── Statement-timeout on_acquire helper (§7.3) ───────────────────────────────
class _RecordingCursor:
    def __init__(self, sink): self.sink = sink
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def execute(self, sql, params=None): self.sink.append((sql, params))


class _RecordingConn:
    def __init__(self): self.executed = []
    def cursor(self): return _RecordingCursor(self.executed)


def test_statement_timeout_hook_sets_timeout():
    hook = statement_timeout_on_acquire(15000)
    conn = _RecordingConn()
    hook(conn)
    assert conn.executed == [("SET statement_timeout = %s", (15000,))]


def test_statement_timeout_hook_noop_when_disabled():
    hook = statement_timeout_on_acquire(0)
    conn = _RecordingConn()
    hook(conn)
    assert conn.executed == []


def test_statement_timeout_applied_via_registry_on_acquire():
    conns = []

    def factory(dsn, minconn, maxconn):
        return FakePoolWithCursor(dsn, minconn, maxconn, conns)

    reg = TenantPoolRegistry(
        PoolConfig(),
        pool_factory=factory,
        dsn_provider=lambda cid: f"dsn://{cid}",
        on_acquire=statement_timeout_on_acquire(5000),
    )
    with reg.get_tenant_db("A"):
        pass
    assert conns and conns[0].executed == [("SET statement_timeout = %s", (5000,))]


class FakePoolWithCursor(FakePool):
    def __init__(self, dsn, minconn, maxconn, sink):
        super().__init__(dsn, minconn, maxconn)
        self.sink = sink

    def getconn(self):
        c = _RecordingConn()
        c.closed = False
        self.checked_out += 1
        self.sink.append(c)
        return c

    def putconn(self, conn, close=False):
        self.checked_out -= 1
