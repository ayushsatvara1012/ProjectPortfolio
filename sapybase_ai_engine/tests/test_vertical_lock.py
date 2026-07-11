"""Vertical-lock plan (docs/vertical-lock-plan.md) — `companies.vertical` is a
structural field (drives pack/tool/RAG selection), so `PATCH /api/company`
gates it to SUPER_ADMIN + an allowlist, separate from the tier-based gates on
every other field in this endpoint.
"""
from fastapi.testclient import TestClient

import main as m


class _FakeCursor:
    """Enough SQL-shape awareness to drive the vertical branch of
    update_company_details without a real DB."""

    def __init__(self, old_vertical=None):
        self.old_vertical = old_vertical
        self.rowcount = 1
        self._sql = ""

    def execute(self, sql, params=None):
        self._sql = sql

    def fetchone(self):
        if "SELECT vertical FROM companies" in self._sql:
            return (self.old_vertical,)
        if "SELECT api_key FROM companies" in self._sql:
            return ("api-key-123",)
        if "SELECT pack_overrides FROM companies" in self._sql:
            return (None,)
        return None

    def fetchall(self):
        return []

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


def _patch_company(monkeypatch, payload, *, role="USER", old_vertical=None):
    conn = _FakeConn(_FakeCursor(old_vertical=old_vertical))
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    logged = {}
    monkeypatch.setattr(
        m, "log_admin_action",
        lambda admin_id, action, target_id=None, changes=None:
            logged.update(admin_id=admin_id, action=action, target_id=target_id, changes=changes)
    )
    m.app.dependency_overrides[m.require_premium_tier] = lambda: {
        "id": "user-1", "tier": "PRO", "role": role, "custom_plan_config": {},
    }
    try:
        resp = TestClient(m.app).patch(
            "/api/company",
            json={"company_id": "comp-1", **payload},
        )
        return resp, logged
    finally:
        m.app.dependency_overrides.clear()


def test_non_admin_patching_vertical_is_403(monkeypatch):
    resp, logged = _patch_company(monkeypatch, {"vertical": "chemical"}, role="USER")
    assert resp.status_code == 403
    assert logged == {}


def test_admin_patching_unknown_vertical_is_400(monkeypatch):
    resp, logged = _patch_company(monkeypatch, {"vertical": "bogus"}, role="SUPER_ADMIN")
    assert resp.status_code == 400
    assert "bogus" in resp.json()["detail"]
    assert logged == {}


def test_admin_patching_valid_vertical_succeeds_and_audits(monkeypatch):
    resp, logged = _patch_company(
        monkeypatch, {"vertical": "chemical"}, role="SUPER_ADMIN", old_vertical=None,
    )
    assert resp.status_code == 200
    assert logged["action"] == "UPDATE_COMPANY_VERTICAL"
    assert logged["target_id"] == "comp-1"
    assert logged["changes"] == {"old": None, "new": "chemical"}


def test_admin_reverting_to_generic_succeeds(monkeypatch):
    resp, logged = _patch_company(
        monkeypatch, {"vertical": ""}, role="SUPER_ADMIN", old_vertical="chemical",
    )
    assert resp.status_code == 200
    assert logged["changes"] == {"old": "chemical", "new": None}

    resp2, logged2 = _patch_company(
        monkeypatch, {"vertical": None}, role="SUPER_ADMIN", old_vertical="chemical",
    )
    assert resp2.status_code == 200
    assert logged2["changes"] == {"old": "chemical", "new": None}
