"""BYOD per-tenant circuit breaker.

RFC docs/rfc-byod.md Phase 1.6 (§7.3 timeouts & circuit breakers; rule 15, §16.3).

The #1 multi-tenant scaling risk is a slow or dead remote tenant DB dragging down
everyone (§7). A circuit breaker makes one tenant's failures **fail fast and in
isolation** (rule 15): after consecutive failures it "opens" and short-circuits
that tenant's requests (degraded mode) instead of letting every call hang on a
timeout; after a cooldown it "half-opens" to let a single probe test recovery, and
restores service automatically on success.

State machine (textbook three-state breaker):

    CLOSED  --(failures >= failure_threshold)-->  OPEN
    OPEN    --(reset_timeout elapsed, on next request)-->  HALF_OPEN
    HALF_OPEN --(success_threshold probes succeed)-->  CLOSED
    HALF_OPEN --(any probe fails)-->  OPEN  (cooldown restarts)

One breaker instance per ``company_id`` (see :class:`BreakerRegistry`), so the
state is fully isolated per tenant — a tripped breaker for tenant A never affects
tenant B. Thread-safe (the engine runs threaded workers); the clock is injectable
so the time-based transitions are deterministic in tests. Pure stdlib — no DB, no
driver — so it unit-tests without Postgres.

Usage: call :meth:`before_request` (raises :class:`BreakerOpen` to fast-fail, else
allows the call), then report the outcome with :meth:`on_success` /
:meth:`on_failure`, or :meth:`on_ignore` when the call never actually reached the
DB (e.g. shed at the global ceiling — that must not count for or against health).
"""
from __future__ import annotations

import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Dict, Iterator, Optional


class BreakerState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class BreakerOpen(Exception):
    """The breaker is open (or its probe slot is taken) — fail fast for this tenant.
    The caller surfaces a graceful 'temporarily unavailable' (fail-soft, §10)."""


@dataclass(frozen=True)
class BreakerConfig:
    failure_threshold: int = 5            # consecutive failures in CLOSED → OPEN
    reset_timeout_seconds: float = 30.0   # OPEN cooldown before a probe is allowed
    success_threshold: int = 1            # probe successes in HALF_OPEN → CLOSED
    half_open_max_probes: int = 1         # concurrent probes allowed while HALF_OPEN


class CircuitBreaker:
    """A single thread-safe circuit breaker (one tenant)."""

    def __init__(
        self,
        config: Optional[BreakerConfig] = None,
        *,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._config = config or BreakerConfig()
        self._clock = clock
        self._lock = threading.RLock()
        self._state = BreakerState.CLOSED
        self._consecutive_failures = 0
        self._opened_at = 0.0
        self._half_open_probes = 0      # probes currently in flight
        self._half_open_successes = 0   # probe successes accumulated this window

    @property
    def state(self) -> BreakerState:
        """The *effective* state, accounting for an elapsed cooldown."""
        with self._lock:
            if self._state is BreakerState.OPEN and self._cooldown_elapsed():
                return BreakerState.HALF_OPEN
            return self._state

    def before_request(self) -> None:
        """Gate a call. Raise :class:`BreakerOpen` to fast-fail; else allow it
        (and, while HALF_OPEN, reserve a probe slot)."""
        with self._lock:
            if self._state is BreakerState.OPEN:
                if self._cooldown_elapsed():
                    self._enter_half_open()
                else:
                    raise BreakerOpen("Tenant circuit breaker is open.")

            if self._state is BreakerState.HALF_OPEN:
                if self._half_open_probes >= self._config.half_open_max_probes:
                    # Only a bounded number of probes may test recovery at once.
                    raise BreakerOpen("Tenant circuit breaker is probing recovery.")
                self._half_open_probes += 1
            # CLOSED → allow with no bookkeeping.

    def on_success(self) -> None:
        with self._lock:
            if self._state is BreakerState.HALF_OPEN:
                self._half_open_probes = max(0, self._half_open_probes - 1)
                self._half_open_successes += 1
                if self._half_open_successes >= self._config.success_threshold:
                    self._close()
            else:
                self._consecutive_failures = 0

    def on_failure(self) -> None:
        with self._lock:
            if self._state is BreakerState.HALF_OPEN:
                # A probe failed → straight back to OPEN, restart the cooldown.
                self._half_open_probes = max(0, self._half_open_probes - 1)
                self._open()
            else:
                self._consecutive_failures += 1
                if self._consecutive_failures >= self._config.failure_threshold:
                    self._open()

    def on_ignore(self) -> None:
        """The gated call never reached the DB (shed/backpressure). Release any
        probe slot without affecting health — neither success nor failure."""
        with self._lock:
            if self._state is BreakerState.HALF_OPEN and self._half_open_probes > 0:
                self._half_open_probes -= 1

    @contextmanager
    def guard(self) -> Iterator[None]:
        """Convenience wrapper for a self-contained DB call: any exception counts
        as a failure, a clean exit as success. (The pool integration uses the
        finer-grained on_* calls so it can classify and ignore backpressure.)"""
        self.before_request()
        try:
            yield
        except Exception:
            self.on_failure()
            raise
        else:
            self.on_success()

    # ── internals (caller holds the lock) ─────────────────────────────────────
    def _cooldown_elapsed(self) -> bool:
        return (self._clock() - self._opened_at) >= self._config.reset_timeout_seconds

    def _open(self) -> None:
        self._state = BreakerState.OPEN
        self._opened_at = self._clock()
        self._consecutive_failures = 0
        self._half_open_probes = 0
        self._half_open_successes = 0

    def _enter_half_open(self) -> None:
        self._state = BreakerState.HALF_OPEN
        self._half_open_probes = 0
        self._half_open_successes = 0

    def _close(self) -> None:
        self._state = BreakerState.CLOSED
        self._consecutive_failures = 0
        self._half_open_probes = 0
        self._half_open_successes = 0


class BreakerRegistry:
    """Lazily creates and holds one :class:`CircuitBreaker` per company_id, so each
    tenant's health is tracked in isolation (rule 15)."""

    def __init__(
        self,
        config: Optional[BreakerConfig] = None,
        *,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._config = config or BreakerConfig()
        self._clock = clock
        self._lock = threading.RLock()
        self._breakers: Dict[str, CircuitBreaker] = {}

    def get(self, company_id: str) -> CircuitBreaker:
        with self._lock:
            breaker = self._breakers.get(company_id)
            if breaker is None:
                breaker = CircuitBreaker(self._config, clock=self._clock)
                self._breakers[company_id] = breaker
            return breaker

    def state_of(self, company_id: str) -> BreakerState:
        return self.get(company_id).state

    def reset(self, company_id: str) -> None:
        """Forget everything learned about one tenant; the next :meth:`get` is CLOSED.

        For the case where something authoritative proves the dependency is healthy
        again and waiting out the cooldown would be wrong — an owner clicking a "test
        connection" button, say. Deliberately not reachable from the gated path, which
        must only ever learn from its own probes.
        """
        with self._lock:
            self._breakers.pop(company_id, None)
