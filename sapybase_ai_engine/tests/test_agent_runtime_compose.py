"""Phase 5: the gate, the refusal builder, and settling a turn.

docs/agent-runtime-restructure-plan.md Phase 5. Before this, a turn's outcome was
decided three times by three mechanisms that disagreed - `is_unanswered` (retrieval
count OR three English substrings), `confidence` (the reranker's opinion of a chunk),
and the widget's own phrase list. These hold the one version that decides it.
"""
import pytest

from services.agent_runtime import compose, gate, refusal
from services.agent_runtime.states import RefusalCause, TurnState
from services.agent_runtime.turn import ToolCall


def _call(status, name="get_product_spec"):
    return ToolCall(name=name, status=status)


class TestGateTools:
    def test_a_found_lookup_answers_the_turn(self):
        assert gate.gate_tools([_call("found")])[0] is TurnState.ANSWERED

    def test_found_alongside_a_gap_is_partial_not_answered(self):
        # Some of it was found. Saying so beats implying the whole question landed.
        state, _ = gate.gate_tools([_call("found"), _call("not_found")])
        assert state is TurnState.PARTIAL

    def test_a_missing_slot_asks_before_reporting_a_gap(self):
        state, cause = gate.gate_tools([_call("needs_grade")])
        assert state is TurnState.NEED_ONE_THING
        assert cause is RefusalCause.MISSING_SLOT

    def test_several_matches_ask_which_one(self):
        state, cause = gate.gate_tools([_call("ambiguous")])
        assert state is TurnState.NEED_ONE_THING
        assert cause is RefusalCause.TOOL_AMBIGUOUS

    def test_nothing_on_file_is_no_data(self):
        state, cause = gate.gate_tools([_call("not_found")])
        assert state is TurnState.NO_DATA
        assert cause is RefusalCause.TOOL_NOT_FOUND

    def test_a_failure_is_never_dressed_up_as_a_data_gap(self):
        # §1.2 outcome 6: the system's own failure is its own outcome.
        state, cause = gate.gate_tools([_call("error")])
        assert state is TurnState.SYSTEM_ERROR
        assert cause is RefusalCause.TOOL_ERROR

    def test_a_dropped_over_budget_call_counts_as_a_system_failure(self):
        assert gate.gate_tools([_call("not_run")])[0] is TurnState.SYSTEM_ERROR

    def test_no_tool_ran_means_the_gate_has_nothing_to_say(self):
        assert gate.gate_tools([]) == (None, None)

    def test_an_unrecognised_status_is_not_read_as_success(self):
        # A new tool status must never default to "answered" - that is how a silent
        # failure becomes a confident-looking log row.
        assert gate.classify_status("brand_new_thing") == "unknown"
        assert gate.gate_tools([_call("brand_new_thing")]) == (None, None)

    def test_a_policy_refusal_leaves_the_turn_as_the_model_wrote_it(self):
        # A COA lockout ran correctly and its own message IS the answer.
        assert gate.gate_tools([_call("locked_out", "get_coa")]) == (None, None)


class TestGateProse:
    def test_zero_documents_is_the_one_honest_prose_signal(self):
        state, cause = gate.gate_prose(0)
        assert state is TurnState.NO_DATA
        assert cause is RefusalCause.NOT_IN_KNOWLEDGE_BASE

    def test_documents_retrieved_means_unknown_not_answered(self):
        # Whether those chunks support the answer is the grounding gate, deferred
        # to the audit's Slice A. No invented threshold here.
        assert gate.gate_prose(4) == (None, None)


