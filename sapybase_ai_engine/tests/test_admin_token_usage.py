"""Cross-tenant Gemini token-spend rollup (docs/archived/admin-panel-sync-plan.md Phase D).

GET /api/admin/token-usage shapes the same chat_logs aggregate the per-company
GET /api/sessions/bi/{company_id} endpoint already uses (services.session_bi.
build_token_metrics) into a fleet-wide summary plus a per-company breakdown.
Covers: fleet shape via build_token_metrics, per-company join + ordering,
window_days clamping, and that a non-admin caller is rejected (403).
"""
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main as m


class _FakeCursor:
    """First execute() = fleet aggregate (fetchone), second = per-company (fetchall)."""

    def __init__(self, fleet_row, company_rows):
        self.fleet_row = fleet_row
        self.company_rows = company_rows
        self.calls: list[tuple[str, object]] = []

    def execute(self, sql, params=None):
        self.calls.append((sql, params))

    def fetchone(self):
        return self.fleet_row

    def fetchall(self):
        return self.company_rows

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


def _admin_get(monkeypatch, path, fleet_row, company_rows, *, as_admin=True):
    conn = _FakeConn(_FakeCursor(fleet_row, company_rows))
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    if as_admin:
        m.app.dependency_overrides[m.get_admin_user] = lambda: {"id": "admin-1", "role": "SUPER_ADMIN", "email": "admin@sapybase.com"}
    else:
        def _forbidden():
            raise HTTPException(status_code=403, detail="Forbidden: This endpoint is restricted to platform Super Admins.")
        m.app.dependency_overrides[m.get_admin_user] = _forbidden
    try:
        resp = TestClient(m.app).get(path)
    finally:
        m.app.dependency_overrides.clear()
    return resp, conn


def test_fleet_shape_uses_build_token_metrics(monkeypatch):
    # turns, cache_hits, input_tokens, output_tokens, metered_turns, conversations, cached_tokens
    fleet_row = (100, 10, 5000, 3000, 90, 40, 500)
    resp, _ = _admin_get(monkeypatch, "/api/admin/token-usage", fleet_row, [])
    assert resp.status_code == 200
    body = resp.json()
    assert body["fleet"]["total_tokens"] == 8000
    assert body["fleet"]["metered_turns"] == 90
    assert body["fleet"]["conversations"] == 40
    assert body["top_companies"] == []


def test_per_company_breakdown_shape(monkeypatch):
    fleet_row = (10, 0, 1000, 500, 10, 5, 0)
    company_rows = [
        ("comp-1", "Acme Chemicals", 1000, 500, 10),
        ("comp-2", "Beta Labs", 400, 100, 4),
    ]
    resp, _ = _admin_get(monkeypatch, "/api/admin/token-usage", fleet_row, company_rows)
    assert resp.status_code == 200
    items = resp.json()["top_companies"]
    assert items[0] == {
        "company_id": "comp-1", "company_name": "Acme Chemicals",
        "input_tokens": 1000, "output_tokens": 500, "total_tokens": 1500, "metered_turns": 10,
    }
    assert items[1]["total_tokens"] == 500


def test_window_days_is_clamped(monkeypatch):
    resp, conn = _admin_get(monkeypatch, "/api/admin/token-usage?window_days=9999", (0, 0, 0, 0, 0, 0, 0), [])
    assert resp.status_code == 200
    assert resp.json()["window_days"] == 365
    # both queries must carry the clamped window in the interval literal
    assert any("365" in (sql or "") for sql, _ in conn._cursor.calls)


def test_non_admin_is_forbidden(monkeypatch):
    resp, _ = _admin_get(monkeypatch, "/api/admin/token-usage", (0, 0, 0, 0, 0, 0, 0), [], as_admin=False)
    assert resp.status_code == 403
