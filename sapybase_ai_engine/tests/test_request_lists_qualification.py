"""Phase 5.4 — owner request panels surface qualification facts.

The GET list endpoints LEFT JOIN agent_sessions and expose the session's
`lead_profile->'qualification'` on each row. Covers: a dict JSONB, a JSON-string
JSONB, and a NULL (legacy/unqualified) row all coerce cleanly, plus the pure
`_coerce_qualification` helper's edge cases.
"""
from datetime import datetime, timezone

from fastapi.testclient import TestClient

import main as m


class _FakeCursor:
    def __init__(self, rows, owns=True):
        self.rows = rows
        self.owns = owns
        self._sql = ""

    def execute(self, sql, params=None):
        self._sql = sql

    def fetchone(self):
        if "FROM companies" in self._sql:
            return ("comp-1",) if self.owns else None
        return None

    def fetchall(self):
        return self.rows

    def close(self):
        pass


class _FakeConn:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor

    def commit(self):
        pass

    def rollback(self):
        pass


def _get(monkeypatch, path, rows, *, owns=True):
    conn = _FakeConn(_FakeCursor(rows, owns=owns))
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.get_current_user] = lambda: {"id": "user-1"}
    try:
        return TestClient(m.app).get(path)
    finally:
        m.app.dependency_overrides.clear()


_TS = datetime(2026, 7, 5, tzinfo=timezone.utc)


def _quote_row(qualification):
    # 17 columns matching the SELECT in list_quote_requests.
    return ("id1", "Acetone", "AR", "500 ml", 2, 100.0, 200.0, 18.0, "INR", False,
            "Ravi", "r@co.com", "+91", "new", _TS, "sess-1", qualification)


def _agent_row(qualification):
    # 15 columns matching the SELECT in list_agent_requests.
    return ("id1", "sample", "Acetone", "67-64-1", "AR", "500 ml", 1,
            "Ravi", "r@co.com", "+91", "note", "new", _TS, "sess-1", qualification)


# ── quote-requests ───────────────────────────────────────────────────────────

def test_quote_list_surfaces_qualification_dict(monkeypatch):
    rows = [_quote_row({"industry": "pharmaceutical", "timeline": "urgent"})]
    resp = _get(monkeypatch, "/api/companies/comp-1/quote-requests", rows)
    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert item["qualification"] == {"industry": "pharmaceutical", "timeline": "urgent"}


def test_quote_list_parses_json_string(monkeypatch):
    rows = [_quote_row('{"delivery_city": "Surat"}')]
    resp = _get(monkeypatch, "/api/companies/comp-1/quote-requests", rows)
    assert resp.json()["items"][0]["qualification"] == {"delivery_city": "Surat"}


def test_quote_list_null_qualification_is_empty(monkeypatch):
    rows = [_quote_row(None)]
    resp = _get(monkeypatch, "/api/companies/comp-1/quote-requests", rows)
    assert resp.json()["items"][0]["qualification"] == {}


# ── agent-requests ───────────────────────────────────────────────────────────

def test_agent_list_surfaces_qualification(monkeypatch):
    rows = [_agent_row({"application": "water treatment", "monthly_volume": "500 kg/month"})]
    resp = _get(monkeypatch, "/api/companies/comp-1/agent-requests", rows)
    assert resp.status_code == 200
    assert resp.json()["items"][0]["qualification"] == {
        "application": "water treatment", "monthly_volume": "500 kg/month"}


def test_agent_list_null_qualification_is_empty(monkeypatch):
    resp = _get(monkeypatch, "/api/companies/comp-1/agent-requests", [_agent_row(None)])
    assert resp.json()["items"][0]["qualification"] == {}


def test_unowned_company_is_404(monkeypatch):
    resp = _get(monkeypatch, "/api/companies/comp-1/quote-requests", [], owns=False)
    assert resp.status_code == 404


# ── helper edge cases ─────────────────────────────────────────────────────────

def test_coerce_qualification_variants():
    assert m._coerce_qualification(None) == {}
    assert m._coerce_qualification({"a": "b"}) == {"a": "b"}
    assert m._coerce_qualification('{"a": "b"}') == {"a": "b"}
    assert m._coerce_qualification("not json") == {}          # bad string → {}
    assert m._coerce_qualification(["a"]) == {}               # non-dict → {}
    assert m._coerce_qualification({"a": "", "b": None, "c": "x"}) == {"c": "x"}  # drop empties
    assert m._coerce_qualification({"n": 3}) == {"n": "3"}    # stringify values
