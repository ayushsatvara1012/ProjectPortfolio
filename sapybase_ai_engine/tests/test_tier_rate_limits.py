"""
Tests for the per-tenant daily chat cap (anti quota-drain backstop) added to
TIER_RATE_LIMITS / enforce_tier_chat_limit.

Behavioral tests drive the real async function with a tiny in-memory fake Redis,
run via asyncio.run() so no pytest-asyncio plugin is required.
"""
import asyncio

import pytest
from fastapi import HTTPException

import main


# ── Config invariants ────────────────────────────────────────────────────────

class TestDailyCapConfig:
    def test_every_tier_has_per_day(self):
        for tier, caps in main.TIER_RATE_LIMITS.items():
            assert "per_day" in caps, f"{tier} missing per_day"

    @pytest.mark.parametrize("tier", ["BASIC", "STARTER", "PRO", "BUSINESS", "CUSTOM"])
    def test_per_day_is_six_times_per_hour(self, tier):
        caps = main.TIER_RATE_LIMITS[tier]
        assert caps["per_day"] == caps["per_hour"] * 6

    def test_free_is_zero_and_enterprise_is_sentinel(self):
        assert main.TIER_RATE_LIMITS["FREE"]["per_day"] == 0
        assert main.TIER_RATE_LIMITS["ENTERPRISE"]["per_day"] == 999999

    def test_day_cap_above_hour_cap_for_real_tiers(self):
        # Sanity: a daily cap must never be tighter than the hourly cap.
        for tier, caps in main.TIER_RATE_LIMITS.items():
            if caps["per_hour"] > 0 and caps["per_day"] > 0:
                assert caps["per_day"] >= caps["per_hour"], tier


# ── Behavioral: enforce_tier_chat_limit day bucket ───────────────────────────

class _FakeRedis:
    """Minimal async Redis stand-in supporting incr/expire used by the limiter."""
    def __init__(self):
        self.store = {}
        self.expirations = {}

    async def incr(self, key):
        self.store[key] = self.store.get(key, 0) + 1
        return self.store[key]

    async def expire(self, key, ttl):
        self.expirations[key] = ttl
        return True


@pytest.fixture
def fake_redis(monkeypatch):
    fr = _FakeRedis()
    # `r` is created at runtime in startup_event (global), so it may not exist as
    # a module attribute during tests — raising=False lets us inject it.
    monkeypatch.setattr(main, "r", fr, raising=False)
    return fr


def _run(coro):
    return asyncio.run(coro)


class TestEnforceDailyCap:
    def test_no_redis_is_noop(self, monkeypatch):
        # When Redis is unavailable the limiter must fall through silently.
        monkeypatch.setattr(main, "r", None, raising=False)
        # Should not raise even with a tier that has caps.
        _run(main.enforce_tier_chat_limit("c1", "BASIC"))

    def test_under_daily_cap_does_not_raise(self, fake_redis, monkeypatch):
        # High minute/hour so only the day cap is in play; day cap = 5.
        monkeypatch.setitem(
            main.TIER_RATE_LIMITS, "BASIC",
            {"per_minute": 10_000, "per_hour": 10_000, "per_day": 5},
        )
        for _ in range(5):
            _run(main.enforce_tier_chat_limit("tenant-under", "BASIC"))  # 1..5 == cap, ok

    def test_exceeding_daily_cap_raises_429_per_day(self, fake_redis, monkeypatch):
        monkeypatch.setitem(
            main.TIER_RATE_LIMITS, "BASIC",
            {"per_minute": 10_000, "per_hour": 10_000, "per_day": 3},
        )
        for _ in range(3):
            _run(main.enforce_tier_chat_limit("tenant-over", "BASIC"))  # 1..3 ok
        with pytest.raises(HTTPException) as exc:
            _run(main.enforce_tier_chat_limit("tenant-over", "BASIC"))  # 4th trips
        assert exc.value.status_code == 429
        assert exc.value.detail["scope"] == "per_day"
        assert "Retry-After" in exc.value.headers

    def test_per_day_zero_means_unenforced(self, fake_redis, monkeypatch):
        # FREE-style sentinel: per_day == 0 -> no daily cap enforced here.
        monkeypatch.setitem(
            main.TIER_RATE_LIMITS, "FREE",
            {"per_minute": 0, "per_hour": 0, "per_day": 0},
        )
        for _ in range(50):
            _run(main.enforce_tier_chat_limit("free-tenant", "FREE"))  # never raises

    def test_minute_cap_trips_before_day_cap(self, fake_redis, monkeypatch):
        # Ordering guarantee: the tightest window (minute) should fire first.
        monkeypatch.setitem(
            main.TIER_RATE_LIMITS, "BASIC",
            {"per_minute": 2, "per_hour": 10_000, "per_day": 10_000},
        )
        _run(main.enforce_tier_chat_limit("t", "BASIC"))
        _run(main.enforce_tier_chat_limit("t", "BASIC"))
        with pytest.raises(HTTPException) as exc:
            _run(main.enforce_tier_chat_limit("t", "BASIC"))
        assert exc.value.detail["scope"] == "per_minute"

    def test_separate_tenants_have_independent_buckets(self, fake_redis, monkeypatch):
        monkeypatch.setitem(
            main.TIER_RATE_LIMITS, "BASIC",
            {"per_minute": 10_000, "per_hour": 10_000, "per_day": 2},
        )
        _run(main.enforce_tier_chat_limit("tenant-A", "BASIC"))
        _run(main.enforce_tier_chat_limit("tenant-A", "BASIC"))
        # tenant-B is unaffected by tenant-A hitting its cap.
        _run(main.enforce_tier_chat_limit("tenant-B", "BASIC"))
        _run(main.enforce_tier_chat_limit("tenant-B", "BASIC"))
        with pytest.raises(HTTPException):
            _run(main.enforce_tier_chat_limit("tenant-A", "BASIC"))  # A's 3rd trips


