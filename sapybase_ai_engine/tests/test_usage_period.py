"""Tests for the monthly usage-period reset decision logic (Explore D2).

Covers the pure helpers in usage_period.py — the boundary at which a reset
triggers and the construction of a fresh window. The DB write that applies the
reset (main._reset_elapsed_usage_periods) is exercised by integration, not here.
"""
from datetime import datetime, timedelta, timezone

import pytest


def _import():
    from usage_period import should_reset_usage, fresh_period, USAGE_PERIOD
    return should_reset_usage, fresh_period, USAGE_PERIOD


NOW = datetime(2026, 6, 9, 12, 0, 0, tzinfo=timezone.utc)


class TestShouldResetUsage:
    def test_none_period_end_never_resets(self):
        # No usage row yet (LEFT JOIN null) — nothing to roll.
        should_reset, _, _ = _import()
        assert should_reset(NOW, None) is False

    def test_future_period_does_not_reset(self):
        should_reset, _, _ = _import()
        assert should_reset(NOW, NOW + timedelta(days=5)) is False

    def test_exact_boundary_resets(self):
        # At the boundary the period has ended — reset.
        should_reset, _, _ = _import()
        assert should_reset(NOW, NOW) is True

    def test_elapsed_period_resets(self):
        should_reset, _, _ = _import()
        assert should_reset(NOW, NOW - timedelta(days=1)) is True

    def test_long_idle_gap_resets(self):
        # A bot idle for months is still resettable on the next read.
        should_reset, _, _ = _import()
        assert should_reset(NOW, NOW - timedelta(days=400)) is True


class TestFreshPeriod:
    def test_window_is_thirty_days(self):
        _, fresh_period, USAGE_PERIOD = _import()
        start, end = fresh_period(NOW)
        assert start == NOW
        assert end == NOW + USAGE_PERIOD
        assert (end - start) == timedelta(days=30)

    def test_new_window_ends_strictly_in_future(self):
        # Guarantees the reset is not immediately re-triggered next read
        # (the re-reset-loop guard).
        _, fresh_period, _ = _import()
        _, end = fresh_period(NOW)
        assert end > NOW

    def test_reset_then_not_resettable_again(self):
        # End-to-end of the two helpers: after opening a fresh window, the same
        # `now` must no longer satisfy should_reset.
        should_reset, fresh_period, _ = _import()
        _, end = fresh_period(NOW)
        assert should_reset(NOW, end) is False

    def test_custom_period_length(self):
        _, fresh_period, _ = _import()
        start, end = fresh_period(NOW, period=timedelta(days=7))
        assert (end - start) == timedelta(days=7)


class TestResetHelperWiring:
    """Smoke-test the DB reset helper's SQL shaping with a fake cursor — no real DB."""

    class _FakeCursor:
        def __init__(self, rowcount=1):
            self.rowcount = rowcount
            self.executed = []

        def execute(self, sql, params):
            self.executed.append((sql, params))

    def test_no_scope_is_a_noop(self):
        import main
        cur = self._FakeCursor()
        assert main._reset_elapsed_usage_periods(cur) == 0
        assert cur.executed == []  # no SQL issued without a scope

    def test_company_scope_filters_to_elapsed_rows(self):
        import main
        cur = self._FakeCursor(rowcount=1)
        n = main._reset_elapsed_usage_periods(cur, company_id="c-1", now=NOW)
        assert n == 1
        sql, params = cur.executed[0]
        assert "messages_used = 0" in sql
        assert "WHERE company_id = %s AND period_end <= %s" in sql
        # new period_start, new period_end (=now+30d), scope value, now-bound.
        assert params[0] == NOW
        assert params[1] == NOW + timedelta(days=30)
        assert params[2] == "c-1"
        assert params[3] == NOW

    def test_user_scope_targets_user_column(self):
        import main
        cur = self._FakeCursor(rowcount=3)
        n = main._reset_elapsed_usage_periods(cur, user_id="u-9", now=NOW)
        assert n == 3
        sql, params = cur.executed[0]
        assert "WHERE user_id = %s AND period_end <= %s" in sql
        assert params[2] == "u-9"

    def test_billing_anchor_within_month_pins_new_period_end(self):
        # Explore monthly: a billing_period_end ~20 days out anchors the reset
        # window to Polar's renewal date instead of a flat now+30.
        import main
        cur = self._FakeCursor(rowcount=1)
        bpe = NOW + timedelta(days=20)
        main._reset_elapsed_usage_periods(cur, company_id="c-1", now=NOW, billing_period_end=bpe)
        _, params = cur.executed[0]
        assert params[1] == bpe  # period_end pinned to Polar billing date

    def test_annual_billing_end_falls_back_to_rolling_window(self):
        # A far-future (annual) billing_period_end must NOT stretch the monthly quota.
        import main
        cur = self._FakeCursor(rowcount=1)
        main._reset_elapsed_usage_periods(
            cur, company_id="c-1", now=NOW, billing_period_end=NOW + timedelta(days=300))
        _, params = cur.executed[0]
        assert params[1] == NOW + timedelta(days=30)


class TestNextPeriodForSubscription:
    def _f(self):
        from usage_period import next_period_for_subscription
        return next_period_for_subscription

    def test_anchors_to_billing_when_within_month(self):
        f = self._f()
        bpe = NOW + timedelta(days=18)
        assert f(NOW, bpe) == (NOW, bpe)

    def test_boundary_31_days_anchors_32_does_not(self):
        f = self._f()
        assert f(NOW, NOW + timedelta(days=31))[1] == NOW + timedelta(days=31)
        assert f(NOW, NOW + timedelta(days=32))[1] == NOW + timedelta(days=30)  # fallback

    def test_none_falls_back_to_rolling(self):
        f = self._f()
        assert f(NOW, None) == (NOW, NOW + timedelta(days=30))

    def test_past_billing_end_falls_back(self):
        # Renewal webhook lagging or a $0 sub that emits no renewal event —
        # never anchor to the past (would re-trigger reset immediately).
        f = self._f()
        assert f(NOW, NOW - timedelta(days=2)) == (NOW, NOW + timedelta(days=30))

    def test_equal_to_now_falls_back(self):
        f = self._f()
        assert f(NOW, NOW) == (NOW, NOW + timedelta(days=30))
