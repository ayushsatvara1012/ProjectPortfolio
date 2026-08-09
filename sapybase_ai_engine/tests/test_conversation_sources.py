"""Slice D — owner-facing source attribution (agent-conversation-gaps plan §12).

Covers the pure source-builders (_build_kb_sources / _build_tool_sources), the
new on-demand chunk endpoint, and the widened /api/conversations SELECT shape.
No live LLM involved anywhere here — deterministic Python + fake DB cursors.
"""
import json
from contextlib import contextmanager
from datetime import datetime, timezone

from fastapi.testclient import TestClient

import main as m

_TS = datetime(2026, 8, 8, tzinfo=timezone.utc)


# ── pure: _build_kb_sources ───────────────────────────────────────────────────

class TestBuildKbSources:
    def test_builds_ranked_entries_with_scores(self):
        docs = [("content a", "https://acme.test/a", "id-1"),
                ("content b", "https://acme.test/b", "id-2")]
        out = m._build_kb_sources(docs, [8.5, 6.0])
        assert out == [
            {"kind": "kb", "label": "https://acme.test/a", "content_id": "id-1", "rank": 1, "score": 8.5},
            {"kind": "kb", "label": "https://acme.test/b", "content_id": "id-2", "rank": 2, "score": 6.0},
        ]

    def test_never_includes_chunk_content(self):
        # §12.3/§12.7: pointer, not excerpt.
        docs = [("the actual chunk text nobody should see here", "u", "id-1")]
        out = m._build_kb_sources(docs, [None])
        assert "the actual chunk text" not in json.dumps(out)

    def test_handles_missing_scores_and_short_rows(self):
        # A 2-tuple row (no content_id) and a shorter scores list must not crash.
        docs = [("c", "u")]
        out = m._build_kb_sources(docs, [])
        assert out == [{"kind": "kb", "label": "u", "content_id": None, "rank": 1, "score": None}]

    def test_empty_input_returns_empty_list(self):
        assert m._build_kb_sources([], []) == []
        assert m._build_kb_sources(None, None) == []

    def test_no_url_falls_back_to_untitled_label(self):
        out = m._build_kb_sources([("c", None, "id-1")], [None])
        assert out[0]["label"] == "(untitled source)"


# ── pure: _build_tool_sources ─────────────────────────────────────────────────

class TestBuildToolSources:
    def test_sds_source(self):
        captured = {"sds": {"product": "Acetone", "url": "https://sds.example.com/a.pdf"}}
        out = m._build_tool_sources(captured)
        assert out == [{"kind": "tool", "label": "get_sds", "detail": "Acetone",
                        "url": "https://sds.example.com/a.pdf"}]

    def test_spec_source_has_no_url(self):
        captured = {"spec": {"product": "Hexane", "grade": "LR"}}
        out = m._build_tool_sources(captured)
        assert out == [{"kind": "tool", "label": "get_product_spec", "detail": "Hexane", "url": None}]

    def test_quote_source_carries_quote_url(self):
        captured = {"quote": {"product": "Acetone", "quote_url": "https://x.test/q/abc"}}
        out = m._build_tool_sources(captured)
        assert out == [{"kind": "tool", "label": "request_quote", "detail": "Acetone",
                        "url": "https://x.test/q/abc"}]

    def test_coa_source_never_carries_a_url(self):
        # docs/coa-confidential-access-plan.md — no link surfaced here even to
        # the owner; this module has no visibility into throttle/lockout state.
        captured = {"coa": {"status": "found", "results": [{"name": "Batch-42.pdf"}],
                            "query": "batch 100.26"}}
        out = m._build_tool_sources(captured)
        assert out == [{"kind": "tool", "label": "get_coa", "detail": "batch 100.26", "url": None}]

    def test_coa_not_found_produces_no_source(self):
        captured = {"coa": {"status": "not_found", "results": [], "query": "x"}}
        assert m._build_tool_sources(captured) == []

    def test_sample_form_source(self):
        captured = {"form": {"form_id": "sample", "prefill": {}}}
        out = m._build_tool_sources(captured)
        assert out == [{"kind": "tool", "label": "request_sample", "detail": None, "url": None}]

    def test_multiple_tools_all_included_in_order(self):
        captured = {"sds": {"product": "A"}, "quote": {"product": "A", "quote_url": None}}
        out = m._build_tool_sources(captured)
        assert [s["label"] for s in out] == ["get_sds", "request_quote"]

    def test_empty_captured_returns_empty_list(self):
        assert m._build_tool_sources({}) == []


# ── endpoint: GET /api/conversations/{company_id}/chunk/{chunk_id} ────────────

class _FakeChunkCursor:
    def __init__(self, *, owns=True, chunk_row=None):
        self._owns = owns
        self._chunk_row = chunk_row
        self._sql = ""

    def execute(self, sql, params=None):
        self._sql = sql

    def fetchone(self):
        if "FROM companies" in self._sql:
            return ("comp-1",) if self._owns else None
        if "FROM company_knowledge" in self._sql:
            return self._chunk_row
        return None

    def cursor(self):
        return self


class _FakeChunkConn:
    def __init__(self, cur):
        self._cur = cur

    def cursor(self):
        return self._cur


def _admin_user():
    return {"id": "u1", "role": "SUPER_ADMIN", "email": "a@b.com"}


def test_get_chunk_returns_content_and_url(monkeypatch):
    cur = _FakeChunkCursor(owns=True, chunk_row=("the chunk text", "https://acme.test/pricing"))
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeChunkConn(cur))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m.byod_engine, "routing_active", lambda cid: False)
    m.app.dependency_overrides[m.get_current_user] = _admin_user
    try:
        resp = TestClient(m.app).get("/api/conversations/comp-1/chunk/id-1")
    finally:
        m.app.dependency_overrides.clear()
    assert resp.status_code == 200
    assert resp.json() == {"content": "the chunk text", "url": "https://acme.test/pricing"}


