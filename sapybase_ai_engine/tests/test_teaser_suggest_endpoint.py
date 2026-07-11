"""Contextual teaser (Phase 3) — POST /api/company/teaser/suggest-copy.

Endpoint-level coverage mirroring tests/test_vertical_lock.py's pattern (fake
DB cursor + dependency_overrides); services/teaser.py's own unit tests already
cover prompt-building and response-parsing in isolation.
"""
from fastapi.testclient import TestClient

import main as m


class _FakeCursor:
    def __init__(self, bot_name="ChemBot", vertical="chemical", found=True):
        self.bot_name = bot_name
        self.vertical = vertical
        self.found = found
        self._sql = ""

    def execute(self, sql, params=None):
        self._sql = sql

    def fetchone(self):
        if "SELECT bot_name, vertical FROM companies" in self._sql:
            return (self.bot_name, self.vertical) if self.found else None
        if "SELECT id FROM companies WHERE user_id" in self._sql:
            return ("comp-1",) if self.found else None
        return None

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


class _FakeResponse:
    def __init__(self, content):
        self.content = content


class _FakeModel:
    def __init__(self, content=None, error=None):
        self._content = content
        self._error = error

    async def ainvoke(self, messages):
        if self._error:
            raise self._error
        return _FakeResponse(self._content)


def _call(monkeypatch, body, *, cursor=None, model_content=None, model_error=None, tier="PRO"):
    conn = _FakeConn(cursor or _FakeCursor())
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(
        m, "ChatGoogleGenerativeAI",
        lambda **kwargs: _FakeModel(content=model_content, error=model_error),
    )
    m.app.dependency_overrides[m.require_premium_tier] = lambda: {
        "id": "user-1", "tier": tier, "role": "USER", "custom_plan_config": {},
    }
    try:
        return TestClient(m.app).post("/api/company/teaser/suggest-copy", json=body)
    finally:
        m.app.dependency_overrides.clear()


def test_returns_sanitized_suggestion_on_success(monkeypatch):
    resp = _call(
        monkeypatch,
        {"company_id": "comp-1", "match": "/pricing", "page": "pricing"},
        model_content='{"title": "Want the best price?", "subtext": "Ask away"}',
    )
    assert resp.status_code == 200
    assert resp.json() == {
        "status": "success",
        "suggestion": {"title": "Want the best price?", "subtext": "Ask away"},
    }


def test_resolves_default_bot_when_company_id_omitted(monkeypatch):
    resp = _call(
        monkeypatch,
        {},
        model_content='{"title": "Hi"}',
    )
    assert resp.status_code == 200
    assert resp.json()["suggestion"] == {"title": "Hi"}


def test_404_when_user_has_no_bot(monkeypatch):
    resp = _call(monkeypatch, {}, cursor=_FakeCursor(found=False))
    assert resp.status_code == 404


def test_403_when_company_id_not_owned(monkeypatch):
    cursor = _FakeCursor(found=True)
    # Company lookup by explicit id returns None (not owned by this user).
    cursor.fetchone = lambda: None
    resp = _call(monkeypatch, {"company_id": "not-mine"}, cursor=cursor)
    assert resp.status_code == 403


def test_502_when_model_call_fails(monkeypatch):
    resp = _call(monkeypatch, {"company_id": "comp-1"}, model_error=RuntimeError("upstream down"))
    assert resp.status_code == 502


def test_502_when_model_returns_unparseable_junk(monkeypatch):
    resp = _call(monkeypatch, {"company_id": "comp-1"}, model_content="not json")
    assert resp.status_code == 502
