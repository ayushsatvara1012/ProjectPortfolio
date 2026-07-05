"""Endpoint tests for POST /api/companies/{id}/sample-sink/test — Phase 3.4.

The "Send test row" button fires the owner's configured spreadsheet sink and
reports the outcome. Covers: ownership 404, NO_SINK 400 when unconfigured, and
the ok/failed pass-through of the sink result.
"""
from fastapi.testclient import TestClient

import main as m

_SINK_OVERRIDES = {"sample_sink": {
    "url": "https://script.google.com/macros/s/AKtest/exec", "secret": "s"}}


class _Cursor:
    def __init__(self, row):
        self._row = row

    def execute(self, *a, **k):
        pass

    def fetchone(self):
        return self._row

    def close(self):
        pass


class _Conn:
    def __init__(self, cursor):
        self._cursor = cursor
        self.committed = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True

    def rollback(self):
        pass


def _post(monkeypatch, *, owns=True, overrides=None, sink_result=(True, "HTTP 200")):
    row = (overrides,) if owns else None
    conn = _Conn(_Cursor(row))
    monkeypatch.setattr(m, "get_db_connection", lambda: conn)
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)

    async def _fake_sink(url, secret, payload):
        return sink_result

    monkeypatch.setattr(m, "_fire_sheet_sink", _fake_sink)
    m.app.dependency_overrides[m.get_current_user] = lambda: {"id": "u1"}
    try:
        tc = TestClient(m.app)
        resp = tc.post("/api/companies/c1/sample-sink/test")
        resp._conn = conn
        return resp
    finally:
        m.app.dependency_overrides.clear()


def test_unowned_bot_is_404(monkeypatch):
    resp = _post(monkeypatch, owns=False)
    assert resp.status_code == 404


def test_no_sink_configured_is_400(monkeypatch):
    resp = _post(monkeypatch, overrides=None)
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "NO_SINK"


def test_successful_sink_returns_ok_true(monkeypatch):
    resp = _post(monkeypatch, overrides=_SINK_OVERRIDES, sink_result=(True, "HTTP 200"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True and body["channel"] == "sink"
    assert resp._conn.committed  # status persisted


def test_failed_sink_returns_ok_false_with_detail(monkeypatch):
    resp = _post(monkeypatch, overrides=_SINK_OVERRIDES, sink_result=(False, "boom"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False and body["detail"] == "boom"