def test_get_chunk_404_when_not_owned(monkeypatch):
    cur = _FakeChunkCursor(owns=False)
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeChunkConn(cur))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.get_current_user] = _admin_user
    try:
        resp = TestClient(m.app).get("/api/conversations/comp-1/chunk/id-1")
    finally:
        m.app.dependency_overrides.clear()
    assert resp.status_code == 404


def test_get_chunk_404_when_chunk_missing(monkeypatch):
    cur = _FakeChunkCursor(owns=True, chunk_row=None)
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeChunkConn(cur))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m.byod_engine, "routing_active", lambda cid: False)
    m.app.dependency_overrides[m.get_current_user] = _admin_user
    try:
        resp = TestClient(m.app).get("/api/conversations/comp-1/chunk/does-not-exist")
    finally:
        m.app.dependency_overrides.clear()
    assert resp.status_code == 404


def test_get_chunk_requires_analytics_entitlement(monkeypatch):
    cur = _FakeChunkCursor(owns=True, chunk_row=("x", "u"))
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeChunkConn(cur))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.get_current_user] = lambda: {"id": "u1", "role": "OWNER", "tier": "FREE"}
    try:
        resp = TestClient(m.app).get("/api/conversations/comp-1/chunk/id-1")
    finally:
        m.app.dependency_overrides.clear()
    assert resp.status_code == 402


# ── endpoint: GET /api/conversations/{company_id} — widened SELECT shape ──────

class _FakeConvCursor:
    def __init__(self, *, message_row, session_count=1):
        self._message_row = message_row
        self._session_count = session_count
        self._sql = ""

    def execute(self, sql, params=None):
        self._sql = sql

    def fetchone(self):
        if "FROM companies" in self._sql:
            return ("comp-1",)
        if "COUNT(*)" in self._sql:
            return (self._session_count,)
        return None

    def fetchall(self):
        if "GROUP BY grp" in self._sql and "MAX(created_at)" in self._sql:
            return [("sess-1", _TS, 1, False)]
        if "FROM chat_logs" in self._sql and "GROUP BY" not in self._sql:
            return [self._message_row]
        return []


class _FakeConvConn:
    def __init__(self, cur):
        self._cur = cur

    def cursor(self):
        return self._cur


def test_conversations_includes_sources_and_was_cache_hit(monkeypatch):
    row = ("hi", "hello there", False, _TS, True, json.dumps([{"kind": "kb", "label": "u", "rank": 1}]))
    cur = _FakeConvCursor(message_row=row)
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConvConn(cur))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m.byod_engine, "routing_active", lambda cid: False)
    m.app.dependency_overrides[m.get_current_user] = _admin_user
    try:
        resp = TestClient(m.app).get("/api/conversations/comp-1")
    finally:
        m.app.dependency_overrides.clear()
    assert resp.status_code == 200
    msg = resp.json()["sessions"][0]["messages"][0]
    assert msg["was_cache_hit"] is True
    assert msg["sources"] == [{"kind": "kb", "label": "u", "rank": 1}]


def test_conversations_deserializes_sources_when_driver_returns_raw_string(monkeypatch):
    # Defensive path: some pool/driver configs hand back JSONB as text.
    row = ("hi", "hello", False, _TS, False, '[{"kind": "tool", "label": "get_sds"}]')
    cur = _FakeConvCursor(message_row=row)
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConvConn(cur))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m.byod_engine, "routing_active", lambda cid: False)
    m.app.dependency_overrides[m.get_current_user] = _admin_user
    try:
        resp = TestClient(m.app).get("/api/conversations/comp-1")
    finally:
        m.app.dependency_overrides.clear()
    msg = resp.json()["sessions"][0]["messages"][0]
    assert msg["sources"] == [{"kind": "tool", "label": "get_sds"}]


def test_conversations_null_sources_render_as_none_not_recorded(monkeypatch):
    row = ("hi", "hello", False, _TS, False, None)
    cur = _FakeConvCursor(message_row=row)
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConvConn(cur))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m.byod_engine, "routing_active", lambda cid: False)
    m.app.dependency_overrides[m.get_current_user] = _admin_user
    try:
        resp = TestClient(m.app).get("/api/conversations/comp-1")
    finally:
        m.app.dependency_overrides.clear()
    msg = resp.json()["sessions"][0]["messages"][0]
    assert msg["sources"] is None  # "not recorded" — the panel, not the API, renders that string


def test_conversations_byod_company_omits_sources_column_entirely(monkeypatch):
    # §12.5/§12.6 — selecting `sources` against a BYOD tenant DB (no such column
    # yet) must never be attempted; a 5-column row (no sources) is expected.
    row = ("hi", "hello", False, _TS, False)
    cur = _FakeConvCursor(message_row=row)
    # The control connection is never used once routing is active; only the
    # tenant one matters for chat_logs reads.
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConvConn(_FakeConvCursor(message_row=row)))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m.byod_engine, "routing_active", lambda cid: True)

    @contextmanager
    def _fake_tenant_connection(company_id, **kw):
        yield _FakeConvConn(cur)

    monkeypatch.setattr(m.byod_engine, "tenant_connection", _fake_tenant_connection)
    m.app.dependency_overrides[m.get_current_user] = _admin_user
    try:
        resp = TestClient(m.app).get("/api/conversations/comp-1")
    finally:
        m.app.dependency_overrides.clear()
    assert resp.status_code == 200
    msg = resp.json()["sessions"][0]["messages"][0]
    assert msg["sources"] is None
    # The per-message SELECT that ran on the TENANT cursor never named `sources`.
    assert "sources" not in cur._sql
