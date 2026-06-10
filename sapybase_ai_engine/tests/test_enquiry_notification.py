"""Tests for the new-enquiry notification pipeline (Explore §6, Phase C3-lite)."""
import pytest


def _main():
    import main
    return main


class TestSuperAdminEmails:
    def test_parses_comma_list(self, monkeypatch):
        m = _main()
        monkeypatch.setenv("ADMIN_EMAILS", " a@x.com , b@y.com ")
        assert m._super_admin_emails() == ["a@x.com", "b@y.com"]

    def test_falls_back_to_singular_envs(self, monkeypatch):
        m = _main()
        monkeypatch.delenv("ADMIN_EMAILS", raising=False)
        monkeypatch.delenv("ADMIN_EMAIL", raising=False)
        monkeypatch.setenv("SUPER_ADMIN_EMAIL", "admin@vaayu.com")
        assert m._super_admin_emails() == ["admin@vaayu.com"]

    def test_empty_when_unset(self, monkeypatch):
        m = _main()
        for k in ("ADMIN_EMAILS", "ADMIN_EMAIL", "SUPER_ADMIN_EMAIL"):
            monkeypatch.delenv(k, raising=False)
        assert m._super_admin_emails() == []


class TestSendNotification:
    def test_noop_without_recipients(self, monkeypatch):
        # No admin email configured → silently returns, never raises, never sends.
        m = _main()
        for k in ("ADMIN_EMAILS", "ADMIN_EMAIL", "SUPER_ADMIN_EMAIL"):
            monkeypatch.delenv(k, raising=False)
        sent = []
        monkeypatch.setattr(m, "send_transactional_email",
                            lambda *a, **k: sent.append(a) or True)
        assert m._send_enquiry_notification({"email": "x@y.com"}) is None
        assert sent == []

    def test_sends_to_first_admin_with_escaped_payload(self, monkeypatch):
        m = _main()
        monkeypatch.setenv("ADMIN_EMAILS", "admin@vaayu.com,second@vaayu.com")
        captured = {}

        def fake_send(to, subject, body, **kw):
            captured.update(to=to, subject=subject, body=body)
            return True

        monkeypatch.setattr(m, "send_transactional_email", fake_send)
        m._send_enquiry_notification({
            "email": "user@gmail.com",
            "name": "<script>alert(1)</script>",  # must be escaped in the HTML body
            "company_name": "Acme",
            "use_case": "support bot",
            "email_class": "personal",
        })
        assert captured["to"] == "admin@vaayu.com"          # first recipient only
        assert "user@gmail.com" in captured["subject"]
        assert "<script>" not in captured["body"]            # escaped
        assert "&lt;script&gt;" in captured["body"]
