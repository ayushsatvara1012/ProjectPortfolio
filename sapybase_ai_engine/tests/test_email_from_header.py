"""Tests for the professional From-header helper (main._email_from_header).

Covers the default sender name, a custom EMAIL_FROM_NAME override, the
blank-name fallback to the bare address, and RFC-correct quoting of names
that contain special characters.
"""
from email.utils import parseaddr

from main import _email_from_header


def test_default_name(monkeypatch):
    monkeypatch.delenv("EMAIL_FROM_NAME", raising=False)
    header = _email_from_header("bot@gmail.com")
    assert header == "Sapybase <bot@gmail.com>"


def test_custom_name(monkeypatch):
    monkeypatch.setenv("EMAIL_FROM_NAME", "Acme Sales")
    header = _email_from_header("bot@gmail.com")
    assert header == "Acme Sales <bot@gmail.com>"


def test_blank_name_falls_back_to_bare_address(monkeypatch):
    monkeypatch.setenv("EMAIL_FROM_NAME", "   ")
    assert _email_from_header("bot@gmail.com") == "bot@gmail.com"


def test_address_always_recoverable(monkeypatch):
    # Whatever the display name, the address must parse back out intact so the
    # envelope/Reply-To logic and mail clients resolve the right mailbox.
    monkeypatch.setenv("EMAIL_FROM_NAME", 'Weird, Name "Inc"')
    _, addr = parseaddr(_email_from_header("bot@gmail.com"))
    assert addr == "bot@gmail.com"
