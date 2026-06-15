"""Phase 1.6 test gate (part 1): per-tenant circuit breaker.

Exit criteria (RFC docs/rfc-byod.md §13, Phase 1.6):
    "Slow/failing DB → breaker opens, fast-fail, half-open recovery; other tenants
     unaffected." (rule 15, §7.3)

Pure unit tests with an injected clock — deterministic, no DB.
"""
from __future__ import annotations

import pytest

from byod_breaker import (
    BreakerConfig,
    BreakerOpen,
    BreakerRegistry,
    BreakerState,
    CircuitBreaker,
)


def make_breaker(config=None):
    t = {"now": 1000.0}
    cfg = config or BreakerConfig(failure_threshold=3, reset_timeout_seconds=30.0)
    return CircuitBreaker(cfg, clock=lambda: t["now"]), t


# ── Opening ───────────────────────────────────────────────────────────────────
def test_starts_closed_and_allows():
    cb, _ = make_breaker()
    assert cb.state is BreakerState.CLOSED
    cb.before_request()  # no raise


def test_failures_below_threshold_stay_closed():
    cb, _ = make_breaker(BreakerConfig(failure_threshold=3))
    cb.on_failure()
    cb.on_failure()
    assert cb.state is BreakerState.CLOSED


def test_success_resets_consecutive_failures():
    cb, _ = make_breaker(BreakerConfig(failure_threshold=3))
    cb.on_failure()
    cb.on_failure()
    cb.on_success()      # resets the streak
    cb.on_failure()
    cb.on_failure()
    assert cb.state is BreakerState.CLOSED  # only 2 since reset


def test_opens_after_threshold_and_fast_fails():
    cb, _ = make_breaker(BreakerConfig(failure_threshold=3))
    for _ in range(3):
        cb.on_failure()
    assert cb.state is BreakerState.OPEN
    with pytest.raises(BreakerOpen):
        cb.before_request()  # fast-fail, does not touch the DB


# ── Half-open recovery ────────────────────────────────────────────────────────
def test_open_to_half_open_after_cooldown():
    cb, t = make_breaker(BreakerConfig(failure_threshold=1, reset_timeout_seconds=30.0))
    cb.on_failure()
    assert cb.state is BreakerState.OPEN
    with pytest.raises(BreakerOpen):
        cb.before_request()
    t["now"] += 31  # cooldown elapsed
    assert cb.state is BreakerState.HALF_OPEN
    cb.before_request()  # one probe allowed


def test_half_open_success_closes():
    cb, t = make_breaker(BreakerConfig(failure_threshold=1, reset_timeout_seconds=30.0))
    cb.on_failure()
    t["now"] += 31
    cb.before_request()
    cb.on_success()
    assert cb.state is BreakerState.CLOSED


def test_half_open_failure_reopens_and_restarts_cooldown():
    cb, t = make_breaker(BreakerConfig(failure_threshold=1, reset_timeout_seconds=30.0))
    cb.on_failure()
    t["now"] += 31
    cb.before_request()
    cb.on_failure()                       # probe failed
    assert cb.state is BreakerState.OPEN  # back to open
    with pytest.raises(BreakerOpen):
        cb.before_request()               # cooldown restarted, still open


def test_half_open_limits_concurrent_probes():
    cb, t = make_breaker(
        BreakerConfig(failure_threshold=1, reset_timeout_seconds=30.0, half_open_max_probes=1)
    )
    cb.on_failure()
    t["now"] += 31
    cb.before_request()                   # first probe takes the only slot
    with pytest.raises(BreakerOpen):
        cb.before_request()               # second probe rejected


def test_on_ignore_releases_probe_slot():
    cb, t = make_breaker(
        BreakerConfig(failure_threshold=1, reset_timeout_seconds=30.0, half_open_max_probes=1)
    )
    cb.on_failure()
    t["now"] += 31
    cb.before_request()
    cb.on_ignore()        # call never reached DB → free the probe
    cb.before_request()   # slot available again


def test_success_threshold_greater_than_one():
    cb, t = make_breaker(
        BreakerConfig(
            failure_threshold=1, reset_timeout_seconds=30.0,
            success_threshold=2, half_open_max_probes=2,
        )
    )
    cb.on_failure()
    t["now"] += 31
    cb.before_request()
    cb.on_success()
    assert cb.state is BreakerState.HALF_OPEN  # 1 of 2
    cb.before_request()
    cb.on_success()
    assert cb.state is BreakerState.CLOSED     # 2 of 2


# ── guard() helper ────────────────────────────────────────────────────────────
def test_guard_records_failure_on_exception():
    cb, _ = make_breaker(BreakerConfig(failure_threshold=1))
    with pytest.raises(ValueError):
        with cb.guard():
            raise ValueError("db down")
    assert cb.state is BreakerState.OPEN


def test_guard_records_success_on_clean_exit():
    cb, _ = make_breaker(BreakerConfig(failure_threshold=2))
    cb.on_failure()
    with cb.guard():     # clean exit → success resets the streak
        pass
    cb.on_failure()
    assert cb.state is BreakerState.CLOSED  # only 1 failure since reset


# ── Registry isolation (rule 15) ──────────────────────────────────────────────
def test_registry_returns_same_breaker_per_company():
    reg = BreakerRegistry(BreakerConfig())
    assert reg.get("A") is reg.get("A")
    assert reg.get("A") is not reg.get("B")


def test_one_tenant_open_does_not_affect_another():
    reg = BreakerRegistry(BreakerConfig(failure_threshold=2))
    for _ in range(2):
        reg.get("A").on_failure()
    assert reg.state_of("A") is BreakerState.OPEN
    assert reg.state_of("B") is BreakerState.CLOSED
    reg.get("B").before_request()  # B unaffected
