"""Endpoint tests for POST /api/feedback (vertical intelligence plan, Phase 2a).

Thumbs up/down on a bot reply, attached via the widget-generated
`client_message_id` sent on the originating /api/chat call. The DB is faked
(scripted cursor); the only thing under test is the endpoint's SQL scoping,
rating validation, and the BYOD soft-degrade path.
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

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


class FakeCursor:
    def __init__(self, rowcount=1):
        self.calls = []
        self.rowcount = rowcount

    def execute(self, sql, params=None):
        self.calls.append((sql, params))


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
    main_mod.app.dependency_overrides[main_mod.verify_api_key_and_origin] = lambda: {"id": "comp-1"}
    yield main_mod
    main_mod.app.dependency_overrides.clear()


class TestSubmitFeedback:
    def test_thumbs_up_updates_by_client_message_id(self, client, monkeypatch):
        monkeypatch.setattr(client.byod_engine, "routing_active", lambda company_id: False)
        cur = FakeCursor(rowcount=1)
        conn = FakeConn(cur)
        monkeypatch.setattr(client, "get_db_connection", lambda: conn)
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        resp = tc.post(
            "/api/feedback",
            json={"client_message_id": "msg-1", "rating": 1},
            headers={"x-api-key": "k"},
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok", "updated": True}
        assert conn.committed
        sql, params = cur.calls[-1]
        assert "UPDATE chat_logs" in sql
        assert "company_id = %s" in sql and "client_message_id = %s" in sql
        assert params == (1, "comp-1", "msg-1")

    def test_thumbs_down_rating_persisted(self, client, monkeypatch):
        monkeypatch.setattr(client.byod_engine, "routing_active", lambda company_id: False)
        cur = FakeCursor(rowcount=1)
        monkeypatch.setattr(client, "get_db_connection", lambda: FakeConn(cur))
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        resp = tc.post(
            "/api/feedback",
            json={"client_message_id": "msg-2", "rating": -1},
            headers={"x-api-key": "k"},
        )
        assert resp.status_code == 200
        sql, params = cur.calls[-1]
        assert params == (-1, "comp-1", "msg-2")

    def test_unknown_message_id_reports_not_updated(self, client, monkeypatch):
        monkeypatch.setattr(client.byod_engine, "routing_active", lambda company_id: False)
        cur = FakeCursor(rowcount=0)
        monkeypatch.setattr(client, "get_db_connection", lambda: FakeConn(cur))
        monkeypatch.setattr(client, "release_db_connection", lambda c: None)
        tc = TestClient(client.app)
        resp = tc.post(
            "/api/feedback",
            json={"client_message_id": "does-not-exist", "rating": 1},
            headers={"x-api-key": "k"},
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok", "updated": False}

    def test_rejects_invalid_rating(self, client, monkeypatch):
        def _boom():
            raise AssertionError("DB must not be touched on validation failure")
        monkeypatch.setattr(client, "get_db_connection", _boom)
        tc = TestClient(client.app)
        resp = tc.post(
            "/api/feedback",
            json={"client_message_id": "msg-1", "rating": 0},
            headers={"x-api-key": "k"},
        )
        assert resp.status_code == 422

    def test_byod_routed_company_degrades_soft(self, client, monkeypatch):
        # BYOD tenant chat_logs doesn't carry this column yet (control-plane
        # only, same precedent as token metering) — must not touch the DB.
        monkeypatch.setattr(client.byod_engine, "routing_active", lambda company_id: True)

        def _boom():
            raise AssertionError("DB must not be touched for a BYOD-routed company")
        monkeypatch.setattr(client, "get_db_connection", _boom)
        tc = TestClient(client.app)
        resp = tc.post(
            "/api/feedback",
            json={"client_message_id": "msg-1", "rating": 1},
            headers={"x-api-key": "k"},
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
