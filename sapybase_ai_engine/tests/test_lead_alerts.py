"""Tests for instant HOT-lead alerting (pure helpers in lead_alerts.py).

Covers the alert gate and the email builder, including HTML-injection escaping
of visitor-supplied fields and graceful handling of missing data.
"""
from lead_alerts import (
    should_alert_hot_lead,
    build_hot_lead_email,
    resolve_alert_recipient,
)


class TestResolveAlertRecipient:
    def test_defaults_to_owner_email(self):
        # Toggle absent -> treated as enabled (existing customers keep alerts).
        assert resolve_alert_recipient({"owner_email": "owner@acme.com"}) == "owner@acme.com"

    def test_explicit_enabled_uses_owner_email(self):
        co = {"hot_lead_alerts_enabled": True, "owner_email": "owner@acme.com"}
        assert resolve_alert_recipient(co) == "owner@acme.com"

    def test_override_takes_precedence(self):
        co = {"hot_lead_alerts_enabled": True, "alert_email": "sales@acme.com",
              "owner_email": "owner@acme.com"}
        assert resolve_alert_recipient(co) == "sales@acme.com"

    def test_blank_override_falls_back_to_owner(self):
        co = {"alert_email": "   ", "owner_email": "owner@acme.com"}
        assert resolve_alert_recipient(co) == "owner@acme.com"

    def test_disabled_returns_none_even_with_emails(self):
        co = {"hot_lead_alerts_enabled": False, "alert_email": "sales@acme.com",
              "owner_email": "owner@acme.com"}
        assert resolve_alert_recipient(co) is None

    def test_no_addresses_returns_none(self):
        assert resolve_alert_recipient({"hot_lead_alerts_enabled": True}) is None
        assert resolve_alert_recipient({"owner_email": None, "alert_email": None}) is None


class TestShouldAlertHotLead:
    def test_hot_triggers(self):
        assert should_alert_hot_lead("HOT") is True

    def test_warm_and_cold_do_not(self):
        assert should_alert_hot_lead("WARM") is False
        assert should_alert_hot_lead("COLD") is False

    def test_case_insensitive(self):
        assert should_alert_hot_lead("hot") is True

    def test_none_and_garbage_safe(self):
        assert should_alert_hot_lead(None) is False
        assert should_alert_hot_lead("") is False
        assert should_alert_hot_lead(123) is False


class TestBuildHotLeadEmail:
    def _lead(self, **kw):
        base = {"email": "sam@acme.com", "name": "Sam", "context": "need a quote",
                "score": 80, "reasons": ["buying intent (quote)", "business email (acme.com)"]}
        base.update(kw)
        return base

    def test_subject_has_score_and_identity(self):
        subject, _ = build_hot_lead_email("AcmeBot", self._lead())
        assert "80/100" in subject
        assert "Sam" in subject

    def test_body_contains_email_reasons_context(self):
        _, html = build_hot_lead_email("AcmeBot", self._lead())
        assert "sam@acme.com" in html
        assert "buying intent (quote)" in html
        assert "need a quote" in html
        assert "AcmeBot" in html

    def test_missing_name_falls_back_to_email(self):
        subject, html = build_hot_lead_email("AcmeBot", self._lead(name=None))
        assert "sam@acme.com" in subject
        assert "<b>Name:</b>" not in html  # name block omitted

    def test_missing_email_and_context_handled(self):
        subject, html = build_hot_lead_email("AcmeBot", self._lead(email=None, context=None))
        assert "No email provided" in html
        assert "What they said" not in html
        assert subject  # still produces a subject

    def test_missing_score_renders_dash(self):
        subject, html = build_hot_lead_email("AcmeBot", self._lead(score=None))
        assert "—/100" not in html  # malformed; uses em-dash placeholder
        assert "—" in html

    def test_html_injection_in_name_is_escaped(self):
        lead = self._lead(name="<script>alert(1)</script>")
        _, html = build_hot_lead_email("AcmeBot", lead)
        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    def test_html_injection_in_context_is_escaped(self):
        lead = self._lead(context="<img src=x onerror=alert(1)>")
        _, html = build_hot_lead_email("AcmeBot", lead)
        assert "<img" not in html
        assert "&lt;img" in html

    def test_reasons_accepts_string(self):
        _, html = build_hot_lead_email("AcmeBot", self._lead(reasons="single reason"))
        assert "single reason" in html

    def test_empty_reasons_no_list(self):
        _, html = build_hot_lead_email("AcmeBot", self._lead(reasons=[]))
        assert "<ul" not in html
