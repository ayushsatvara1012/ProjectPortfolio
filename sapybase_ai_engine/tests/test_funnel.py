"""Tests for conversion-funnel analytics (pure helpers in funnel.py).

Covers nested-funnel math (conversion, drop-off, overall), and the edge cases
that would otherwise render nonsense: empty input, a zero top stage, the
data-quirk inversion (a stage larger than the one above it), and the
quality breakdown with unknown/None bands.
"""
from funnel import (
    FUNNEL_STAGES,
    build_funnel,
    build_quality_breakdown,
)


class TestBuildFunnel:
    def _counts(self):
        return {"conversations": 100, "leads": 40, "contacted": 20, "won": 10}

    def test_stage_order_and_counts(self):
        f = build_funnel(self._counts())
        assert [s["key"] for s in f["stages"]] == [k for k, _ in FUNNEL_STAGES]
        assert [s["count"] for s in f["stages"]] == [100, 40, 20, 10]
        assert f["top"] == 100 and f["won"] == 10

    def test_conversion_and_dropoff(self):
        f = build_funnel(self._counts())
        s = {x["key"]: x for x in f["stages"]}
        # leads: 40/100 of top, 40% of prev, 60% drop
        assert s["leads"]["pct_of_top"] == 40.0
        assert s["leads"]["pct_of_prev"] == 40.0
        assert s["leads"]["dropoff_pct"] == 60.0
        # contacted: 20/40 = 50% of prev
        assert s["contacted"]["pct_of_prev"] == 50.0
        # won: 10/20 = 50% of prev, 10/100 = 10% of top
        assert s["won"]["pct_of_prev"] == 50.0
        assert s["won"]["pct_of_top"] == 10.0
        assert f["overall_conversion"] == 10.0

    def test_top_stage_first_pct(self):
        f = build_funnel(self._counts())
        top = f["stages"][0]
        assert top["pct_of_top"] == 100.0
        assert top["pct_of_prev"] == 100.0
        assert top["dropoff_pct"] == 0.0

    def test_empty(self):
        f = build_funnel({})
        assert f["top"] == 0 and f["won"] == 0
        assert f["overall_conversion"] == 0.0
        for s in f["stages"]:
            assert s["count"] == 0
            assert s["pct_of_top"] == 0.0
            assert s["dropoff_pct"] == 0.0

    def test_zero_top_with_lower_stages(self):
        # No conversations recorded but leads exist (e.g. legacy NULL session_id).
        f = build_funnel({"conversations": 0, "leads": 5, "contacted": 2, "won": 1})
        # Must not divide by zero or emit >100% / negative values.
        for s in f["stages"]:
            assert 0.0 <= s["pct_of_top"] <= 100.0
            assert 0.0 <= s["pct_of_prev"] <= 100.0
            assert s["dropoff_pct"] >= 0.0

    def test_inversion_is_clamped(self):
        # leads > conversations (data quirk): conversion capped, drop floored.
        f = build_funnel({"conversations": 10, "leads": 25, "contacted": 5, "won": 1})
        leads = next(s for s in f["stages"] if s["key"] == "leads")
        assert leads["pct_of_prev"] == 100.0
        assert leads["dropoff_pct"] == 0.0
        assert leads["pct_of_top"] == 100.0

    def test_negative_or_garbage_counts_coerced(self):
        f = build_funnel({"conversations": -5, "leads": "x", "contacted": None, "won": 3})
        counts = [s["count"] for s in f["stages"]]
        assert counts == [0, 0, 0, 3]


class TestQualityBreakdown:
    def test_basic_shares(self):
        q = build_quality_breakdown({"HOT": 2, "WARM": 6, "COLD": 2})
        assert q["total_scored"] == 10
        bands = {b["band"]: b for b in q["bands"]}
        assert bands["hot"]["pct"] == 20.0
        assert bands["warm"]["count"] == 6 and bands["warm"]["pct"] == 60.0
        assert [b["band"] for b in q["bands"]] == ["hot", "warm", "cold"]

    def test_case_insensitive_and_unknown_ignored(self):
        q = build_quality_breakdown({"hot": 1, "Warm": 1, "unscored": 9, None: 3})
        assert q["total_scored"] == 2  # only hot+warm count

    def test_empty(self):
        q = build_quality_breakdown({})
        assert q["total_scored"] == 0
        assert all(b["count"] == 0 and b["pct"] == 0.0 for b in q["bands"])
