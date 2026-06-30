"""Unit tests for services.session_store (Intelligent Agent Memory — Phase 1b–1d).

Covers the pure persistence helpers with a scripted fake cursor (no real DB):
  - upsert_session     : INSERT … ON CONFLICT carries visitor_id, scoped by company
  - set_session_title  : title set once, never overwritten (WHERE title IS NULL)
  - append_message     : JSON columns serialised, tenant-scoped
  - load_hybrid_context: summary + last-N messages chronological
  - count_messages     : COUNT scoped (session_id, company_id)
  - derive_title       : quote / SDS / sample / nothing
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("GEMINI_API_KEY", "test-key")

from services import session_store  # noqa: E402


class FakeCursor:
    """Records every execute() and serves pre-scripted fetch results in order."""

    def __init__(self, fetchone_results=None, fetchall_results=None):
        self.calls = []  # list of (sql, params)
        self._fetchone = list(fetchone_results or [])
        self._fetchall = list(fetchall_results or [])

    def execute(self, sql, params=None):
        self.calls.append((sql, params))

    def fetchone(self):
        return self._fetchone.pop(0) if self._fetchone else None

    def fetchall(self):
        return self._fetchall.pop(0) if self._fetchall else []

    # convenience for assertions
    @property
    def last_sql(self):
        return self.calls[-1][0]

    @property
    def last_params(self):
        return self.calls[-1][1]


# ── upsert_session ────────────────────────────────────────────────────────────

class TestUpsertSession:
    def test_passes_visitor_id_in_params(self):
        cur = FakeCursor()
        session_store.upsert_session(cur, "sess-1", "comp-1", "vis-1")
        assert cur.last_params == ("sess-1", "comp-1", "vis-1")
        assert "INSERT INTO agent_sessions" in cur.last_sql
        assert "visitor_id" in cur.last_sql

    def test_visitor_id_defaults_to_none(self):
        cur = FakeCursor()
        session_store.upsert_session(cur, "sess-1", "comp-1")
        assert cur.last_params == ("sess-1", "comp-1", None)

    def test_conflict_keeps_existing_visitor_id(self):
        """Resume must not overwrite the original visitor_id."""
        cur = FakeCursor()
        session_store.upsert_session(cur, "sess-1", "comp-1", "vis-2")
        assert "COALESCE(agent_sessions.visitor_id, EXCLUDED.visitor_id)" in cur.last_sql

    def test_conflict_is_tenant_scoped(self):
        cur = FakeCursor()
        session_store.upsert_session(cur, "sess-1", "comp-1", "vis-1")
        assert "agent_sessions.company_id = EXCLUDED.company_id" in cur.last_sql


# ── set_session_title ─────────────────────────────────────────────────────────

class TestSetSessionTitle:
    def test_title_set_once_only(self):
        cur = FakeCursor()
        session_store.set_session_title(cur, "sess-1", "Ethanol quote")
        assert "title IS NULL" in cur.last_sql
        assert cur.last_params == ("Ethanol quote", "sess-1")


# ── append_message ────────────────────────────────────────────────────────────

class TestAppendMessage:
    def test_minimal_text_turn(self):
        cur = FakeCursor()
        session_store.append_message(cur, "sess-1", "comp-1", "user", "hello")
        sql, params = cur.calls[-1]
        assert "INSERT INTO agent_messages" in sql
        assert params[:4] == ("sess-1", "comp-1", "user", "hello")
        # tool_calls / observations / actions all None
        assert params[4] is None and params[5] is None and params[6] is None

    def test_json_columns_serialised(self):
        cur = FakeCursor()
        session_store.append_message(
            cur, "sess-1", "comp-1", "assistant", "here",
            tool_calls=[{"name": "request_quote"}],
            actions={"quote": {"product": "Ethanol"}},
        )
        params = cur.calls[-1][1]
        assert '"request_quote"' in params[4]   # tool_calls json
        assert params[5] is None                 # observations untouched
        assert '"Ethanol"' in params[6]          # actions json


# ── load_hybrid_context ───────────────────────────────────────────────────────

class TestLoadHybridContext:
    def test_returns_summary_and_messages(self):
        cur = FakeCursor(
            fetchone_results=[("a rolling summary",)],
            fetchall_results=[[("user", "hi"), ("assistant", "hello")]],
        )
        summary, messages = session_store.load_hybrid_context(cur, "sess-1", "comp-1")
        assert summary == "a rolling summary"
        assert messages == [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ]

    def test_no_summary_row(self):
        cur = FakeCursor(fetchone_results=[None], fetchall_results=[[]])
        summary, messages = session_store.load_hybrid_context(cur, "sess-x", "comp-1")
        assert summary is None
        assert messages == []

    def test_null_content_becomes_empty_string(self):
        cur = FakeCursor(
            fetchone_results=[(None,)],
            fetchall_results=[[("user", None)]],
        )
        _, messages = session_store.load_hybrid_context(cur, "sess-1", "comp-1")
        assert messages == [{"role": "user", "content": ""}]


# ── count_messages ────────────────────────────────────────────────────────────

class TestCountMessages:
    def test_count(self):
        cur = FakeCursor(fetchone_results=[(7,)])
        assert session_store.count_messages(cur, "sess-1", "comp-1") == 7
        assert cur.last_params == ("sess-1", "comp-1")

    def test_count_no_row(self):
        cur = FakeCursor(fetchone_results=[None])
        assert session_store.count_messages(cur, "sess-1", "comp-1") == 0


# ── derive_title ──────────────────────────────────────────────────────────────

class TestDeriveTitle:
    def test_quote(self):
        assert session_store.derive_title({"quote": {"product": "Ethanol"}}) == "Ethanol quote"

    def test_sds(self):
        assert session_store.derive_title({"sds": {"product": "Toluene"}}) == "Toluene SDS"

    def test_sample(self):
        assert session_store.derive_title({"form": {"prefill": {"product": "IPA"}}}) == "IPA sample"

    def test_quote_wins_over_sds(self):
        captured = {"quote": {"product": "Ethanol"}, "sds": {"product": "Toluene"}}
        assert session_store.derive_title(captured) == "Ethanol quote"

    def test_nothing_captured(self):
        assert session_store.derive_title({}) is None

    def test_blank_product_ignored(self):
        assert session_store.derive_title({"quote": {"product": "   "}}) is None
