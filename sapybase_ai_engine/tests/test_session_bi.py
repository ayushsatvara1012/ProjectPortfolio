"""Tests for services/session_bi.py (Phase 3 — pure analytics)."""

import pytest
from services.session_bi import (
    build_demand_signal,
    build_stage_funnel,
    build_lost_sales,
    build_lead_quality,
    STAGE_ORDER,
)


# ── build_demand_signal ───────────────────────────────────────────────────────

class TestBuildDemandSignal:
    def test_empty(self):
        assert build_demand_signal([]) == []

    def test_none(self):
        assert build_demand_signal(None) == []

    def test_basic_ranking(self):
        rows = [
            {"product_name": "Ethanol", "grade": "Absolute", "session_count": 5},
            {"product_name": "Ethanol", "grade": "Denatured", "session_count": 3},
            {"product_name": "Toluene", "grade": None, "session_count": 8},
        ]
        result = build_demand_signal(rows)
        assert result[0]["product"] == "Toluene"
        assert result[0]["sessions"] == 8
        assert result[1]["product"] == "Ethanol"
        assert result[1]["grade"] == "Absolute"

    def test_deduplication_accumulates(self):
        rows = [
            {"product_name": "IPA", "grade": "99%", "session_count": 4},
            {"product_name": "IPA", "grade": "99%", "session_count": 6},
        ]
        result = build_demand_signal(rows)
        assert len(result) == 1
        assert result[0]["sessions"] == 10

    def test_top_n_cap(self):
        rows = [
            {"product_name": f"P{i}", "grade": None, "session_count": i}
            for i in range(1, 20)
        ]
        result = build_demand_signal(rows, top_n=5)
        assert len(result) == 5
        assert result[0]["sessions"] == 19

    def test_skips_blank_names(self):
        rows = [
            {"product_name": "", "grade": None, "session_count": 10},
            {"product_name": "Acetone", "grade": None, "session_count": 2},
        ]
        result = build_demand_signal(rows)
        assert len(result) == 1
        assert result[0]["product"] == "Acetone"


# ── build_stage_funnel ────────────────────────────────────────────────────────

class TestBuildStageFunnel:
    def test_empty(self):
        result = build_stage_funnel({})
        assert all(s["count"] == 0 for s in result)
        assert all(s["pct_of_top"] == 0.0 for s in result)

    def test_correct_stage_count(self):
        result = build_stage_funnel({"browsing": 10})
        # handed_off is merged into captured, so display = 5 stages
        assert len(result) == 5

    def test_pct_of_top(self):
        counts = {"browsing": 100, "qualifying": 50, "recommended": 25, "quoted": 10}
        result = build_stage_funnel(counts)
        by_stage = {s["stage"]: s for s in result}
        assert by_stage["browsing"]["pct_of_top"] == 100.0
        assert by_stage["qualifying"]["pct_of_top"] == 50.0
        assert by_stage["recommended"]["pct_of_top"] == 25.0
        assert by_stage["quoted"]["pct_of_top"] == 10.0

    def test_handed_off_merged_into_captured(self):
        counts = {"captured": 5, "handed_off": 3}
        result = build_stage_funnel(counts)
        by_stage = {s["stage"]: s for s in result}
        assert by_stage["captured"]["count"] == 8
        assert "handed_off" not in by_stage

    def test_pct_capped_at_100(self):
        # More captured than browsing (data inconsistency) should clamp.
        counts = {"browsing": 5, "captured": 20}
        result = build_stage_funnel(counts)
        by_stage = {s["stage"]: s for s in result}
        assert by_stage["captured"]["pct_of_top"] == 100.0


# ── build_lost_sales ──────────────────────────────────────────────────────────

class TestBuildLostSales:
    def test_zeros(self):
        r = build_lost_sales(0, 0)
        assert r == {"total": 0, "por_escalations": 0, "quoted_not_captured": 0}

    def test_sums(self):
        r = build_lost_sales(3, 7)
        assert r["total"] == 10
        assert r["por_escalations"] == 3
        assert r["quoted_not_captured"] == 7

    def test_negative_floored(self):
        r = build_lost_sales(-2, -5)
        assert r["total"] == 0


# ── build_lead_quality ────────────────────────────────────────────────────────

class TestBuildLeadQuality:
    def test_empty(self):
        r = build_lead_quality({})
        assert r["total_scored"] == 0
        assert all(b["count"] == 0 for b in r["bands"])

    def test_case_insensitive(self):
        r = build_lead_quality({"HOT": 2, "Warm": 3, "COLD": 5})
        by_band = {b["band"]: b for b in r["bands"]}
        assert by_band["hot"]["count"] == 2
        assert by_band["warm"]["count"] == 3
        assert by_band["cold"]["count"] == 5
        assert r["total_scored"] == 10

    def test_unknown_bands_ignored(self):
        r = build_lead_quality({"hot": 4, "unknown": 99})
        assert r["total_scored"] == 4

    def test_pct(self):
        r = build_lead_quality({"hot": 1, "warm": 3})
        by_band = {b["band"]: b for b in r["bands"]}
        assert by_band["hot"]["pct"] == 25.0
        assert by_band["warm"]["pct"] == 75.0
        assert by_band["cold"]["pct"] == 0.0
