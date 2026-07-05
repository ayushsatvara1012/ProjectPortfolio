"""Unit tests for services.session_store (Intelligent Agent Memory — Phase 1b–1d).

Covers the pure persistence helpers with a scripted fake cursor (no real DB):
  - upsert_session     : INSERT … ON CONFLICT carries visitor_id, scoped by company
  - set_session_title  : title set once, never overwritten (WHERE title IS NULL)
  - append_message     : JSON columns serialised, tenant-scoped
  - load_hybrid_context: summary + last-N messages chronological
  - count_messages     : COUNT scoped (session_id, company_id)
  - derive_title       : quote / SDS / sample / nothing
"""
import asyncio
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
            fetchall_results=[[("user", "hi", None), ("assistant", "hello", None)]],
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
            fetchall_results=[[("user", None, None)]],
        )
        _, messages = session_store.load_hybrid_context(cur, "sess-1", "comp-1")
        assert messages == [{"role": "user", "content": ""}]

    # ── cost-control follow-up: reattaching the quote state note ────────────

    def test_assistant_message_with_quote_action_gets_state_note(self):
        actions = {"quote": {"status": "quoted", "product": "Acetone", "grade": "AR",
                              "pack_size": "2.5 Ltr", "quantity": 2,
                              "unit_price": 1894.0, "subtotal": 3788.0, "currency": "INR"}}
        cur = FakeCursor(
            fetchone_results=[(None,)],
            fetchall_results=[[("assistant", "Here's your quote.", actions)]],
        )
        _, messages = session_store.load_hybrid_context(cur, "sess-1", "comp-1")
        assert messages[0]["content"] == (
            "Here's your quote.\n"
            "[State: Acetone AR 2.5 Ltr × 2 quoted at INR 1894.0 each, subtotal INR 3788.0]"
        )

    def test_actions_as_json_string_is_parsed(self):
        # Some DB drivers may hand back the jsonb column as a raw string.
        actions_json = '{"quote": {"status": "price_on_request", "product": "Toluene"}}'
        cur = FakeCursor(
            fetchone_results=[(None,)],
            fetchall_results=[[("assistant", "Logged.", actions_json)]],
        )
        _, messages = session_store.load_hybrid_context(cur, "sess-1", "comp-1")
        assert "[State: Toluene — price on request, contact captured]" in messages[0]["content"]

    def test_user_message_never_gets_a_state_note(self):
        actions = {"quote": {"status": "quoted", "product": "Acetone", "unit_price": 1}}
        cur = FakeCursor(
            fetchone_results=[(None,)],
            fetchall_results=[[("user", "how much for acetone?", actions)]],
        )
        _, messages = session_store.load_hybrid_context(cur, "sess-1", "comp-1")
        assert messages[0]["content"] == "how much for acetone?"

    def test_no_actions_leaves_content_untouched(self):
        cur = FakeCursor(
            fetchone_results=[(None,)],
            fetchall_results=[[("assistant", "hi there", None)]],
        )
        _, messages = session_store.load_hybrid_context(cur, "sess-1", "comp-1")
        assert messages[0]["content"] == "hi there"

    def test_non_quote_action_leaves_content_untouched(self):
        # e.g. an SDS-only turn — no quote to restate, nothing to append.
        cur = FakeCursor(
            fetchone_results=[(None,)],
            fetchall_results=[[("assistant", "Here's the SDS.", {"sds": {"product": "Acetone"}})]],
        )
        _, messages = session_store.load_hybrid_context(cur, "sess-1", "comp-1")
        assert messages[0]["content"] == "Here's the SDS."

    def test_malformed_actions_never_crashes_context_load(self):
        # Defensive: a corrupted/unexpected actions blob must degrade to
        # untouched content, never break the whole /api/chat turn.
        cur = FakeCursor(
            fetchone_results=[(None,)],
            fetchall_results=[[
                ("assistant", "not json {{{", "not json {{{"),
                ("assistant", "quote is a list", {"quote": ["oops", "not-a-dict"]}),
                ("assistant", "actions is a list", [1, 2, 3]),
            ]],
        )
        _, messages = session_store.load_hybrid_context(cur, "sess-1", "comp-1")
        assert [m["content"] for m in messages] == [
            "not json {{{", "quote is a list", "actions is a list",
        ]


