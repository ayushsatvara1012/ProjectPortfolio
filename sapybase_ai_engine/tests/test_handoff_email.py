"""Security test for the human-handoff transcript email (main._send_handoff_email).

Visitor-controlled chat content, bot name, and visitor identity are interpolated
into the owner-facing email HTML. Phase 1.1 of the chemical-agent hardening plan:
those strings must be HTML-escaped so a visitor cannot inject markup / links into
a trusted email. The email subject is plain text and must stay unescaped.
"""
import asyncio

import main


def _run(coro):
    return asyncio.run(coro)


def _capture_email(monkeypatch):
    """Patch the transactional sender and return a dict the call fills in."""
    captured = {}

    def _fake_send(owner_email, subject, html, reply_to=None):
        captured.update(owner_email=owner_email, subject=subject,
                        html=html, reply_to=reply_to)

    monkeypatch.setattr(main, "send_transactional_email", _fake_send)
    return captured


def test_transcript_content_is_html_escaped(monkeypatch):
    captured = _capture_email(monkeypatch)
    transcript = [
        {"role": "user", "content": "<script>alert(1)</script><a href='http://evil'>x</a>"},
        {"role": "bot", "content": "Sure & thanks"},
    ]
    _run(main._send_handoff_email("owner@acme.com", "ChemBot", transcript,
                                  visitor_email="v@x.com", visitor_name="Vic"))

    html = captured["html"]
    # The visitor's raw tags must never survive into the email body.
    assert "<script>" not in html
    assert "<a href" not in html
    assert "&lt;script&gt;" in html
    assert "&amp; thanks" in html


def test_bot_name_and_visitor_identity_are_escaped(monkeypatch):
    captured = _capture_email(monkeypatch)
    _run(main._send_handoff_email(
        "owner@acme.com",
        "<img src=x onerror=alert(1)>",
        [{"role": "user", "content": "hi"}],
        visitor_email="v@x.com",
        visitor_name="<b>Mallory</b>",
    ))

    html = captured["html"]
    assert "<img src=x" not in html
    assert "<b>Mallory</b>" not in html
    assert "&lt;img" in html and "&lt;b&gt;Mallory" in html


def test_valid_reply_to_accepts_well_shaped_email():
    assert main._valid_reply_to("asha@acme.com") == "asha@acme.com"
    assert main._valid_reply_to("  a.b+tag@sub.example.co  ") == "a.b+tag@sub.example.co"


def test_valid_reply_to_rejects_malformed_or_injection():
    # Phase 2.5: a model-supplied contact that isn't a clean address never becomes
    # a reply_to header (no @, header-injection newline, junk → None).
    for bad in (None, "", "not-an-email", "a@b", "a b@c.com",
                "x@y.com\r\nBcc: evil@z.com", "@no-local.com", 123, "a" * 300 + "@x.com"):
        assert main._valid_reply_to(bad) is None


def test_captured_contact_echo_cleans_and_gates():
    # Phase 2.5: the widget-echo contact is validated (bad email dropped) and only
    # returned when something usable was captured.
    assert main._captured_contact_echo(
        {"contact_email": "a@b.com", "contact_name": "Asha", "contact_phone": None}
    ) == {"name": "Asha", "email": "a@b.com", "phone": None}
    # Invalid email dropped, but a phone still yields an echo.
    got = main._captured_contact_echo({"contact_email": "nope", "contact_phone": "+91 99"})
    assert got is not None and got["email"] is None and got["phone"] == "+91 99"
    # Nothing usable → no echo card.
    assert main._captured_contact_echo({"contact_email": "nope", "contact_name": "X"}) is None
    assert main._captured_contact_echo({}) is None


def test_subject_is_plain_text_not_escaped(monkeypatch):
    captured = _capture_email(monkeypatch)
    _run(main._send_handoff_email(
        "owner@acme.com", "ChemBot",
        [{"role": "user", "content": "hi"}],
        visitor_email="v@x.com", visitor_name="A & B Traders",
    ))
    # Subject is a mail header, not HTML — it should carry the literal ampersand.
    assert "A & B Traders" in captured["subject"]
    assert "&amp;" not in captured["subject"]
