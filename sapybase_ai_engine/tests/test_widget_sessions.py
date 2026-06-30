"""Endpoint tests for the Phase 1d widget session-history API.

  GET  /api/sessions                       — visitor-scoped list (no cross-visitor leak)
  POST /api/sessions                        — register session with visitor_id
  GET  /api/sessions/{id}/messages          — restore a session, visitor-scoped 404

The DB is faked (scripted cursor); the only thing under test is the endpoint's
SQL scoping + JSON shaping + the no-visitor_id leak guard.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("CLERK_JWT_ISSUER", "https://test.clerk.accounts.dev")
os.environ.setdefault("CLERK_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")
os.environ.setdefault("ENV", "test")

from datetime import datetime, timezone  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


class FakeCursor:
    def __init__(self, fetchone_results=None, fetchall_results=None):
        self.calls = []
        self._fetchone = list(fetchone_results or [])
        self._fetchall = list(fetchall_results or [])

    def execute(self, sql, params=None):
        self.calls.append((sql, params))

    def fetchone(self):
        return self._fetchone.pop(0) if self._fetchone else None

    def fetchall(self):
        return self._fetchall.pop(0) if self._fetchall else []


class FakeConn:
    def __init__(self, cursor):
        self._cursor = cursor
        self.committed = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True


@pytest.fixture(scope="module")
def main_mod():
    import main
    return main


@pytest.fixture
def client(main_mod):
    # Auth: every request resolves to this tenant.
    main_mod.app.dependency_overrides[main_mod.verify_api_key_and_origin] = lambda: {"id": "comp-1"}
    yield main_mod
    main_mod.app.dependency_overrides.clear()


def _wire_db(main_mod, cursor):
    conn = FakeConn(cursor)
    main_mod.get_db_connection = lambda: conn
    main_mod.release_db_connection = lambda c: None
    return conn


# ── GET /api/sessions ─────────────────────────────────────────────────────────

class TestListSessions:
    def test_no_visitor_id_returns_empty_without_db(self, client, monkeypatch):
        # Guard: a missing visitor_id must NOT hit the DB and must leak nothing.
        def _boom():
            raise AssertionError("DB must not be touched without visitor_id")
        monkeypatch.setattr(client, "get_db_connection", _boom)
        tc = TestClient(client.app)
        resp = tc.get("/api/sessions", headers={"x-api-key": "k"})
        assert resp.status_code == 200
        assert resp.json() == {"sessions": []}

    def test_visitor_scoped_list(self, client, monkeypatch):
        ts = datetime(2026, 6, 30, 12, 0, tzinfo=timezone.utc)
        cur = FakeCursor(fetchall_results=[[
            ("sess-1", "Ethanol quote", ts, "I need 5 litres"),
            ("sess-2", None, ts, None),
        ]])
        monkeypatch.setattr(client, "get_db_connection", lambda: FakeConn(cur))
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        resp = tc.get("/api/sessions?visitor_id=vis-1", headers={"x-api-key": "k"})
        assert resp.status_code == 200
        data = resp.json()["sessions"]
        assert data[0]["session_id"] == "sess-1"
        assert data[0]["title"] == "Ethanol quote"
        assert data[0]["preview"] == "I need 5 litres"
        assert data[1]["title"] is None and data[1]["preview"] is None
        # SQL scoped by both company and visitor.
        sql, params = cur.calls[-1]
        assert "s.visitor_id = %s" in sql
        assert params == ("comp-1", "vis-1")

    def test_preview_truncated_to_120(self, client, monkeypatch):
        long_preview = "x" * 300
        cur = FakeCursor(fetchall_results=[[("sess-1", "t", None, long_preview)]])
        monkeypatch.setattr(client, "get_db_connection", lambda: FakeConn(cur))
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        resp = tc.get("/api/sessions?visitor_id=vis-1", headers={"x-api-key": "k"})
        assert len(resp.json()["sessions"][0]["preview"]) == 120


# ── POST /api/sessions ────────────────────────────────────────────────────────

class TestCreateSession:
    def test_creates_with_visitor_id(self, client, monkeypatch):
        cur = FakeCursor()
        conn = FakeConn(cur)
        monkeypatch.setattr(client, "get_db_connection", lambda: conn)
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        resp = tc.post("/api/sessions", json={"session_id": "sess-9", "visitor_id": "vis-1"},
                       headers={"x-api-key": "k"})
        assert resp.status_code == 200
        assert resp.json() == {"session_id": "sess-9"}
        assert conn.committed
        # upsert carried session, company, visitor.
        assert cur.calls[-1][1] == ("sess-9", "comp-1", "vis-1")

    def test_visitor_id_optional(self, client, monkeypatch):
        cur = FakeCursor()
        monkeypatch.setattr(client, "get_db_connection", lambda: FakeConn(cur))
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        resp = tc.post("/api/sessions", json={"session_id": "sess-9"}, headers={"x-api-key": "k"})
        assert resp.status_code == 200
        assert cur.calls[-1][1] == ("sess-9", "comp-1", None)


# ── GET /api/sessions/{id}/messages ───────────────────────────────────────────

class TestGetMessages:
    def test_404_when_not_found(self, client, monkeypatch):
        cur = FakeCursor(fetchone_results=[None])  # existence check fails
        monkeypatch.setattr(client, "get_db_connection", lambda: FakeConn(cur))
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        resp = tc.get("/api/sessions/sess-x/messages?visitor_id=vis-1", headers={"x-api-key": "k"})
        assert resp.status_code == 404

    def test_visitor_mismatch_is_scoped_in_sql(self, client, monkeypatch):
        cur = FakeCursor(fetchone_results=[None])
        monkeypatch.setattr(client, "get_db_connection", lambda: FakeConn(cur))
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        tc.get("/api/sessions/sess-1/messages?visitor_id=vis-2", headers={"x-api-key": "k"})
        sql, params = cur.calls[0]
        assert "visitor_id = %s" in sql
        assert params == ("sess-1", "comp-1", "vis-2")

    def test_returns_messages(self, client, monkeypatch):
        ts = datetime(2026, 6, 30, 12, 0, tzinfo=timezone.utc)
        cur = FakeCursor(
            fetchone_results=[(1,)],  # exists
            fetchall_results=[[("user", "hi", ts), ("assistant", "hello", ts)]],
        )
        monkeypatch.setattr(client, "get_db_connection", lambda: FakeConn(cur))
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        resp = tc.get("/api/sessions/sess-1/messages?visitor_id=vis-1", headers={"x-api-key": "k"})
        assert resp.status_code == 200
        msgs = resp.json()["messages"]
        assert msgs[0] == {"role": "user", "content": "hi", "ts": ts.isoformat()}
        assert msgs[1]["role"] == "assistant"

    def test_without_visitor_id_falls_back_to_company_scope(self, client, monkeypatch):
        cur = FakeCursor(fetchone_results=[(1,)], fetchall_results=[[]])
        monkeypatch.setattr(client, "get_db_connection", lambda: FakeConn(cur))
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        resp = tc.get("/api/sessions/sess-1/messages", headers={"x-api-key": "k"})
        assert resp.status_code == 200
        sql, params = cur.calls[0]
        assert "visitor_id" not in sql
        assert params == ("sess-1", "comp-1")
