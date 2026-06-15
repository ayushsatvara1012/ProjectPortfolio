"""BYOD per-tenant connection-pool registry: get_tenant_db(company_id).

RFC docs/rfc-byod.md Phase 1.5 (§7.2 bounded per-tenant pools, §16.3 connection
management at scale; rules 14, E5, E7, E8).

The shared engine uses one global psycopg2 pool (``_get_pool()`` in main.py). BYOD
can't: it must reach **N remote tenant databases** with unpredictable latency, and
one tenant must never consume the capacity owed to another (rule 15, §7). This
module is the chokepoint for that — every BYOD tenant data access goes through
``get_tenant_db(company_id)`` (rule 1), which hands out a connection from a
**small, lazily-created, per-tenant pool** under a **global outbound ceiling**.

Guarantees enforced here:
  * **Bounded + lazy + LRU (rule 14, §7.2):** a tenant's pool is created on first
    use, capped at a few connections (bulkhead — one tenant can't exhaust global
    capacity), and idle pools are evicted (LRU + TTL) to bound the warm footprint.
  * **Global ceiling → shed (E7, §16.3):** total in-flight connections across all
    tenants are capped; at the ceiling we **bounded-wait then shed**
    (:class:`CeilingExceeded` → the caller returns 503 + Retry-After). We **never
    evict a pool mid-query** (only pools with zero in-flight are evictable).
  * **Routing integrity (E5):** every checked-out connection is **tagged with its
    company_id**; :func:`assert_tenant` lets the query path re-assert the tag
    before running SQL, and a mismatch **aborts** (:class:`RoutingIntegrityError`)
    rather than serving one tenant's data from another's connection.
  * **Leak-proof release (E8):** ``get_tenant_db`` is a context manager whose
    ``finally`` always returns the connection and frees its ceiling slot — even if
    the body raises.

Design: the registry core is pure Python (stdlib + threading) and both the
connection-pool implementation (``pool_factory``) and the DSN source
(``dsn_provider``) are injected, so the whole thing is unit-testable with fakes,
no Postgres required. The default ``psycopg2_pool_factory`` builds a real
``ThreadedConnectionPool`` (psycopg2 imported lazily). Per-tenant **statement /
acquire timeouts and the circuit breaker** are Phase 1.6 and intentionally not
here yet; this phase ships dark (nothing calls it).
"""
from __future__ import annotations

import os
import threading
import time
from collections import OrderedDict
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Callable, Iterator, Optional, Protocol, Tuple, Type
from weakref import WeakKeyDictionary

from byod_breaker import BreakerConfig, BreakerOpen, BreakerRegistry, BreakerState


# ── Errors ────────────────────────────────────────────────────────────────────
class PoolRegistryError(Exception):
    """Base class for tenant-pool registry failures."""


class CeilingExceeded(PoolRegistryError):
    """Global outbound connection ceiling reached after a bounded wait (E7).
    The caller sheds load: HTTP 503 + Retry-After (fail-soft, isolate, §16.3)."""


class TenantBusy(PoolRegistryError):
    """A single tenant's bounded pool is saturated (its bulkhead, §7.2)."""


class RoutingIntegrityError(PoolRegistryError):
    """A connection's company_id tag does not match the request (E5). This is
    catastrophic if served (cross-tenant data) → abort the query and alert."""


# ── Injection seams ───────────────────────────────────────────────────────────
class ConnectionPool(Protocol):
    """The slice of psycopg2's ThreadedConnectionPool the registry relies on."""

    def getconn(self): ...
    def putconn(self, conn, close: bool = False) -> None: ...
    def closeall(self) -> None: ...


# (dsn) -> ConnectionPool. Builds a bounded pool for one tenant's DSN.
PoolFactory = Callable[[str, int, int], ConnectionPool]
# (company_id) -> validated, decrypted DSN string. Wired to byod_store/crypto/dsn.
DsnProvider = Callable[[str], str]
# Optional per-connection setup (e.g. register_vector) run once on checkout.
OnAcquire = Callable[[object], None]


