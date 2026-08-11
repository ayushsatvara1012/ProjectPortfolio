"""Phase 1 contracts: the turn-outcome state table and TurnResult invariants.

docs/agent-runtime-restructure-plan.md Phase 1. Rule 8 ("degrade in one direction
only") lived in the prompt and was therefore unenforced and untested; these are
the cases that make it real.
"""
import pytest

from services.agent_runtime import (
    RefusalCause,
    ToolCall,
    TurnEvent,
    TurnResult,
    TurnState,
    is_legal_transition,
    next_legal_states,
)


class TestLegalTransitions:
    def test_first_turn_allows_every_outcome(self):
        assert set(next_legal_states(None)) == set(TurnState)

    @pytest.mark.parametrize("previous", list(TurnState))
    @pytest.mark.parametrize("proposed", [TurnState.ANSWERED, TurnState.PARTIAL])
    def test_success_is_always_reachable(self, previous, proposed):
        assert is_legal_transition(previous, proposed)

    @pytest.mark.parametrize("previous", list(TurnState))
    def test_out_of_scope_is_always_reachable(self, previous):
        assert is_legal_transition(previous, TurnState.OUT_OF_SCOPE)

    def test_cannot_climb_back_up_the_degrade_ladder(self):
        assert not is_legal_transition(TurnState.NO_DATA, TurnState.NEED_ONE_THING)

    def test_a_second_clarifying_question_is_still_legal(self):
        assert is_legal_transition(TurnState.NEED_ONE_THING, TurnState.NEED_ONE_THING)

    def test_degrading_further_down_the_ladder_is_legal(self):
        assert is_legal_transition(TurnState.PARTIAL, TurnState.NEED_ONE_THING)
        assert is_legal_transition(TurnState.NEED_ONE_THING, TurnState.NO_DATA)

    def test_repeating_a_refusal_requires_escalation(self):
        assert not is_legal_transition(TurnState.NO_DATA, TurnState.NO_DATA)
        assert is_legal_transition(TurnState.NO_DATA, TurnState.NO_DATA, escalating=True)

    def test_repeating_a_system_error_requires_escalation(self):
        assert not is_legal_transition(TurnState.SYSTEM_ERROR, TurnState.SYSTEM_ERROR)
        assert is_legal_transition(
            TurnState.SYSTEM_ERROR, TurnState.SYSTEM_ERROR, escalating=True
        )

    def test_system_error_may_follow_any_outcome(self):
        for previous in (TurnState.ANSWERED, TurnState.PARTIAL, TurnState.NO_DATA):
            assert is_legal_transition(previous, TurnState.SYSTEM_ERROR)

    def test_no_data_after_a_refusal_free_topic_is_legal(self):
        assert is_legal_transition(TurnState.ANSWERED, TurnState.NO_DATA)


class TestTurnResultInvariants:
    def test_answered_requires_a_source(self):
        with pytest.raises(ValueError):
            TurnResult(state=TurnState.ANSWERED, text="It is 40C.")

    def test_answered_with_a_source_is_valid(self):
        r = TurnResult(
            state=TurnState.ANSWERED,
            text="It is 40C.",
            sources=[{"kind": "tool", "label": "get_product_spec"}],
        )
        assert r.sources and r.cause is None

    @pytest.mark.parametrize("state", [TurnState.NO_DATA, TurnState.SYSTEM_ERROR])
    def test_refusals_require_a_cause(self, state):
        with pytest.raises(ValueError):
            TurnResult(state=state, text="Sorry.")

    def test_refusal_with_a_cause_is_valid(self):
        r = TurnResult(
            state=TurnState.NO_DATA,
            text="I don't have that on file.",
            cause=RefusalCause.NOT_IN_KNOWLEDGE_BASE,
        )
        assert r.cause is RefusalCause.NOT_IN_KNOWLEDGE_BASE

    def test_need_one_thing_needs_neither_source_nor_cause(self):
        assert TurnResult(state=TurnState.NEED_ONE_THING, text="Which grade?")

    def test_events_are_a_list_so_two_cards_both_survive(self):
        r = TurnResult(state=TurnState.PARTIAL, text="Two quotes ready.")
        r.add_event("quote", quote_url="a").add_event("quote", quote_url="b")
        assert [e.payload["quote_url"] for e in r.events] == ["a", "b"]

    def test_is_escalating_reads_the_event_list(self):
        r = TurnResult(
            state=TurnState.NO_DATA, text="", cause=RefusalCause.TOOL_NOT_FOUND
        )
        assert not r.is_escalating
        r.add_event("escalate", cause="second_refusal")
        assert r.is_escalating

    def test_tool_trace_records_calls_in_order(self):
        r = TurnResult(state=TurnState.PARTIAL, text="")
        r.tool_trace.append(ToolCall(name="get_sds", args={"cas_number": "64-17-5"}, status="found"))
        r.tool_trace.append(ToolCall(name="request_quote", status="error", error="boom"))
        assert [c.name for c in r.tool_trace] == ["get_sds", "request_quote"]

    def test_turn_event_defaults_to_an_empty_payload(self):
        assert TurnEvent(type="escalate").payload == {}
