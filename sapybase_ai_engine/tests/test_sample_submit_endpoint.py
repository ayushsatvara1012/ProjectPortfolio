"""Endpoint tests for POST /api/widget/sample-request — the honesty gate (Phase 1.5).

The DB row is the only capture we can confirm synchronously. If the insert fails
AND the bot has no owner-notification channel (Slack / email), the lead is lost —
the endpoint must return an error, never a cheerful {"status": "ok"}.
"""
from fastapi.testclient import TestClient

import main as m


class _FakeCursor:
    def execute(self, *a, **k):
        pass

    def close(self):
        pass


class _FakeConn:
    def cursor(self):
        return _FakeCursor()

    def commit(self):
        pass

    def rollback(self):
        pass


_ALL_FIELDS = {
    "product": "Acetone", "grade": "AR", "quantity": "5",
    "contact_name": "Asha", "company": "Acme", "contact_email": "asha@acme.com",
    "address": "12 Industrial Rd",
}


def _company(**over):
    base = {
        "id": "comp-1", "vertical": "chemical", "pack_overrides": None,
        "bot_name": "ChemBot", "slack_webhook_url": None,
        "alert_email": None, "owner_email": None,
    }
    base.update(over)
    return base


def _post(monkeypatch, *, persisted=True, company=None, fields=None, redis_client=None):
    company = company or _company()
    captured = {}

    def _fake_insert(cursor, company_id, **kwargs):
        captured.update(kwargs)
        captured["company_id"] = company_id
        return persisted

    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConn())
    monkeypatch.setattr(m, "release_db_connection", lambda conn: None)
    monkeypatch.setattr(m, "_insert_agent_request", _fake_insert)
    # Do not actually fire background handoff / sink in the test.
    monkeypatch.setattr(m, "_fire_agent_handoff", lambda *a, **k: None)
    monkeypatch.setattr(m, "_fire_sheet_sink", lambda *a, **k: None)
    monkeypatch.setattr(m, "r", redis_client)  # None → anti-spam paths degrade open
    m.app.dependency_overrides[m.verify_api_key_and_origin] = lambda: company
    try:
        tc = TestClient(m.app)
        resp = tc.post("/api/widget/sample-request",
                       json={"fields": _ALL_FIELDS if fields is None else fields,
                             "session_id": "s1"},
                       headers={"x-api-key": "k"})
        resp._captured_insert = captured
        return resp
    finally:
        m.app.dependency_overrides.clear()


class _FakeRedis:
    """Minimal async redis stand-in for the anti-spam paths (set/nx/incr/expire)."""
    def __init__(self):
        self.store = {}

    async def set(self, key, val, ex=None, nx=False):
        if nx and key in self.store:
            return None
        self.store[key] = val
        return True

    async def incr(self, key):
        self.store[key] = int(self.store.get(key, 0)) + 1
        return self.store[key]

    async def expire(self, key, ttl):
        return True


# ── 1.5 honesty gate ─────────────────────────────────────────────────────────

def test_insert_failure_with_no_channel_returns_error(monkeypatch):
    resp = _post(monkeypatch, persisted=False, company=_company())
    assert resp.status_code == 502
    assert resp.json()["detail"]["code"] == "CAPTURE_FAILED"


def test_insert_failure_but_owner_email_configured_is_ok(monkeypatch):
    # A notification channel exists → the lead still reaches the owner; ok is honest.
    resp = _post(monkeypatch, persisted=False,
                 company=_company(alert_email="owner@acme.com"))
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_successful_insert_is_ok(monkeypatch):
    resp = _post(monkeypatch, persisted=True, company=_company())
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ── 2.1 visitor-field sanitisation ───────────────────────────────────────────

def test_unknown_keys_are_stripped_before_persist(monkeypatch):
    fields = dict(_ALL_FIELDS, evil="<script>", junk="x" * 10)
    resp = _post(monkeypatch, fields=fields)
    assert resp.status_code == 200
    fd = resp._captured_insert["form_data"]
    assert "evil" not in fd and "junk" not in fd
    assert fd["product"] == "Acetone"


def test_invalid_email_is_rejected_as_missing(monkeypatch):
    fields = dict(_ALL_FIELDS, contact_email="not-an-email")
    resp = _post(monkeypatch, fields=fields)
    assert resp.status_code == 422
    assert "contact_email" in resp.json()["detail"]["fields"]


# ── 2.2 anti-spam: honeypot / dedup / daily cap ──────────────────────────────

def test_honeypot_pretends_success_and_drops(monkeypatch):
    fields = dict(_ALL_FIELDS, website="http://spam.example")
    resp = _post(monkeypatch, fields=fields)
    assert resp.status_code == 200 and resp.json()["status"] == "ok"
    assert resp._captured_insert == {}   # nothing was persisted


def test_dedup_second_identical_submit_is_noop(monkeypatch):
    fr = _FakeRedis()
    r1 = _post(monkeypatch, redis_client=fr)
    assert r1.status_code == 200 and not r1.json().get("duplicate")
    r2 = _post(monkeypatch, redis_client=fr)
    assert r2.status_code == 200 and r2.json().get("duplicate") is True


def test_daily_cap_returns_429_when_exceeded(monkeypatch):
    fr = _FakeRedis()
    # Pre-seed the counter past the cap for today's key.
    from datetime import datetime, timezone
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    fr.store[f"sample_cap:comp-1:{day}"] = m.SAMPLE_DAILY_CAP_PER_COMPANY + 5
    # Use a unique product so the dedup gate doesn't short-circuit first.
    resp = _post(monkeypatch, fields=dict(_ALL_FIELDS, product="UniqueProdX"),
                 redis_client=fr)
    assert resp.status_code == 429
    assert resp.json()["detail"]["code"] == "RATE_LIMITED"