class TestRefusalBuilder:
    def test_it_says_what_is_missing_and_what_happens_next(self):
        text = refusal.build(RefusalCause.TOOL_NOT_FOUND)
        assert "don't have" in text.lower()
        assert "team" in text.lower()

    def test_it_names_the_thing_the_visitor_asked_about(self):
        text = refusal.build(RefusalCause.TOOL_NOT_FOUND,
                             context={"product_name": "Acetone AR"})
        assert "Acetone AR" in text

    def test_it_never_repeats_itself_on_the_same_topic(self):
        seen = {refusal.build(RefusalCause.NOT_IN_KNOWLEDGE_BASE, attempt=i)
                for i in range(3)}
        assert len(seen) == 3

    def test_a_system_failure_does_not_claim_the_record_is_missing(self):
        text = refusal.build(RefusalCause.TOOL_ERROR)
        assert "went wrong" in text.lower()
        assert "don't have" not in text.lower()

    def test_a_second_system_failure_stops_offering_a_retry(self):
        assert "team" in refusal.build(RefusalCause.TOOL_ERROR, attempt=1).lower()

    def test_an_ambiguous_match_becomes_one_question_with_the_choices(self):
        text = refusal.build(RefusalCause.TOOL_AMBIGUOUS,
                             options=["Acetone AR", "Acetone LR"])
        assert "Acetone AR, Acetone LR" in text
        assert text.endswith("?")

    def test_a_settled_answer_needs_no_refusal_text(self):
        assert refusal.for_state(TurnState.ANSWERED, None) is None
        assert refusal.for_state(TurnState.PARTIAL, None) is None

    def test_the_canonical_sentence_is_detected_as_a_refusal(self):
        assert refusal.reads_as_refusal(refusal.NOTHING_ON_FILE)
        assert refusal.reads_as_refusal("Sorry, I don't have that on FILE.")

    def test_an_ordinary_answer_is_not_a_refusal(self):
        assert not refusal.reads_as_refusal("Acetone AR ships in 2.5L and 5L packs.")


class TestSettle:
    def test_a_tool_answer_survives_zero_retrieval(self):
        # audit D3, the headline inversion: this exact turn used to log unanswered
        # at confidence 0.0.
        result = compose.settle(
            text="Acetone AR is ₹1,200 for 5L.",
            tool_trace=[_call("found", "request_quote")],
            retrieved_doc_count=0,
            sources=[{"kind": "tool", "label": "request_quote"}],
        )
        assert result.state is TurnState.ANSWERED

    def test_the_tool_gate_outranks_the_prose_gate(self):
        result = compose.settle(
            text="Here it is.", tool_trace=[_call("found")], retrieved_doc_count=0,
            sources=[{"kind": "tool", "label": "get_product_spec"}],
        )
        assert result.state is TurnState.ANSWERED

    def test_a_refusal_in_prose_is_the_outcome_whatever_the_gates_said(self):
        result = compose.settle(
            text="I don't have that on file.",
            retrieved_doc_count=5,
            sources=[{"kind": "kb", "label": "https://x"}],
        )
        assert result.state is TurnState.NO_DATA

    def test_a_tool_dead_end_gets_the_server_s_words(self):
        result = compose.settle(
            text="Hmm, I don't seem to be able to find anything about that, sorry!",
            tool_trace=[_call("not_found")],
            retrieved_doc_count=0,
        )
        assert result.state is TurnState.NO_DATA
        assert result.text != "Hmm, I don't seem to be able to find anything about that, sorry!"
        assert "team" in result.text.lower()

    def test_a_prose_answer_is_left_exactly_as_written(self):
        # The plan's §5 non-goal: this phase does not touch prose-path answers.
        written = "We ship across India, usually within three working days."
        result = compose.settle(text=written, retrieved_doc_count=3,
                                sources=[{"kind": "kb", "label": "https://x"}])
        assert result.text == written
        assert result.state is TurnState.ANSWERED

    def test_a_streaming_turn_is_classified_but_never_rewritten(self):
        # The tokens are already on the visitor's screen.
        written = "I don't have that on file."
        result = compose.settle(text=written, tool_trace=[_call("not_found")],
                                allow_rewrite=False)
        assert result.state is TurnState.NO_DATA
        assert result.text == written

    def test_an_answer_with_no_nameable_source_cannot_claim_to_be_answered(self):
        # Rule 3, degraded rather than raised: a live turn has to stay sayable.
        result = compose.settle(text="It costs about ₹1,200.", retrieved_doc_count=2,
                                sources=[])
        assert result.state is TurnState.PARTIAL
        assert result.cause is RefusalCause.NO_SOURCE

    def test_a_caller_side_failure_outranks_everything(self):
        result = compose.settle(text="", system_error=True,
                                tool_trace=[_call("found")])
        assert result.state is TurnState.SYSTEM_ERROR
        assert result.text

    def test_small_talk_is_answered_and_can_name_where_it_came_from(self):
        result = compose.settle(text="Hello! What can I help with?",
                                retrieved_doc_count=0, small_talk=True)
        assert result.state is TurnState.ANSWERED
        assert result.sources == [{"kind": "conversation", "label": "no lookup needed"}]

    def test_the_tool_trace_rides_along_for_the_owner(self):
        result = compose.settle(text="Here.", tool_trace=[_call("found")],
                                sources=[{"kind": "tool", "label": "x"}])
        assert [c.status for c in result.tool_trace] == ["found"]