# ── Redis-down fail-open alerting (item 8) ───────────────────────────────────

class _RaisingRedis:
    """Async Redis stand-in whose ops always fail — simulates an outage."""
    async def incr(self, key):
        raise main.redis.RedisError("simulated redis outage")

    async def expire(self, key, ttl):
        raise main.redis.RedisError("simulated redis outage")


class TestRedisDownAlert:
    def _capture_errors(self, monkeypatch):
        calls = []
        monkeypatch.setattr(main.logger, "error", lambda *a, **k: calls.append((a, k)))
        return calls

    def test_alert_logs_once_then_throttles(self, monkeypatch):
        main._REDIS_ALERT_LAST.clear()
        calls = self._capture_errors(monkeypatch)
        main._alert_redis_down("site-x", Exception("boom"))
        main._alert_redis_down("site-x", Exception("boom"))  # within 30s -> suppressed
        assert len(calls) == 1

    def test_alert_logs_again_after_window(self, monkeypatch):
        main._REDIS_ALERT_LAST.clear()
        calls = self._capture_errors(monkeypatch)
        main._alert_redis_down("site-y", Exception("boom"))
        # Simulate >30s elapsed by backdating the last-logged timestamp.
        main._REDIS_ALERT_LAST["site-y"] = main.time.time() - 31
        main._alert_redis_down("site-y", Exception("boom"))
        assert len(calls) == 2

    def test_distinct_call_sites_have_independent_throttle(self, monkeypatch):
        main._REDIS_ALERT_LAST.clear()
        calls = self._capture_errors(monkeypatch)
        main._alert_redis_down("a", Exception("x"))
        main._alert_redis_down("b", Exception("x"))
        assert len(calls) == 2

    def test_enforce_tier_chat_limit_fails_open_and_alerts_on_redis_error(self, monkeypatch):
        # The guard must NOT raise (fail-open) when Redis errors, but MUST alert.
        main._REDIS_ALERT_LAST.clear()
        calls = self._capture_errors(monkeypatch)
        monkeypatch.setattr(main, "r", _RaisingRedis(), raising=False)
        _run(main.enforce_tier_chat_limit("tenant", "BASIC"))  # no exception
        assert any("enforce_tier_chat_limit" in c[0][1] for c in calls)

    def test_check_global_llm_budget_fails_open_and_alerts_on_redis_error(self, monkeypatch):
        main._REDIS_ALERT_LAST.clear()
        calls = self._capture_errors(monkeypatch)
        monkeypatch.setattr(main, "r", _RaisingRedis(), raising=False)
        _run(main.check_global_llm_budget("tenant"))  # no exception
        assert any("check_global_llm_budget" in c[0][1] for c in calls)
