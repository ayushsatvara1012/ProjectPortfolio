"""Endpoint tests for GET /api/widget/sds-products (get-sds-crash-fix-plan, Phase 3).

The picker's deterministic data source: one row per PRODUCT (grouped by name,
D4) with a servable https SDS, picked via the SAME `_newest_https_row` helper
the conversational `get_sds` tool uses (3c) — so the picker and the chat path
can never disagree on which sheet a product resolves to. No-sheet products are
omitted (D6).
"""
import datetime

from fastapi.testclient import TestClient

import main as m


def _row(name="Sulphuric Acid", cas="7664-93-9", grade="Battery",
         packaging="35kg can", sds_ref="https://sds.example.com/h2so4.pdf",
         updated=None):
    updated = updated if updated is not None else datetime.datetime(
        2026, 1, 2, tzinfo=datetime.timezone.utc)
    return (name, cas, grade, packaging, sds_ref, updated)


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows
        self.calls = []  # list of (sql, params)

    def execute(self, sql, params=None):
        self.calls.append((sql, params))

    def fetchall(self):
        return list(self._rows)

    def close(self):
        pass


class _FakeConn:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor


def _company(**over):
    base = {"id": "comp-1", "vertical": "chemical"}
    base.update(over)
    return base


def _get(monkeypatch, *, company=None, rows=None, params=None):
    company = _company() if company is None else company
    cur = _FakeCursor(rows or [])
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConn(cur))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.verify_api_key_and_origin] = lambda: company
    try:
        tc = TestClient(m.app)
        resp = tc.get("/api/widget/sds-products", params=params or {},
                      headers={"x-api-key": "k"})
        resp._fake_cursor = cur
        return resp
    finally:
        m.app.dependency_overrides.clear()


# ── happy path / grouping / newest-wins ──────────────────────────────────────

def test_single_product_returns_one_entry(monkeypatch):
    resp = _get(monkeypatch, rows=[_row()])
    assert resp.status_code == 200
    products = resp.json()["products"]
    assert len(products) == 1
    assert products[0] == {
        "name": "Sulphuric Acid",
        "cas_number": "7664-93-9",
        "sds_url": "https://sds.example.com/h2so4.pdf",
        "updated_at": "2026-01-02T00:00:00+00:00",
    }


def test_multi_grade_product_collapses_to_one_entry_newest_link(monkeypatch):
    rows = [
        _row(grade="LR", sds_ref="https://sds.example.com/h2so4-old.pdf",
             updated=datetime.datetime(2025, 1, 1, tzinfo=datetime.timezone.utc)),
        _row(grade="AR", sds_ref="https://sds.example.com/h2so4-new.pdf",
             updated=datetime.datetime(2026, 6, 1, tzinfo=datetime.timezone.utc)),
    ]
    resp = _get(monkeypatch, rows=rows)
    products = resp.json()["products"]
    assert len(products) == 1  # ONE product, not one per grade
    assert products[0]["sds_url"] == "https://sds.example.com/h2so4-new.pdf"


def test_names_grouped_case_insensitively_and_trimmed(monkeypatch):
    # D4: casing/whitespace variants of the same name are ONE product.
    rows = [
        _row(name="Sulphuric Acid", grade="LR"),
        _row(name=" SULPHURIC ACID ", grade="AR"),
        _row(name="sulphuric acid", grade="HPLC"),
    ]
    resp = _get(monkeypatch, rows=rows)
    assert len(resp.json()["products"]) == 1


def test_cas_shared_across_distinct_names_yields_two_entries(monkeypatch):
    # Real Expresolv-shaped data: one CAS spans several DISTINCT product names —
    # grouping is by NAME (D4), never CAS, so both must appear separately.
    rows = [_row(name="Hydrochloric Acid", cas="7647-01-0"),
            _row(name="Muriatic Acid", cas="7647-01-0")]
    resp = _get(monkeypatch, rows=rows)
    names = {p["name"] for p in resp.json()["products"]}
    assert names == {"Hydrochloric Acid", "Muriatic Acid"}


