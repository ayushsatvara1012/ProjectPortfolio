"""Tests for Slack lead handoff (pure helpers in slack_handoff.py).

Covers the SSRF-guard URL allow-list and the Slack message builder, including
mrkdwn escaping of visitor-supplied fields, band emoji selection, and graceful
handling of missing data.
"""
import json

from slack_handoff import is_valid_slack_webhook, build_slack_lead_message


class TestIsValidSlackWebhook:
    def test_valid(self):
        assert is_valid_slack_webhook("https://hooks.slack.com/services/T/B/x") is True

    def test_strips_whitespace(self):
        assert is_valid_slack_webhook("  https://hooks.slack.com/services/T/B/x  ") is True

    def test_rejects_other_hosts(self):
        assert is_valid_slack_webhook("https://evil.com/hook") is False
        assert is_valid_slack_webhook("https://hooks.slack.com.evil.com/x") is False

    def test_rejects_internal_ssrf_targets(self):
        assert is_valid_slack_webhook("http://169.254.169.254/latest/meta-data") is False
        assert is_valid_slack_webhook("http://localhost:8000/admin") is False
        assert is_valid_slack_webhook("file:///etc/passwd") is False

    def test_rejects_http_slack(self):
        # must be https
        assert is_valid_slack_webhook("http://hooks.slack.com/services/x") is False

    def test_none_and_non_str_safe(self):
        assert is_valid_slack_webhook(None) is False
        assert is_valid_slack_webhook(123) is False
        assert is_valid_slack_webhook("") is False


class TestBuildSlackLeadMessage:
    def _lead(self, **kw):
        base = {"email": "sam@acme.com", "name": "Sam", "context": "need a quote",
                "score": 90, "band": "HOT"}
        base.update(kw)
        return base

    def test_has_text_and_blocks(self):
        msg = build_slack_lead_message("AcmeBot", self._lead())
        assert "text" in msg and "blocks" in msg
        assert len(msg["blocks"]) == 2
        # round-trips as JSON (what _fire_slack serializes)
        json.dumps(msg)

    def test_content_present(self):
        msg = build_slack_lead_message("AcmeBot", self._lead())
        blob = json.dumps(msg)
        assert "Sam" in blob
        assert "sam@acme.com" in blob
        assert "need a quote" in blob
        assert "90/100" in blob
        assert "AcmeBot" in blob

    def test_band_emoji_hot(self):
        msg = build_slack_lead_message("AcmeBot", self._lead(band="HOT"))
        assert "🔥" in json.dumps(msg, ensure_ascii=False)

    def test_band_emoji_unknown_default(self):
        msg = build_slack_lead_message("AcmeBot", self._lead(band=""))
        assert "📥" in json.dumps(msg, ensure_ascii=False)

    def test_mrkdwn_injection_escaped(self):
        lead = self._lead(name="<!channel>", context="a & b <fake>")
        blob = json.dumps(build_slack_lead_message("AcmeBot", lead))
        assert "<!channel>" not in blob
        assert "&lt;!channel&gt;" in blob
        assert "&amp;" in blob

    def test_missing_email_and_context(self):
        msg = build_slack_lead_message("AcmeBot", self._lead(email=None, context=None))
        blob = json.dumps(msg)
        assert "Sam" in blob  # name still shown
        assert "mailto" not in blob

    def test_missing_score_dash(self):
        msg = build_slack_lead_message("AcmeBot", self._lead(score=None))
        assert "—" in json.dumps(msg, ensure_ascii=False)

    def test_anonymous_when_no_name_or_email(self):
        msg = build_slack_lead_message("AcmeBot", self._lead(name=None, email=None))
        assert "A visitor" in json.dumps(msg)
