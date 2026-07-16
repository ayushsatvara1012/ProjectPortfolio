"""Fleet-wide admin agent-requests view (docs/admin-panel-sync-plan.md Phase C).

GET /api/admin/agent-requests is the SUPER_ADMIN counterpart to the per-company
GET /api/companies/{company_id}/agent-requests: same row shape, no company_id
filter, joined with `companies` for company_name/bot_name. Covers: happy path
shape + company join, kind/status filtering, pagination, and that a non-admin
caller is rejected (403) since a fleet row carries visitor contact PII across
every tenant at once.
"""
from datetime import datetime, timezone

from fastapi import HTTPException
from fastapi.testclient import TestClient

import main as m

_TS = datetime(2026, 7, 16, tzinfo=timezone.utc)


class _FakeCursor:
    def __init__(self, rows, count):
        self.rows = rows
        self.count = count
        self._sql = ""
        self.calls: list[tuple[str, object]] = []

    def execute(self, sql, params=None):
        self._sql = sql
        self.calls.append((sql, params))

    def fetchall(self):
        return self.rows if "SELECT a.id" in self._sql else []

    def fetchone(self):
        return (self.count,) if "COUNT(*)" in self._sql else None

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


def _row(company_id="comp-1", company_name="Acme Chemicals"):
    # 17 columns matching the SELECT in list_agent_requests_fleet.
    return ("id1", "sample", "Acetone", "67-64-1", "AR", "500 ml", 1,
            "Ravi", "r@co.com", "+91", "note", "new", _TS, "sess-1",
            company_id, company_name, "Acme Bot")


def _get(monkeypatch, path, rows, count, *, as_admin=True):
    conn = _FakeConn(_FakeCursor(rows, count))
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    if as_admin:
        m.app.dependency_overrides[m.get_admin_user] = lambda: {"id": "admin-1", "role": "SUPER_ADMIN", "email": "admin@sapybase.com"}
        m.app.dependency_overrides[m.require_fresh_admin] = lambda: {"payload": {"iat": 0}}
    else:
        def _forbidden():
            raise HTTPException(status_code=403, detail="Forbidden: This endpoint is restricted to platform Super Admins.")
        m.app.dependency_overrides[m.get_admin_user] = _forbidden
    try:
        return TestClient(m.app).get(path)
    finally:
        m.app.dependency_overrides.clear()


def test_fleet_list_shape_and_company_join(monkeypatch):
    resp = _get(monkeypatch, "/api/admin/agent-requests", [_row()], 1)
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    item = body["items"][0]
    assert item["company_id"] == "comp-1"
    assert item["company_name"] == "Acme Chemicals"
    assert item["bot_name"] == "Acme Bot"
    assert item["kind"] == "sample"
    assert item["contact_email"] == "r@co.com"


def test_fleet_list_no_company_id_filter_in_query(monkeypatch):
    """Unlike the per-company endpoint, the fleet query must not scope by a single
    company_id — it spans every tenant."""
    conn = _FakeConn(_FakeCursor([_row()], 1))
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.get_admin_user] = lambda: {"id": "admin-1", "role": "SUPER_ADMIN", "email": "admin@sapybase.com"}
    m.app.dependency_overrides[m.require_fresh_admin] = lambda: {"payload": {"iat": 0}}
    try:
        TestClient(m.app).get("/api/admin/agent-requests")
    finally:
        m.app.dependency_overrides.clear()
    select_sql = conn._cursor.calls[0][0]
    assert "a.company_id = %s" not in select_sql
    assert "JOIN companies c ON c.id = a.company_id" in select_sql


def test_fleet_list_status_filter_passed_through(monkeypatch):
    conn = _FakeConn(_FakeCursor([], 0))
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.get_admin_user] = lambda: {"id": "admin-1", "role": "SUPER_ADMIN", "email": "admin@sapybase.com"}
    m.app.dependency_overrides[m.require_fresh_admin] = lambda: {"payload": {"iat": 0}}
    try:
        resp = TestClient(m.app).get("/api/admin/agent-requests?status=handled&kind=sample")
    finally:
        m.app.dependency_overrides.clear()
    assert resp.status_code == 200
    select_sql = conn._cursor.calls[0][0]
    assert "a.status = %s" in select_sql
    assert "a.kind = %s" in select_sql


def test_fleet_list_limit_is_clamped(monkeypatch):
    conn = _FakeConn(_FakeCursor([], 0))
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.get_admin_user] = lambda: {"id": "admin-1", "role": "SUPER_ADMIN", "email": "admin@sapybase.com"}
    m.app.dependency_overrides[m.require_fresh_admin] = lambda: {"payload": {"iat": 0}}
    try:
        resp = TestClient(m.app).get("/api/admin/agent-requests?limit=9999")
    finally:
        m.app.dependency_overrides.clear()
    assert resp.status_code == 200
    select_params = conn._cursor.calls[0][1]
    assert select_params[-2] == 200  # clamped to the 200 ceiling


def test_non_admin_is_forbidden(monkeypatch):
    resp = _get(monkeypatch, "/api/admin/agent-requests", [], 0, as_admin=False)
    assert resp.status_code == 403