# ── no-sheet omission (D6) ────────────────────────────────────────────────────

def test_no_sheet_product_is_omitted(monkeypatch):
    rows = [
        _row(name="Has Sheet", sds_ref="https://sds.example.com/ok.pdf"),
        _row(name="No Sheet", cas="000-0-0", sds_ref=None),
        _row(name="Insecure Sheet", cas="111-1-1", sds_ref="http://insecure/x.pdf"),
    ]
    resp = _get(monkeypatch, rows=rows)
    names = {p["name"] for p in resp.json()["products"]}
    assert names == {"Has Sheet"}


def test_empty_catalog_returns_empty_products_list(monkeypatch):
    resp = _get(monkeypatch, rows=[])
    assert resp.status_code == 200
    assert resp.json() == {"products": []}


# ── sort + cap ────────────────────────────────────────────────────────────────

def test_products_sorted_by_name(monkeypatch):
    rows = [_row(name="Zinc Oxide", cas="1"), _row(name="Acetone", cas="2"),
            _row(name="Methanol", cas="3")]
    resp = _get(monkeypatch, rows=rows)
    names = [p["name"] for p in resp.json()["products"]]
    assert names == ["Acetone", "Methanol", "Zinc Oxide"]


def test_very_large_catalog_is_capped(monkeypatch):
    rows = [_row(name=f"Product {i:04d}", cas=str(i)) for i in range(m.SDS_PICKER_PRODUCT_CAP + 50)]
    resp = _get(monkeypatch, rows=rows)
    assert len(resp.json()["products"]) == m.SDS_PICKER_PRODUCT_CAP


# ── ?q= search (server-side) ──────────────────────────────────────────────────

def test_query_param_filters_by_name_or_cas_in_sql(monkeypatch):
    resp = _get(monkeypatch, rows=[_row()], params={"q": "aceto"})
    assert resp.status_code == 200
    sql, params = resp._fake_cursor.calls[-1]
    assert "ILIKE" in sql and "cas_number" in sql and "name" in sql
    assert params == ("comp-1", "%aceto%", "%aceto%")


def test_no_query_param_omits_ilike_filter(monkeypatch):
    resp = _get(monkeypatch, rows=[_row()])
    sql, params = resp._fake_cursor.calls[-1]
    assert "ILIKE" not in sql
    assert params == ("comp-1",)


# ── tenant scoping ────────────────────────────────────────────────────────────

def test_query_is_company_scoped(monkeypatch):
    resp = _get(monkeypatch, rows=[], company=_company(id="tenant-a"))
    sql, params = resp._fake_cursor.calls[-1]
    assert "company_id = %s" in sql
    assert params[0] == "tenant-a"


# ── generic (non-chemical) bot ────────────────────────────────────────────────

def test_generic_bot_with_no_get_sds_tool_is_404(monkeypatch):
    resp = _get(monkeypatch, rows=[_row()], company=_company(vertical=None))
    assert resp.status_code == 404


# ── auth wiring (real dependency, not overridden) ────────────────────────────

class _AuthRejectCursor:
    def execute(self, sql, params=None):
        pass

    def fetchone(self):
        return None  # no company matches this key

    def close(self):
        pass


class _AuthRejectConn:
    def cursor(self):
        return _AuthRejectCursor()


def test_invalid_api_key_is_401(monkeypatch):
    monkeypatch.setattr(m, "get_db_connection", lambda: _AuthRejectConn())
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    tc = TestClient(m.app)
    resp = tc.get("/api/widget/sds-products", headers={"x-api-key": "bad-key"})
    assert resp.status_code == 401


def test_missing_api_key_header_is_rejected(monkeypatch):
    # This FastAPI version's APIKeyHeader(auto_error=True) raises 401 (not 403)
    # for a missing header, before verify_api_key_and_origin's body even runs.
    tc = TestClient(m.app)
    resp = tc.get("/api/widget/sds-products")
    assert resp.status_code == 401