# ── quote_state_note ────────────────────────────────────────────────────────

class TestQuoteStateNote:
    def test_quoted_status(self):
        note = session_store.quote_state_note({
            "status": "quoted", "product": "Acetone", "grade": "AR",
            "pack_size": "2.5 Ltr", "quantity": 2,
            "unit_price": 1894.0, "subtotal": 3788.0, "currency": "INR",
        })
        assert note == "[State: Acetone AR 2.5 Ltr × 2 quoted at INR 1894.0 each, subtotal INR 3788.0]"

    def test_price_on_request_status(self):
        note = session_store.quote_state_note({
            "status": "price_on_request", "product": "Toluene", "quantity": 5,
        })
        assert note == "[State: Toluene × 5 — price on request, contact captured]"

    def test_missing_product_returns_none(self):
        assert session_store.quote_state_note({"status": "quoted", "unit_price": 1}) is None

    def test_unrecognized_status_returns_none(self):
        # e.g. needs_grade/needs_pack/confirm_quantity never get persisted as a
        # completed "quote" action in the first place, but stay defensive anyway.
        assert session_store.quote_state_note({"status": "needs_grade", "product": "Acetone"}) is None

    def test_non_dict_input_returns_none(self):
        assert session_store.quote_state_note(["not", "a", "dict"]) is None
        assert session_store.quote_state_note("also not a dict") is None


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


# ── maybe_summarize_session: rolling-summary gating (no LLM call needed) ──────
# These only exercise the cheap DB-only gate that decides whether a summarize
# pass is due — they never reach the LLM call, so no network/mock needed.

class FakeConn:
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


class TestMaybeSummarizeSessionGating:
    def _run(self, cur):
        conn = FakeConn(cur)
        released = []
        asyncio.run(session_store.maybe_summarize_session(
            "sess-1", "comp-1",
            get_conn=lambda: conn,
            release_conn=lambda c: released.append(c),
        ))
        assert released == [conn]
        return conn, cur

    def test_no_session_row_skips(self):
        cur = FakeCursor(fetchone_results=[None])
        conn, cur = self._run(cur)
        assert not conn.committed

    def test_below_summary_threshold_skips(self):
        # summary=None, summarized_through=0, total=8 (== SUMMARY_THRESHOLD, not >).
        cur = FakeCursor(fetchone_results=[(None, 0), (8,)])
        conn, cur = self._run(cur)
        assert not conn.committed
        # Only the two gating SELECTs ran — never reached the transcript load.
        assert len(cur.calls) == 2

    def test_nothing_new_since_last_summary_skips(self):
        # Already summarized through message 10; total 15 → summarize_through
        # = 15 - VERBATIM_LIMIT(8) = 7, which is <= summarized_through(10).
        cur = FakeCursor(fetchone_results=[("prior summary", 10), (15,)])
        conn, cur = self._run(cur)
        assert not conn.committed
        assert len(cur.calls) == 2

    def test_new_messages_since_last_summary_proceeds_to_transcript_load(self):
        # summarized_through=0, total=20 → summarize_through = 12 > 0, due.
        # No GEMINI_API_KEY in a way that short-circuits before the LLM call
        # is fine here — we only assert it got past the gate to load messages.
        cur = FakeCursor(
            fetchone_results=[(None, 0), (20,)],
            fetchall_results=[[("user", "hi")] * 12],
        )
        conn = FakeConn(cur)
        released = []
        import os as _os
        old_key = _os.environ.pop("GEMINI_API_KEY", None)
        try:
            asyncio.run(session_store.maybe_summarize_session(
                "sess-1", "comp-1",
                get_conn=lambda: conn,
                release_conn=lambda c: released.append(c),
            ))
        finally:
            if old_key is not None:
                _os.environ["GEMINI_API_KEY"] = old_key
        # Got past the gate (transcript SELECT ran, 3rd call) then bailed
        # cleanly on the missing API key — never committed.
        assert len(cur.calls) == 3
        assert not conn.committed
