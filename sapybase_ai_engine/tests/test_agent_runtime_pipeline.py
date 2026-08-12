"""Phase 6: the turn pipeline, driven end to end.

docs/agent-runtime-restructure-plan.md Phase 6. Before the extraction a turn could
only be exercised through /api/chat with a live model, a live DB and an SSE client,
which is why the orchestration bugs (B3's side effects on a failed turn, B4's
single-slot cards) were only ever found in production transcripts. These tests run
the whole turn - tool round, capture, settle, escalation, persistence - over fakes.
"""
import asyncio

import pytest

from services.agent_runtime import pipeline
from services.agent_runtime.loop import AGENT_FALLBACK_TEXT
from services.agent_runtime.states import TurnState


class FakeResp:
    def __init__(self, content="", tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls or []


class FakeModel:
    def __init__(self, responses, delay=0.0):
        self._responses = list(responses)
        self._delay = delay
        self.invocations = []

    async def ainvoke(self, convo):
        idx = len(self.invocations)
        self.invocations.append(list(convo))
        if self._delay:
            await asyncio.sleep(self._delay)
        return self._responses[idx]


class FakeCursor:
    """Answers the only queries the pipeline itself makes: the capture-existence
    check, and whatever session_store writes (which are stubbed out below)."""

    def __init__(self, has_capture=False):
        self.has_capture = has_capture
        self.executed = []

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return (1,) if self.has_capture else None

    def fetchall(self):
        return []


@pytest.fixture(autouse=True)
def no_session_writes(monkeypatch):
    """The session store has its own tests; here it only needs to not touch a DB."""
    from services import sales_funnel, session_store

    calls = {}
    monkeypatch.setattr(session_store, "append_message",
                        lambda *a, **k: calls.setdefault("messages", []).append(a))
    monkeypatch.setattr(session_store, "derive_title", lambda captured: None)
    monkeypatch.setattr(session_store, "update_session_state", lambda *a, **k: None)
    monkeypatch.setattr(session_store, "update_lead_profile", lambda *a, **k: None)
    monkeypatch.setattr(session_store, "count_messages", lambda *a, **k: 2)
    monkeypatch.setattr(sales_funnel, "build_lead_profile", lambda prior, cap, score: {})
    monkeypatch.setattr(sales_funnel, "derive_state", lambda prior, cap, lp: {})
    return calls


def _inputs(**over):
    base = dict(
        company={"id": "c1", "human_handoff_enabled": True},
        message="do you have acetone?",
        session_id="s1",
        session_active=True,
        retrieved_doc_count=0,
    )
    base.update(over)
    return pipeline.TurnInputs(**base)


def _drive(inputs, model, executor=None, captured=None, cursor=None, **over):
    """Run a turn to completion, returning (events, TurnResult)."""
    captured = {} if captured is None else captured
    events = []

    async def go():
        kwargs = dict(
            model=model,
            messages=[],
            tool_executor=executor or (lambda name, args: {"status": "found"}),
            captured=captured,
            cursor=cursor or FakeCursor(),
            commit=lambda: None,
            rollback=lambda: None,
            deadline_s=5.0,
        )
        kwargs.update(over)
        async for ev in pipeline.run_agent_turn(inputs, **kwargs):
            events.append(ev)

    asyncio.run(go())
    result = next(e["turn"] for e in events if e["type"] == "result")
    return events, result


class TestTheTurnSettles:
    def test_a_tool_answered_turn_is_answered_with_the_tool_as_its_source(self):
        model = FakeModel([
            FakeResp(tool_calls=[{"name": "get_sds", "args": {}, "id": "1"}]),
            FakeResp(content="The safety sheet is ready."),
        ])
        captured = {"sds": {"url": "https://x/sds.pdf", "product": "Acetone"}}
        _, turn = _drive(_inputs(), model, captured=captured)

        assert turn.state is TurnState.ANSWERED
        assert turn.text == "The safety sheet is ready."
        assert any(s["label"] == "get_sds" for s in turn.sources)

    def test_zero_retrieval_with_no_tool_is_not_answered(self):
        model = FakeModel([FakeResp(content="Sure, here is what I know.")])
        _, turn = _drive(_inputs(), model)
        assert turn.state is not TurnState.ANSWERED

    def test_the_loops_own_giveup_text_is_a_system_error_not_a_data_gap(self):
        """Outcome 6 is never presented as outcome 4 (§1.2)."""
        model = FakeModel([FakeResp(content=""), FakeResp(content="")])
        _, turn = _drive(_inputs(), model)
        assert turn.state is TurnState.SYSTEM_ERROR

    def test_a_blown_deadline_settles_as_system_error(self):
        model = FakeModel([FakeResp(content="too late")], delay=0.5)
        _, turn = _drive(_inputs(), model, deadline_s=0.05, heartbeat_s=0.01)
        assert turn.state is TurnState.SYSTEM_ERROR
        assert turn.text != "too late"


class TestFramesTheCallerEmits:
    def test_every_captured_card_becomes_its_own_event(self):
        """B4: cards are a list, so two lookups in one turn are two entries rather
        than one slot the second overwrites."""
        model = FakeModel([FakeResp(content="Here you go.")])
        captured = {
            "sds": {"url": "https://x/a.pdf", "product": "A"},
            "quote": {"status": "quoted", "product": "A", "subtotal": 10},
        }
        _, turn = _drive(_inputs(), model, captured=captured)
        kinds = [e.type for e in turn.events]
        assert "sds" in kinds and "quote" in kinds

    def test_the_owner_handoff_is_never_a_visitor_facing_frame(self):
        model = FakeModel([FakeResp(content="Logged.")])
        captured = {"quote": {"product": "A"}, "handoff": {"kind": "quote"}}
        _, turn = _drive(_inputs(), model, captured=captured)
        assert "handoff" not in [e.type for e in turn.events]

    def test_asking_for_a_person_emits_one_connect_form(self):
        model = FakeModel([FakeResp(content="Of course.")])
        _, turn = _drive(_inputs(message="can I talk to a human?"), model,
                         captured={"spec": {"product": "A"}})
        escalate = [e for e in turn.events if e.type == "escalate"]
        assert len(escalate) == 1
        assert escalate[0].payload["cause"] == "person_requested"
        assert escalate[0].payload["destination"] == "handoff"

    def test_a_bot_entitled_to_neither_endpoint_is_shown_no_form(self):
        model = FakeModel([FakeResp(content="Of course.")])
        _, turn = _drive(
            _inputs(company={"id": "c1"}, message="can I talk to a human?"),
            model, captured={"spec": {"product": "A"}})
        assert not any(e.type == "escalate" for e in turn.events)

    def test_heartbeats_reach_the_caller_while_a_round_runs(self):
        model = FakeModel([FakeResp(content="Done.")], delay=0.08)
        events, _ = _drive(_inputs(), model, heartbeat_s=0.01)
        assert any(e["type"] == "ping" for e in events)


class TestPersistenceOrdering:
    def test_the_session_write_happens_after_the_answer_is_framed(self):
        """The visitor reads the reply before the commit, exactly as the handler
        used to do it - the write runs when the caller comes back for the next
        event, not before the result is handed over."""
        model = FakeModel([FakeResp(content="Yes, we stock it.")])
        order = []

        async def go():
            async for ev in pipeline.run_agent_turn(
                _inputs(), model=model, messages=[],
                tool_executor=lambda n, a: {"status": "found"},
                captured={"spec": {"product": "A"}}, cursor=FakeCursor(),
                commit=lambda: order.append("commit"),
                rollback=lambda: None, deadline_s=5.0,
            ):
                if ev["type"] == "result":
                    order.append("framed")

        asyncio.run(go())
        assert order == ["framed", "commit"]

    def test_a_failed_session_write_never_breaks_the_turn(self):
        model = FakeModel([FakeResp(content="Yes, we stock it.")])
        rolled = []

        def boom():
            raise RuntimeError("db gone")

        _, turn = _drive(_inputs(), model, captured={"spec": {"product": "A"}},
                         commit=boom, rollback=lambda: rolled.append(1))
        assert turn.text == "Yes, we stock it."
        assert rolled == [1]


class TestVolunteeredContact:
    def test_an_email_typed_mid_chat_becomes_an_owner_handoff(self, monkeypatch):
        from services.agent_runtime import pipeline as mod

        recorded = {}
        monkeypatch.setattr(mod, "insert_agent_request",
                            lambda *a, **k: recorded.update(k) or True)
        model = FakeModel([FakeResp(content="Noted, thank you.")])
        captured = {"spec": {"product": "Acetone"}}
        _drive(_inputs(message="reach me on buyer@corp.com"), model, captured=captured)

        assert captured["handoff"]["contact_email"] == "buyer@corp.com"
        assert recorded["kind"] == "contact"

    def test_a_session_that_already_reached_the_owner_is_not_pinged_twice(self):
        model = FakeModel([FakeResp(content="Noted.")])
        captured = {"spec": {"product": "Acetone"}}
        _drive(_inputs(message="reach me on buyer@corp.com"), model,
               captured=captured, cursor=FakeCursor(has_capture=True))
        assert "handoff" not in captured

    def test_a_tools_own_handoff_is_never_overwritten(self):
        model = FakeModel([FakeResp(content="Quoted.")])
        captured = {"handoff": {"kind": "quote", "product": "Acetone"}}
        _drive(_inputs(message="reach me on buyer@corp.com"), model, captured=captured)
        assert captured["handoff"]["kind"] == "quote"


class TestProseTurn:
    def test_a_generic_turn_is_classified_but_never_rewritten(self):
        turn = pipeline.settle_prose_turn(
            text="I don't have that on file.",
            message="who is your CFO?",
            retrieved_doc_count=0,
            sources=[],
            company={"id": "c1", "human_handoff_enabled": True},
            prior_messages=[],
        )
        assert turn.state is TurnState.NO_DATA
        assert turn.text == "I don't have that on file.", "tokens already shipped"

    def test_a_second_refusal_in_a_row_escalates(self):
        turn = pipeline.settle_prose_turn(
            text="I don't have that on file.",
            message="ok what about the finance lead?",
            retrieved_doc_count=0,
            sources=[],
            company={"id": "c1", "human_handoff_enabled": True},
            prior_messages=[{"role": "bot", "content": "I don't have that on file."}],
        )
        causes = [e.payload["cause"] for e in turn.events if e.type == "escalate"]
        assert causes == ["repeat_refusal"]
