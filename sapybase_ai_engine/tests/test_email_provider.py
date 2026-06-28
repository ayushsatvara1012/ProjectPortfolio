"""Tests for the transactional email transport selection + payload shaping.

Network sends (_send_via_resend / _send_via_smtp) are not exercised here — only
the pure provider-selection and Resend payload logic, plus the no-op guards in
send_transactional_email (which must never raise or attempt a send when
unconfigured).
"""
from services.email_provider import (
    resolve_email_provider,
    build_resend_payload,
    email_from_header,
    send_transactional_email,
)


class TestResolveEmailProvider:
    def test_resend_when_key_present(self):
        assert resolve_email_provider({"RESEND_API_KEY": "re_123"}) == "resend"

    def test_resend_wins_over_smtp(self):
        env = {"RESEND_API_KEY": "re_1", "SMTP_USER": "a@b.com", "SMTP_PASS": "x"}
        assert resolve_email_provider(env) == "resend"

    def test_smtp_when_both_creds(self):
        assert resolve_email_provider({"SMTP_USER": "a@b.com", "SMTP_PASS": "x"}) == "smtp"

    def test_none_when_partial_smtp(self):
        assert resolve_email_provider({"SMTP_USER": "a@b.com"}) is None
        assert resolve_email_provider({"SMTP_PASS": "x"}) is None

    def test_none_when_empty(self):
        assert resolve_email_provider({}) is None

    def test_blank_values_ignored(self):
        assert resolve_email_provider({"RESEND_API_KEY": "   "}) is None
        assert resolve_email_provider({"SMTP_USER": " ", "SMTP_PASS": " "}) is None


class TestBuildResendPayload:
    def test_core_fields(self):
        p = build_resend_payload("Sapybase <a@b.com>", "to@x.com", "Subj", "<p>hi</p>")
        assert p["from"] == "Sapybase <a@b.com>"
        assert p["to"] == ["to@x.com"]  # Resend expects a list
        assert p["subject"] == "Subj"
        assert p["html"] == "<p>hi</p>"
        assert "reply_to" not in p

    def test_reply_to_included_when_given(self):
        p = build_resend_payload("a@b.com", "to@x.com", "S", "<p>x</p>", reply_to="lead@y.com")
        assert p["reply_to"] == "lead@y.com"

    def test_reply_to_omitted_when_falsy(self):
        p = build_resend_payload("a@b.com", "to@x.com", "S", "<p>x</p>", reply_to="")
        assert "reply_to" not in p


class TestEmailFromHeader:
    def test_default_name(self, monkeypatch):
        monkeypatch.delenv("EMAIL_FROM_NAME", raising=False)
        assert email_from_header("a@b.com") == "Sapybase <a@b.com>"

    def test_custom_name(self, monkeypatch):
        monkeypatch.setenv("EMAIL_FROM_NAME", "Acme")
        assert email_from_header("a@b.com") == "Acme <a@b.com>"


class TestSendGuards:
    def test_no_recipient_returns_false(self, monkeypatch):
        monkeypatch.setenv("RESEND_API_KEY", "re_1")
        # Empty recipient must short-circuit before any provider call.
        assert send_transactional_email("", "S", "<p>x</p>") is False

    def test_no_provider_returns_false(self, monkeypatch):
        monkeypatch.delenv("RESEND_API_KEY", raising=False)
        monkeypatch.delenv("SMTP_USER", raising=False)
        monkeypatch.delenv("SMTP_PASS", raising=False)
        assert send_transactional_email("to@x.com", "S", "<p>x</p>") is False
