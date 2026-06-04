"""Tests for lead source attribution (pure helpers in attribution.py)."""
from attribution import parse_utm, normalize_source, summarize_attribution


class TestParseUtm:
    def test_extracts_all(self):
        u = parse_utm("https://x.com/p?utm_source=google&utm_medium=cpc&utm_campaign=spring")
        assert u == {"utm_source": "google", "utm_medium": "cpc", "utm_campaign": "spring"}

    def test_case_insensitive_key(self):
        assert parse_utm("https://x.com?UTM_SOURCE=Bing")["utm_source"] == "Bing"

    def test_missing_keys_none(self):
        u = parse_utm("https://x.com/p?foo=bar")
        assert u == {"utm_source": None, "utm_medium": None, "utm_campaign": None}

    def test_malformed_and_empty(self):
        assert parse_utm("")["utm_source"] is None
        assert parse_utm(None)["utm_source"] is None
        assert parse_utm("not a url")["utm_source"] is None


class TestNormalizeSource:
    def test_utm_wins(self):
        assert normalize_source("https://google.com", "newsletter") == "newsletter"

    def test_referrer_host_stripped_www(self):
        assert normalize_source("https://www.google.com/search?q=x", None) == "google.com"

    def test_direct_when_nothing(self):
        assert normalize_source(None, None) == "Direct"
        assert normalize_source("", "") == "Direct"

    def test_referrer_without_host(self):
        assert normalize_source("garbage", None) == "Direct"

    def test_utm_lowercased_trimmed(self):
        assert normalize_source(None, "  Google ") == "google"


class TestSummarizeAttribution:
    def _leads(self):
        return [
            {"referrer": "https://www.google.com", "utm_source": None, "status": "won", "value_usd": 1000},
            {"referrer": "https://www.google.com", "utm_source": None, "status": "new", "value_usd": None},
            {"referrer": None, "utm_source": "newsletter", "status": "won", "value_usd": 500},
            {"referrer": None, "utm_source": None, "status": "lost", "value_usd": None},  # Direct
        ]

    def test_buckets_and_revenue(self):
        out = summarize_attribution(self._leads())
        by = {s["source"]: s for s in out["sources"]}
        assert by["google.com"]["leads"] == 2
        assert by["google.com"]["won"] == 1 and by["google.com"]["won_value"] == 1000.0
        assert by["newsletter"]["won_value"] == 500.0
        assert by["Direct"]["leads"] == 1 and by["Direct"]["won"] == 0
        assert out["total_leads"] == 4
        assert out["total_sources"] == 3

    def test_sorted_by_volume(self):
        out = summarize_attribution(self._leads())
        assert out["sources"][0]["source"] == "google.com"  # 2 leads, most

    def test_win_rate(self):
        out = summarize_attribution(self._leads())
        by = {s["source"]: s for s in out["sources"]}
        assert by["google.com"]["win_rate"] == 0.5   # 1 of 2
        assert by["newsletter"]["win_rate"] == 1.0

    def test_value_ignored_for_non_won(self):
        out = summarize_attribution([
            {"referrer": None, "utm_source": "ig", "status": "contacted", "value_usd": 9999},
        ])
        assert out["sources"][0]["won_value"] == 0.0

    def test_limit(self):
        out = summarize_attribution(self._leads(), limit=1)
        assert len(out["sources"]) == 1
        assert out["total_sources"] == 3  # total reflects full set

    def test_empty(self):
        out = summarize_attribution([])
        assert out == {"sources": [], "total_leads": 0, "total_sources": 0}
