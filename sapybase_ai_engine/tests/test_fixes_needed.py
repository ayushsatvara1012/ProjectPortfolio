"""
Tests for the 'fixes needed' worklist (Track 3 item 11).

Covers the pure _build_fixes_list classification/ordering/filtering helper, which
turns aggregated chat_logs rows into a deduplicated, prioritized gap worklist.

Row shape (matches what the endpoint feeds it):
    (representative_query, ask_count, last_asked_iso, group_confidence, has_unanswered)
"""
import main


def _row(query, ask_count, last_asked, group_conf, has_unanswered):
    return (query, ask_count, last_asked, group_conf, has_unanswered)


# ── Classification ───────────────────────────────────────────────────────────

class TestClassification:
    def test_unanswered_is_flagged(self):
        out = main._build_fixes_list([_row("how do refunds work", 3, "2026-06-01", None, True)])
        assert len(out) == 1
        assert out[0]["category"] == "unanswered"

    def test_low_confidence_is_flagged(self):
        out = main._build_fixes_list([_row("shipping time?", 2, "2026-06-01", 0.2, False)],
                                     min_confidence=0.4)
        assert len(out) == 1
        assert out[0]["category"] == "low_confidence"
        assert out[0]["confidence"] == 0.2

    def test_well_answered_is_excluded(self):
        out = main._build_fixes_list([_row("store hours", 5, "2026-06-01", 0.9, False)],
                                     min_confidence=0.4)
        assert out == []

    def test_null_confidence_never_flagged(self):
        # Cache hits / pre-migration rows have unknown grounding -> never a false flag.
        out = main._build_fixes_list([_row("hi there", 10, "2026-06-01", None, False)],
                                     min_confidence=0.4)
        assert out == []

    def test_unanswered_takes_priority_over_confidence(self):
        # Even with a decent avg confidence, any fallback in the group => unanswered.
        out = main._build_fixes_list([_row("returns policy", 4, "2026-06-01", 0.8, True)])
        assert out[0]["category"] == "unanswered"


# ── Threshold boundary ───────────────────────────────────────────────────────

class TestThreshold:
    def test_exactly_at_threshold_is_not_flagged(self):
        # strict < threshold; equal means acceptable.
        out = main._build_fixes_list([_row("q", 1, "2026-06-01", 0.4, False)],
                                     min_confidence=0.4)
        assert out == []

    def test_just_below_threshold_is_flagged(self):
        out = main._build_fixes_list([_row("q", 1, "2026-06-01", 0.39, False)],
                                     min_confidence=0.4)
        assert len(out) == 1
        assert out[0]["category"] == "low_confidence"

    def test_custom_threshold_respected(self):
        rows = [_row("q", 1, "2026-06-01", 0.5, False)]
        assert main._build_fixes_list(rows, min_confidence=0.4) == []
        assert len(main._build_fixes_list(rows, min_confidence=0.6)) == 1


# ── Empty / malformed queries ────────────────────────────────────────────────

class TestQuerySanitation:
    def test_empty_query_skipped(self):
        out = main._build_fixes_list([_row("", 3, "2026-06-01", None, True)])
        assert out == []

    def test_whitespace_only_query_skipped(self):
        out = main._build_fixes_list([_row("   ", 3, "2026-06-01", None, True)])
        assert out == []

    def test_none_query_skipped(self):
        out = main._build_fixes_list([_row(None, 3, "2026-06-01", None, True)])
        assert out == []

    def test_query_is_trimmed(self):
        out = main._build_fixes_list([_row("  refund?  ", 1, "2026-06-01", None, True)])
        assert out[0]["query"] == "refund?"


# ── Ordering ─────────────────────────────────────────────────────────────────

class TestOrdering:
    def test_unanswered_sorts_before_low_confidence(self):
        rows = [
            _row("low conf", 99, "2026-06-01", 0.1, False),   # high count but low_confidence
            _row("unanswered", 1, "2026-01-01", None, True),  # low count but unanswered
        ]
        out = main._build_fixes_list(rows)
        assert out[0]["query"] == "unanswered"
        assert out[1]["query"] == "low conf"

    def test_within_category_sorts_by_ask_count_desc(self):
        rows = [
            _row("rare", 2, "2026-06-01", None, True),
            _row("common", 50, "2026-05-01", None, True),
        ]
        out = main._build_fixes_list(rows)
        assert [it["query"] for it in out] == ["common", "rare"]

    def test_tie_broken_by_last_asked_desc(self):
        rows = [
            _row("older", 5, "2026-05-01", None, True),
            _row("newer", 5, "2026-06-01", None, True),
        ]
        out = main._build_fixes_list(rows)
        assert [it["query"] for it in out] == ["newer", "older"]

    def test_none_last_asked_does_not_crash_ordering(self):
        rows = [
            _row("a", 5, None, None, True),
            _row("b", 5, "2026-06-01", None, True),
        ]
        out = main._build_fixes_list(rows)
        # 'b' (real date) should outrank 'a' (None treated as "").
        assert out[0]["query"] == "b"


# ── Limit & shape ────────────────────────────────────────────────────────────

class TestLimitAndShape:
    def test_limit_is_applied(self):
        rows = [_row(f"q{i}", i, "2026-06-01", None, True) for i in range(100)]
        out = main._build_fixes_list(rows, limit=10)
        assert len(out) == 10

    def test_row_shape_has_expected_keys(self):
        out = main._build_fixes_list([_row("q", 3, "2026-06-01", 0.2, False)])
        assert set(out[0].keys()) == {"query", "ask_count", "last_asked", "confidence", "category"}

    def test_ask_count_coerced_to_int(self):
        out = main._build_fixes_list([_row("q", None, "2026-06-01", None, True)])
        assert out[0]["ask_count"] == 0

    def test_confidence_rounded_two_dp(self):
        out = main._build_fixes_list([_row("q", 1, "2026-06-01", 0.33333, False)],
                                     min_confidence=0.4)
        assert out[0]["confidence"] == 0.33

    def test_empty_input_returns_empty(self):
        assert main._build_fixes_list([]) == []