@dataclass(frozen=True)
class PoolConfig:
    """Tunables for the registry. Defaults are conservative; size per-tenant pools
    for cross-instance totals under the client's ``max_connections`` (§16.3, E7)."""

    per_tenant_min: int = 1          # warm minimum per active tenant (§16.3 cold-start)
    per_tenant_max: int = 3          # bulkhead: max in-flight for ONE tenant (§7.2)
    max_pools: int = 50              # warm tenant pools kept before LRU eviction
    global_ceiling: int = 100        # max concurrent in-flight conns across ALL tenants (E7)
    idle_ttl_seconds: float = 300.0  # evict a pool idle longer than this
    acquire_timeout_seconds: float = 5.0  # bounded wait at the ceiling before shedding
    statement_timeout_ms: int = 30000  # per-query statement timeout (§7.3); 0 = unset

    @classmethod
    def from_env(cls) -> "PoolConfig":
        def _int(name: str, default: int) -> int:
            raw = os.getenv(name)
            return int(raw) if raw and raw.strip() else default

        def _float(name: str, default: float) -> float:
            raw = os.getenv(name)
            return float(raw) if raw and raw.strip() else default

        return cls(
            per_tenant_min=_int("BYOD_POOL_PER_TENANT_MIN", cls.per_tenant_min),
            per_tenant_max=_int("BYOD_POOL_PER_TENANT_MAX", cls.per_tenant_max),
            max_pools=_int("BYOD_POOL_MAX_POOLS", cls.max_pools),
            global_ceiling=_int("BYOD_POOL_GLOBAL_CEILING", cls.global_ceiling),
            idle_ttl_seconds=_float("BYOD_POOL_IDLE_TTL_SECONDS", cls.idle_ttl_seconds),
            acquire_timeout_seconds=_float(
                "BYOD_POOL_ACQUIRE_TIMEOUT_SECONDS", cls.acquire_timeout_seconds
            ),
            statement_timeout_ms=_int(
                "BYOD_POOL_STATEMENT_TIMEOUT_MS", cls.statement_timeout_ms
            ),
        )


@dataclass
class _PoolEntry:
    pool: ConnectionPool
    in_flight: int = 0
    last_used: float = 0.0


