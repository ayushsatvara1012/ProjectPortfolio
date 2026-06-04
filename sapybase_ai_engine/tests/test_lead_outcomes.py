"""Tests for lead outcome / pipeline analytics (pure helpers in lead_outcomes.py).

Covers status normalization, the won-only value rule, and the pipeline summary
math (counts, realized revenue, win rate, conversion rate, averages), plus
edge cases: empty input, unknown statuses, malformed values.
"""
from decimal import Decimal

from lead_outcomes import (
    LEAD_STATUSES,
    normalize_status,
    is_valid_status,
    resolve_outcome_value,
    summarize_pipeline,
)


class TestNormalizeStatus:
    def test_valid(self):
        for s in LEAD_STATUSES:
            assert normalize_status(s) == s

    def test_case_and_whitespace(self):
        assert normalize_status("  WON ") == "won"
        assert normalize_status("Contacted") == "contacted"

    def test_invalid(self):
        assert normalize_status("closed") is None
        assert normalize_status("") is None
        assert normalize_status(None) is None
        assert normalize_status(123) is None

    def test_is_valid_status(self):
        assert is_valid_status("won") is True
        assert is_valid_status("nope") is False


class TestResolveOutcomeValue:
    def test_won_keeps_value(self):
        assert resolve_outcome_value("won", 1200) == 1200.0
        assert resolve_outcome_value("won", Decimal("99.50")) == 99.5

    def test_non_won_clears_value(self):
        assert resolve_outcome_value("contacted", 500) is None
        assert resolve_outcome_value("lost", 999) is None
        assert resolve_outcome_value("new", 100) is None

    def test_won_with_bad_value(self):
        assert resolve_outcome_value("won", None) == 0.0
        assert resolve_outcome_value("won", "abc") == 0.0
        assert resolve_outcome_value("won", -50) == 0.0


class TestSummarizePipeline:
    def _leads(self):
        return [
            {"status": "new", "value_usd": None},
            {"status": "contacted", "value_usd": None},
            {"status": "won", "value_usd": 1000},
            {"status": "won", "value_usd": Decimal("500.00")},
            {"status": "lost", "value_usd": None},
        ]

    def test_counts(self):
        s = summarize_pipeline(self._leads())
        assert s["total"] == 5
        assert s["new"] == 1 and s["contacted"] == 1
        assert s["won"] == 2 and s["lost"] == 1
        assert s["open"] == 2 and s["closed"] == 3

    def test_realized_revenue_and_avg(self):
        s = summarize_pipeline(self._leads())
        assert s["realized_revenue"] == 1500.0
        assert s["avg_deal_value"] == 750.0

    def test_rates(self):
        s = summarize_pipeline(self._leads())
        # win_rate = won / closed = 2/3; conversion = won / total = 2/5
        assert s["win_rate"] == round(2 / 3, 4)
        assert s["conversion_rate"] == 0.4

    def test_empty(self):
        s = summarize_pipeline([])
        assert s["total"] == 0
        assert s["realized_revenue"] == 0.0
        assert s["win_rate"] == 0.0 and s["conversion_rate"] == 0.0
        assert s["avg_deal_value"] == 0.0

    def test_unknown_status_bucketed_as_new(self):
        s = summarize_pipeline([{"status": "weird", "value_usd": None},
                                {"status": None, "value_usd": None}])
        assert s["new"] == 2
        assert s["total"] == 2

    def test_won_with_missing_value_counts_zero_revenue(self):
        s = summarize_pipeline([{"status": "won", "value_usd": None}])
        assert s["won"] == 1
        assert s["realized_revenue"] == 0.0
        assert s["avg_deal_value"] == 0.0

    def test_value_ignored_for_non_won(self):
        # A stray value on a non-won lead must not inflate realized revenue.
        s = summarize_pipeline([{"status": "lost", "value_usd": 9999}])
        assert s["realized_revenue"] == 0.0
