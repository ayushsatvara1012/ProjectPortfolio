"""Tests for the weekly results digest (pure helpers in weekly_digest.py).

Covers the ISO-week dedupe key, recipient resolution (toggle + override +
fallback), lead summarization (counts, top-N ordering, malformed scores), the
empty-week skip, and HTML-injection escaping in the digest email.
"""
from datetime import datetime, timezone

from services.weekly_digest import (
    iso_week_key,
    resolve_digest_recipient,
    summarize_leads,
    should_send_digest,
    build_digest_email,
)


class TestIsoWeekKey:
    def test_format(self):
        assert iso_week_key(datetime(2026, 6, 3, tzinfo=timezone.utc)) == "2026-W23"

    def test_zero_padded(self):
        assert iso_week_key(datetime(2026, 1, 5, tzinfo=timezone.utc)) == "2026-W02"

    def test_stable_within_week(self):
        a = iso_week_key(datetime(2026, 6, 1, tzinfo=timezone.utc))  # Mon
        b = iso_week_key(datetime(2026, 6, 7, tzinfo=timezone.utc))  # Sun
        assert a == b


class TestResolveDigestRecipient:
    def test_defaults_to_owner(self):
        assert resolve_digest_recipient({"owner_email": "o@acme.com"}) == "o@acme.com"

    def test_override_wins(self):
        co = {"weekly_digest_enabled": True, "alert_email": "sales@acme.com",
              "owner_email": "o@acme.com"}
        assert resolve_digest_recipient(co) == "sales@acme.com"

    def test_blank_override_falls_back(self):
        assert resolve_digest_recipient({"alert_email": "  ", "owner_email": "o@acme.com"}) == "o@acme.com"

    def test_disabled_returns_none(self):
        co = {"weekly_digest_enabled": False, "owner_email": "o@acme.com"}
        assert resolve_digest_recipient(co) is None

    def test_no_address_none(self):
        assert resolve_digest_recipient({"weekly_digest_enabled": True}) is None


class TestSummarizeLeads:
    def _leads(self):
        return [
            {"email": "a@x.com", "name": "A", "score": 90, "band": "HOT", "context": "quote"},
            {"email": "b@x.com", "name": "B", "score": 50, "band": "WARM", "context": ""},
            {"email": "c@x.com", "name": "C", "score": 10, "band": "COLD", "context": ""},
            {"email": "d@x.com", "name": "D", "score": 80, "band": "hot", "context": ""},
        ]

    def test_counts(self):
        s = summarize_leads(self._leads())
        assert s["total"] == 4
        assert s["hot"] == 2  # case-insensitive band
        assert s["warm"] == 1
        assert s["cold"] == 1

    def test_top_sorted_desc_and_capped(self):
        many = [{"email": f"{i}@x.com", "name": str(i), "score": i, "band": "WARM"} for i in range(10)]
        s = summarize_leads(many)
        scores = [l["score"] for l in s["top_leads"]]
        assert scores == [9, 8, 7, 6, 5]  # top 5, descending

    def test_empty(self):
        s = summarize_leads([])
        assert s["total"] == 0 and s["top_leads"] == []

    def test_malformed_score_not_crash(self):
        s = summarize_leads([{"email": "a@x.com", "name": "A", "score": None, "band": "WARM"}])
        assert s["total"] == 1


class TestShouldSendDigest:
    def test_skip_empty(self):
        assert should_send_digest(summarize_leads([])) is False

    def test_send_with_activity(self):
        assert should_send_digest(summarize_leads([{"email": "a@x.com", "band": "HOT", "score": 90}])) is True


class TestBuildDigestEmail:
    def _stats(self):
        return summarize_leads([
            {"email": "sam@acme.com", "name": "Sam", "score": 90, "band": "HOT", "context": "need a quote"},
        ])

    def test_subject_has_counts(self):
        subject, _ = build_digest_email("AcmeBot", self._stats(), "Week of Jun 01")
        assert "AcmeBot" in subject
        assert "1 new lead" in subject  # singular
        assert "1 hot" in subject

    def test_body_has_lead_and_period(self):
        _, html = build_digest_email("AcmeBot", self._stats(), "Week of Jun 01 – Jun 08")
        assert "Sam" in html
        assert "need a quote" in html
        assert "Week of Jun 01" in html

    def test_html_injection_escaped(self):
        stats = summarize_leads([
            {"email": "x@x.com", "name": "<script>alert(1)</script>",
             "score": 90, "band": "HOT", "context": "<img src=x onerror=alert(1)>"},
        ])
        _, html = build_digest_email("<b>bad</b>", stats, "wk")
        assert "<script>" not in html
        assert "&lt;script&gt;" in html
        assert "<img src=x" not in html
        assert "&lt;img" in html
        assert "<b>bad</b>" not in html  # bot name escaped too

    def test_plural_subject(self):
        stats = summarize_leads([
            {"email": "a@x.com", "band": "HOT", "score": 90},
            {"email": "b@x.com", "band": "WARM", "score": 50},
        ])
        subject, _ = build_digest_email("Bot", stats, "wk")
        assert "2 new leads" in subject
