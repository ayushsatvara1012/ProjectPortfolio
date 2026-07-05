"""Endpoint tests for GET /api/public/quote/{token} — Phase 4 shareable quote link.

Covers: unknown token -> 404, expired -> 410, quoted vs price_on_request shape,
company-branding passthrough, and the alert_email-then-owner-email contact fallback.
No auth (public); ownership is scoped entirely by the unguessable token.
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

import main as m


class _FakeCursor:
    def __init__(self, row):
        self._row = row

    def execute(self, sql, params=None):
        pass

    def fetchone(self):
        return self._row

    def close(self):
        pass


class _FakeConn:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor


def _row(*, is_por=False, expires_at=None, alert_email="alerts@acme.com",
         owner_email="owner@acme.com", unit_price=1894.0, subtotal=3788.0):
    if expires_at is None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    return (
        "Acetone", "AR", "2.5 Ltr", 2,
        None if is_por else unit_price,
        None if is_por else subtotal,
        18.0, "INR", is_por,
        datetime(2026, 7, 4, tzinfo=timezone.utc), expires_at,
        "Acme Chemicals", "https://acme.example/logo.png", "#123456",
        "Acme Bot", alert_email, owner_email,
    )


def _get(monkeypatch, token, row):
    conn = _FakeConn(_FakeCursor(row))
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    tc = TestClient(m.app)
    return tc.get(f"/api/public/quote/{token}")


def test_unknown_token_is_404(monkeypatch):
    resp = _get(monkeypatch, "does-not-exist", None)
    assert resp.status_code == 404


def test_quoted_shape(monkeypatch):
    resp = _get(monkeypatch, "tok-1", _row())
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "quoted"
    assert body["product"] == "Acetone"
    assert body["unit_price"] == 1894.0
    assert body["subtotal"] == 3788.0
    assert body["gst_note"] == "GST extra as applicable"
    assert body["company"]["name"] == "Acme Chemicals"
    assert body["company"]["theme_color"] == "#123456"


def test_por_shape_has_no_price(monkeypatch):
    resp = _get(monkeypatch, "tok-2", _row(is_por=True))
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "price_on_request"
    assert body["unit_price"] is None
    assert body["subtotal"] is None


def test_expired_link_is_410(monkeypatch):
    expired = datetime.now(timezone.utc) - timedelta(days=1)
    resp = _get(monkeypatch, "tok-3", _row(expires_at=expired))
    assert resp.status_code == 410


def test_contact_prefers_alert_email_over_owner_email(monkeypatch):
    resp = _get(monkeypatch, "tok-4", _row(alert_email="alerts@acme.com", owner_email="owner@acme.com"))
    assert resp.json()["company"]["contact_email"] == "alerts@acme.com"


def test_contact_falls_back_to_owner_email(monkeypatch):
    resp = _get(monkeypatch, "tok-5", _row(alert_email=None, owner_email="owner@acme.com"))
    assert resp.json()["company"]["contact_email"] == "owner@acme.com"


def test_contact_none_when_neither_set(monkeypatch):
    resp = _get(monkeypatch, "tok-6", _row(alert_email=None, owner_email=None))
    assert resp.json()["company"]["contact_email"] is None