class TestWorst:
    def test_it_takes_the_weakest_outcome(self):
        assert gate.worst([TurnState.ANSWERED, TurnState.NO_DATA]) is TurnState.NO_DATA

    def test_a_system_error_is_weaker_than_a_data_gap(self):
        assert gate.worst([TurnState.NO_DATA, TurnState.SYSTEM_ERROR]) is TurnState.SYSTEM_ERROR

    def test_nothing_to_compare_is_nothing(self):
        assert gate.worst([None, None]) is None


class TestSignals:
    """audit D3/D4: the two owner-facing signals, now read off the outcome."""

    def test_a_tool_answered_turn_is_no_longer_logged_unanswered(self):
        from main import _confidence_for_state

        assert _confidence_for_state(TurnState.ANSWERED, 0, None) == 1.0

    def test_a_refusal_scores_zero_however_good_retrieval_looked(self):
        from main import _confidence_for_state

        assert _confidence_for_state(TurnState.NO_DATA, 5, 9.4) == 0.0

    def test_a_clarifying_question_claims_nothing_so_grades_nothing(self):
        from main import _confidence_for_state

        assert _confidence_for_state(TurnState.NEED_ONE_THING, 5, 9.4) is None

    def test_a_partial_answer_is_graded_below_a_full_one(self):
        from main import _confidence_for_state

        full = _confidence_for_state(TurnState.ANSWERED, 5, 8.0)
        partial = _confidence_for_state(TurnState.PARTIAL, 5, 8.0)
        assert partial < full


class TestCacheGate:
    """audit D1/D2: what may be frozen as a question's canonical answer."""

    def test_only_an_answered_turn_is_cacheable(self):
        from main import _cacheable

        answer = "Acetone AR ships in 2.5L and 5L packs."
        assert _cacheable(TurnState.ANSWERED, answer) is True
        for state in (TurnState.PARTIAL, TurnState.NEED_ONE_THING, TurnState.NO_DATA,
                      TurnState.OUT_OF_SCOPE, TurnState.SYSTEM_ERROR):
            assert _cacheable(state, answer) is False, state

    def test_a_turn_that_never_settled_is_not_cacheable(self):
        # The `finally` runs on client disconnect too - D2's half-sentence.
        from main import _cacheable

        assert _cacheable(None, "Acetone AR ships in") is False

    def test_a_trivially_short_reply_is_still_rejected(self):
        from main import _cacheable

        assert _cacheable(TurnState.ANSWERED, "Yes.") is False

    def test_the_cache_read_is_bounded_by_a_ttl(self):
        import inspect

        import main

        assert isinstance(main.CACHE_TTL_DAYS, int) and main.CACHE_TTL_DAYS > 0
        assert "CACHE_TTL_DAYS" in inspect.getsource(main.chat_endpoint)