class TenantPoolRegistry:
    """Thread-safe registry of bounded, lazily-created per-tenant connection pools.

    One instance per engine process (the engine runs threaded workers, hence the
    locking). All connection acquisition MUST go through :meth:`get_tenant_db`.
    """

    def __init__(
        self,
        config: Optional[PoolConfig] = None,
        *,
        pool_factory: PoolFactory,
        dsn_provider: DsnProvider,
        on_acquire: Optional[OnAcquire] = None,
        clock: Callable[[], float] = time.monotonic,
        breaker_config: Optional[BreakerConfig] = None,
        db_failure_types: Tuple[Type[BaseException], ...] = (),
    ) -> None:
        self._config = config or PoolConfig()
        self._pool_factory = pool_factory
        self._dsn_provider = dsn_provider
        self._on_acquire = on_acquire
        self._clock = clock
        # Per-tenant circuit breaker (rule 15, §7.3). Disabled if no config given,
        # so the bare registry keeps its Phase-1.5 behaviour. The wiring passes
        # the driver's connection/timeout error classes as db_failure_types so a
        # slow/dead DB trips the breaker, while backpressure (CeilingExceeded /
        # TenantBusy) and routing aborts (RoutingIntegrityError) never do.
        self._breakers: Optional[BreakerRegistry] = (
            BreakerRegistry(breaker_config, clock=clock)
            if breaker_config is not None
            else None
        )
        self._db_failure_types = db_failure_types
        # LRU order: front = least-recently-used, back = most-recent.
        self._pools: "OrderedDict[str, _PoolEntry]" = OrderedDict()
        self._global_in_flight = 0
        self._cond = threading.Condition(threading.RLock())
        # conn -> company_id, so a stray connection can never be re-routed (E5).
        self._tags: "WeakKeyDictionary[object, str]" = WeakKeyDictionary()

    # ── Public API ────────────────────────────────────────────────────────────
    @contextmanager
    def get_tenant_db(self, company_id: str) -> Iterator[object]:
        """Yield a tagged connection from ``company_id``'s bounded pool.

        Reserves a global ceiling slot (bounded-wait-then-shed), checks out a
        connection, tags it, and — via ``finally`` — always returns it and frees
        the slot, even on error (E8). Raises :class:`CeilingExceeded` /
        :class:`TenantBusy` on backpressure, :class:`RoutingIntegrityError` on a
        tag mismatch.
        """
        breaker = self._breakers.get(company_id) if self._breakers else None
        if breaker is not None:
            breaker.before_request()  # fast-fail if open; never consumes a slot

        outcome = "ignore"
        entry = None
        conn = None
        try:
            entry = self._reserve(company_id)
            try:
                conn = entry.pool.getconn()
            except Exception as exc:  # per-tenant pool exhausted / connect failed
                raise TenantBusy(
                    f"Tenant pool unavailable for {company_id}."
                ) from exc
            self._tags[conn] = company_id
            if self._on_acquire is not None:
                self._on_acquire(conn)
            # Defensive E5: prove the connection we are about to hand back is this
            # tenant's before any SQL runs.
            self.assert_tenant(conn, company_id)
            yield conn
            outcome = "success"
        except BaseException as exc:
            if self._is_db_failure(exc):
                outcome = "failure"
            raise
        finally:
            if conn is not None:
                try:
                    entry.pool.putconn(conn, close=bool(getattr(conn, "closed", False)))
                finally:
                    self._tags.pop(conn, None)
            if entry is not None:
                self._release(company_id)
            if breaker is not None:
                if outcome == "success":
                    breaker.on_success()
                elif outcome == "failure":
                    breaker.on_failure()
                else:
                    breaker.on_ignore()

    def _is_db_failure(self, exc: BaseException) -> bool:
        """A DB-health failure (counts against the breaker) — NOT backpressure or
        a routing abort, which are PoolRegistryErrors and never classified here."""
        return bool(self._db_failure_types) and isinstance(exc, self._db_failure_types)

    def breaker_state(self, company_id: str) -> Optional[BreakerState]:
        """Current circuit-breaker state for a tenant (None if breakers disabled)."""
        return self._breakers.state_of(company_id) if self._breakers else None

    def assert_tenant(self, conn: object, company_id: str) -> None:
        """Assert a connection is tagged for ``company_id``; else abort (E5).

        Call this on the query path before running SQL — a mismatch means a routing
        bug would otherwise read/write the wrong client's database."""
        tag = self._tags.get(conn)
        if tag != company_id:
            raise RoutingIntegrityError(
                "Connection routing tag does not match the requested tenant."
            )

    def tenant_of(self, conn: object) -> Optional[str]:
        """The company_id a checked-out connection is tagged for, if any."""
        return self._tags.get(conn)

    def evict_idle(self, now: Optional[float] = None) -> int:
        """Close pools idle longer than the TTL (only ones with no in-flight work,
        never mid-query — E7). Returns the number evicted. Safe to call on a
        sweeper. """
        now = self._clock() if now is None else now
        ttl = self._config.idle_ttl_seconds
        evicted = 0
        with self._cond:
            for cid in list(self._pools.keys()):
                entry = self._pools[cid]
                if entry.in_flight == 0 and (now - entry.last_used) >= ttl:
                    self._close_entry(cid)
                    evicted += 1
        return evicted

    def stats(self) -> dict:
        """Snapshot for observability/tests."""
        with self._cond:
            return {
                "pools": len(self._pools),
                "global_in_flight": self._global_in_flight,
                "per_tenant_in_flight": {
                    cid: e.in_flight for cid, e in self._pools.items()
                },
            }

    def close_all(self) -> None:
        """Tear down every pool (process shutdown)."""
        with self._cond:
            for cid in list(self._pools.keys()):
                self._close_entry(cid)

    # ── Internals ─────────────────────────────────────────────────────────────
    def _reserve(self, company_id: str) -> _PoolEntry:
        """Under the lock: wait for a free ceiling slot (bounded), get/create the
        tenant pool, and account the in-flight reservation."""
        deadline = self._clock() + self._config.acquire_timeout_seconds
        with self._cond:
            while self._global_in_flight >= self._config.global_ceiling:
                remaining = deadline - self._clock()
                if remaining <= 0 or not self._cond.wait(timeout=remaining):
                    if self._global_in_flight >= self._config.global_ceiling:
                        # Bounded wait elapsed, still no room → shed (E7).
                        raise CeilingExceeded(
                            "Global tenant-connection ceiling reached; retry shortly."
                        )
            entry = self._get_or_create_entry(company_id)
            entry.in_flight += 1
            self._global_in_flight += 1
            entry.last_used = self._clock()
            self._pools.move_to_end(company_id)  # mark most-recently-used
            return entry

    def _release(self, company_id: str) -> None:
        with self._cond:
            entry = self._pools.get(company_id)
            if entry is not None and entry.in_flight > 0:
                entry.in_flight -= 1
                entry.last_used = self._clock()
            if self._global_in_flight > 0:
                self._global_in_flight -= 1
            # A ceiling slot freed up — wake one bounded waiter.
            self._cond.notify()

    def _get_or_create_entry(self, company_id: str) -> _PoolEntry:
        """Caller must hold the lock. Lazily build a tenant pool, evicting an idle
        LRU pool first if we are at the warm-pool cap (never a busy one)."""
        entry = self._pools.get(company_id)
        if entry is not None:
            return entry
        if len(self._pools) >= self._config.max_pools:
            self._evict_one_idle_lru()
        dsn = self._dsn_provider(company_id)
        pool = self._pool_factory(
            dsn, self._config.per_tenant_min, self._config.per_tenant_max
        )
        entry = _PoolEntry(pool=pool, in_flight=0, last_used=self._clock())
        self._pools[company_id] = entry
        return entry

    def _evict_one_idle_lru(self) -> None:
        """Caller holds the lock. Evict the least-recently-used pool with zero
        in-flight connections. If every pool is busy, leave them (the global
        ceiling, not the pool count, is the hard resource bound)."""
        for cid, entry in self._pools.items():  # LRU order (front first)
            if entry.in_flight == 0:
                self._close_entry(cid)
                return

    def _close_entry(self, company_id: str) -> None:
        """Caller holds the lock. Close and drop a pool."""
        entry = self._pools.pop(company_id, None)
        if entry is None:
            return
        try:
            entry.pool.closeall()
        except Exception:
            pass


# ── Default real backend (psycopg2) ───────────────────────────────────────────
def psycopg2_pool_factory(dsn: str, minconn: int, maxconn: int) -> ConnectionPool:
    """Build a real bounded ThreadedConnectionPool for a tenant DSN.

    psycopg2 is imported lazily so importing this module stays cheap (and so the
    registry core remains testable without the driver)."""
    from psycopg2 import pool as _pg_pool  # lazy

    return _pg_pool.ThreadedConnectionPool(minconn=minconn, maxconn=maxconn, dsn=dsn)


def statement_timeout_on_acquire(timeout_ms: int) -> OnAcquire:
    """Build an ``on_acquire`` hook that bounds every query on a checked-out
    connection with a Postgres ``statement_timeout`` (§7.3, rule 4) — so one slow
    tenant query is cancelled fast instead of hanging a worker. A non-positive
    timeout disables it (no-op)."""

    def _apply(conn: object) -> None:
        if timeout_ms <= 0:
            return
        with conn.cursor() as cur:  # type: ignore[attr-defined]
            cur.execute("SET statement_timeout = %s", (timeout_ms,))

    return _apply
