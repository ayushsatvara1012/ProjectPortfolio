"""Endpoint tests for GET /api/knowledge/catalog/{company_id}.

Covers: ownership 404, non-vertical bot returns no tables, a vertical bot
returns its structured rows with information_schema-driven columns, and empty
catalog tables are still returned (frontend hides them).
"""
from fastapi.testclient import TestClient

import main as m
from packs.schema import CatalogTable, Pack


_SKU_COLUMNS = ["product_name", "cas_number", "grade", "list_price", "is_por"]
_SKU_IDS = ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"]
_SKU_ROWS = [
    ["Acetone", "67-64-1", "LR", "413.00", False],
    ["Benzene", "71-43-2", "LR", "481.00", False],
]

_FAKE_TABLE = CatalogTable(
    table_name="product_skus",
    required_columns=("product_name", "cas_number", "grade", "list_price"),
    not_null_columns=("product_name",),
)
_FAKE_PACK = Pack(vertical="chemical", persona_prompt="", catalog_tables=(_FAKE_TABLE,))


class _FakeCursor:
    def __init__(self, *, owns=True, vertical="chemical"):
        self.owns = owns
        self.vertical = vertical
        self._sql = ""
        self._params = None
        self.rowcount = 0
        self.deletes = []  # (sql, params) for each DELETE executed

    def execute(self, sql, params=None):
        self._sql = sql
        self._params = params
        if sql.strip().startswith("DELETE"):
            self.deletes.append((sql, params))
            # ANY-scoped delete removes just the requested ids; clear-all wipes rows.
            self.rowcount = len(params[1]) if "ANY" in sql else len(_SKU_ROWS)

    def fetchone(self):
        if "FROM companies" in self._sql:
            return (self.vertical,) if self.owns else None
        if "COUNT(*)" in self._sql:
            return (len(_SKU_ROWS),)
        return None

    def fetchall(self):
        if "information_schema.columns" in self._sql:
            return [(c,) for c in _SKU_COLUMNS]
        if "FROM product_skus" in self._sql:
            # GET selects `id, <cols>` — return the id ahead of each content row.
            return [[_SKU_IDS[i], *_SKU_ROWS[i]] for i in range(len(_SKU_ROWS))]
        return []

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


def _get(monkeypatch, *, owns=True, vertical="chemical", pack=_FAKE_PACK):
    cur = _FakeCursor(owns=owns, vertical=vertical)
    conn = _FakeConn(cur)
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m, "load_pack", lambda v: pack)
    m.app.dependency_overrides[m.get_current_user] = lambda: {"id": "user-1"}
    try:
        tc = TestClient(m.app)
        return tc.get("/api/knowledge/catalog/comp-1")
    finally:
        m.app.dependency_overrides.clear()


def test_catalog_returns_structured_rows(monkeypatch):
    resp = _get(monkeypatch)
    assert resp.status_code == 200
    tables = resp.json()["tables"]
    assert len(tables) == 1
    t = tables[0]
    assert t["table_name"] == "product_skus"
    assert t["columns"] == _SKU_COLUMNS
    assert t["rows"] == [list(r) for r in _SKU_ROWS]
    assert t["total"] == len(_SKU_ROWS)
    assert t["showing"] == len(_SKU_ROWS)


def test_catalog_non_vertical_bot_returns_empty(monkeypatch):
    # A pack without catalog_tables (generic bot) exposes no catalog.
    generic = Pack(vertical="generic", persona_prompt="", catalog_tables=())
    resp = _get(monkeypatch, vertical=None, pack=generic)
    assert resp.status_code == 200
    assert resp.json() == {"tables": []}


def test_catalog_no_pack_returns_empty(monkeypatch):
    resp = _get(monkeypatch, pack=None)
    assert resp.status_code == 200
    assert resp.json() == {"tables": []}


def test_catalog_unowned_is_404(monkeypatch):
    resp = _get(monkeypatch, owns=False)
    assert resp.status_code == 404


def _delete(monkeypatch, *, owns=True, vertical="chemical", pack=_FAKE_PACK, json=None):
    cur = _FakeCursor(owns=owns, vertical=vertical)
    conn = _FakeConn(cur)
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m, "load_pack", lambda v: pack)
    m.app.dependency_overrides[m.get_current_user] = lambda: {"id": "user-1"}
    try:
        tc = TestClient(m.app)
        return tc.request("DELETE", "/api/knowledge/catalog/comp-1", json=json), cur, conn
    finally:
        m.app.dependency_overrides.clear()


def test_catalog_clear_all_deletes_every_table(monkeypatch):
    resp, cur, conn = _delete(monkeypatch)
    assert resp.status_code == 200
    assert resp.json()["deleted"] == len(_SKU_ROWS)
    # Clear-all issues one DELETE per catalog table, scoped by company_id only.
    assert len(cur.deletes) == 1
    assert "ANY" not in cur.deletes[0][0]
    assert conn.committed


def test_catalog_delete_rows_scoped_to_ids(monkeypatch):
    resp, cur, conn = _delete(
        monkeypatch, json={"table_name": "product_skus", "row_ids": [_SKU_IDS[0]]}
    )
    assert resp.status_code == 200
    assert resp.json()["deleted"] == 1
    sql, params = cur.deletes[0]
    assert "ANY" in sql and "id =" in sql
    assert params == ("comp-1", [_SKU_IDS[0]])
    assert conn.committed


def test_catalog_delete_rejects_unknown_table(monkeypatch):
    resp, cur, conn = _delete(
        monkeypatch, json={"table_name": "companies", "row_ids": [_SKU_IDS[0]]}
    )
    assert resp.status_code == 400
    assert cur.deletes == []


def test_catalog_delete_unowned_is_404(monkeypatch):
    resp, cur, conn = _delete(monkeypatch, owns=False)
    assert resp.status_code == 404
    assert cur.deletes == []


def test_catalog_delete_non_vertical_is_400(monkeypatch):
    generic = Pack(vertical="generic", persona_prompt="", catalog_tables=())
    resp, cur, conn = _delete(monkeypatch, vertical=None, pack=generic)
    assert resp.status_code == 400
    assert cur.deletes == []
