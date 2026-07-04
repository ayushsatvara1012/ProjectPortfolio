"""Endpoint tests for PATCH .../quote-requests/{id} and .../agent-requests/{id}
— Phase 3.1 owner-workflow status management.

Covers: per-table allowed-status validation (quote uses sent, agent uses handled),
ownership 404, missing-row 404, and extra-field rejection.
"""
from datetime import datetime, timezone

from fastapi.testclient import TestClient

import main as m


class _FakeCursor:
    def __init__(self, *, owns=True, request_exists=True):
        self.owns = owns
        self.request_exists = request_exists
        self._sql = ""
        self._params = None

    def execute(self, sql, params=None):
        self._sql = sql
        self._params = params

    def fetchone(self):
        if "FROM companies" in self._sql:
            return ("comp-1",) if self.owns else None
        if "UPDATE" in self._sql and "RETURNING" in self._sql:
            if not self.request_exists:
                return None
            # params = (status, request_id, company_id)
            return ("req-1", self._params[0], datetime(2026, 7, 4, tzinfo=timezone.utc))
        return None

    def close(self):
        pass


class _FakeConn:
    def __init__(self, cursor):
        self._cursor = cursor
        self.committed = False
        self.rolled_back = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


def _patch(monkeypatch, path, body, *, owns=True, request_exists=True):
    cur = _FakeCursor(owns=owns, request_exists=request_exists)
    conn = _FakeConn(cur)
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.get_current_user] = lambda: {"id": "user-1"}
    try:
        tc = TestClient(m.app)
        resp = tc.patch(path, json=body)
        resp._conn = conn
        return resp
    finally:
        m.app.dependency_overrides.clear()


_Q = "/api/companies/comp-1/quote-requests/req-1"
_A = "/api/companies/comp-1/agent-requests/req-1"


# ── quote-requests ───────────────────────────────────────────────────────────

def test_quote_status_valid_transition(monkeypatch):
    resp = _patch(monkeypatch, _Q, {"status": "sent"})
    assert resp.status_code == 200
    assert resp.json()["request"]["status"] == "sent"
    assert resp._conn.committed


def test_quote_status_won_lost_allowed(monkeypatch):
    for s in ("won", "lost", "new"):
        resp = _patch(monkeypatch, _Q, {"status": s})
        assert resp.status_code == 200, s


def test_quote_status_rejects_agent_only_value(monkeypatch):
    # "handled" belongs to agent_requests, not quotes.
    resp = _patch(monkeypatch, _Q, {"status": "handled"})
    assert resp.status_code == 400


def test_quote_status_rejects_garbage(monkeypatch):
    resp = _patch(monkeypatch, _Q, {"status": "pwned"})
    assert resp.status_code == 400


def test_quote_status_unowned_is_404(monkeypatch):
    resp = _patch(monkeypatch, _Q, {"status": "sent"}, owns=False)
    assert resp.status_code == 404
    assert not resp._conn.committed


def test_quote_status_missing_row_is_404(monkeypatch):
    resp = _patch(monkeypatch, _Q, {"status": "sent"}, request_exists=False)
    assert resp.status_code == 404


# ── agent-requests ───────────────────────────────────────────────────────────

def test_agent_status_valid_transition(monkeypatch):
    resp = _patch(monkeypatch, _A, {"status": "handled"})
    assert resp.status_code == 200
    assert resp.json()["request"]["status"] == "handled"


def test_agent_status_rejects_quote_only_value(monkeypatch):
    # "sent" belongs to quote_requests, not agent requests.
    resp = _patch(monkeypatch, _A, {"status": "sent"})
    assert resp.status_code == 400


def test_agent_status_unowned_is_404(monkeypatch):
    resp = _patch(monkeypatch, _A, {"status": "handled"}, owns=False)
    assert resp.status_code == 404


# ── shared: schema hygiene ───────────────────────────────────────────────────

def test_extra_fields_forbidden(monkeypatch):
    resp = _patch(monkeypatch, _Q, {"status": "sent", "evil": "x"})
    assert resp.status_code == 422
