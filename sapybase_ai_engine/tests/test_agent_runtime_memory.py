"""Phase 4: conversation memory (rule 6) and the escalation triggers (§1.5/§1.6).

docs/agent-runtime-restructure-plan.md Phase 4. Rule 6 ("never ask for something
already given in this conversation") and the escalation triggers were both prompt
text with nothing behind them; these hold the versions that are code.
"""
import pytest

from services.agent_runtime import escalation as esc
from services.agent_runtime import memory as mem
from services.agent_runtime.states import TurnState
from services.agent_runtime.turn import ToolCall, TurnResult


class TestRemembering:
    def test_slots_accumulate_across_turns(self):
        state = mem.remember(None, product_name="Acetone")
        state = mem.remember(state, grade="AR")
        assert mem.known(state) == {"product_name": "Acetone", "grade": "AR"}

    def test_an_omitted_slot_never_erases_a_known_one(self):
        state = mem.remember(None, grade="AR")
        state = mem.remember(state, grade="", product_name="Acetone")
        assert mem.known(state)["grade"] == "AR"

    def test_a_new_value_overwrites_the_old_one(self):
        state = mem.remember(mem.remember(None, grade="AR"), grade="LR")
        assert mem.known(state)["grade"] == "LR"

    def test_unknown_slot_names_are_ignored(self):
        state = mem.remember(None, favourite_colour="blue", grade="AR")
        assert mem.known(state) == {"grade": "AR"}

    def test_values_are_trimmed_and_bounded(self):
        state = mem.remember(None, product_name="  Acetone  ", application="x" * 500)
        assert mem.known(state)["product_name"] == "Acetone"
        assert len(mem.known(state)["application"]) == 200

    def test_other_state_keys_survive(self):
        state = mem.remember({"stage": "qualifying"}, grade="AR")
        assert state["stage"] == "qualifying"

    def test_missing_reports_what_is_still_needed_in_order(self):
        state = mem.remember(None, product_name="Acetone")
        assert mem.missing(state, ("product_name", "grade", "pack_size")) == ("grade", "pack_size")

    def test_has_is_false_for_an_unfilled_slot(self):
        assert not mem.has(mem.remember(None, grade="AR"), "pack_size")


class TestHarvesting:
    def test_tool_args_teach_the_conversation(self):
        state = mem.harvest_tool_args(None, {"product_name": "Acetone", "quantity": "2"})
        assert mem.known(state) == {"product_name": "Acetone", "quantity": "2"}

    def test_non_slot_tool_args_are_ignored(self):
        state = mem.harvest_tool_args(None, {"query": "acetone coa", "grade": "AR"})
        assert mem.known(state) == {"grade": "AR"}

    def test_a_resolved_quote_teaches_more_than_the_visitor_typed(self):
        state = mem.harvest_capture(None, {"quote": {
            "product": "Acetone", "grade": "AR", "pack_size": "2.5 Ltr", "quantity": 2,
        }})
        assert mem.known(state)["product_name"] == "Acetone"
        assert mem.known(state)["pack_size"] == "2.5 Ltr"

    def test_a_captured_contact_is_remembered(self):
        state = mem.harvest_capture(None, {"quote": {
            "product": "Acetone",
            "captured_contact": {"name": "Asha", "email": "asha@acme.com", "phone": None},
        }})
        assert mem.known(state)["contact_name"] == "Asha"
        assert mem.known(state)["contact_email"] == "asha@acme.com"
        assert "contact_phone" not in mem.known(state)

    def test_an_sds_result_teaches_the_cas_number(self):
        state = mem.harvest_capture(None, {"sds": {"product": "Acetone", "cas_number": "67-64-1"}})
        assert mem.known(state)["cas_number"] == "67-64-1"

    def test_an_empty_capture_teaches_nothing(self):
        assert mem.known(mem.harvest_capture(None, {})) == {}


class TestBackfill:
    def test_a_dropped_slot_is_refilled_from_memory(self):
        # The rule-6 failure in the wild: the model drops the grade from the next
        # tool call, the tool answers needs_grade, and the visitor is asked again.
        state = mem.remember(None, grade="AR", product_name="Acetone")
        assert mem.backfill(state, {"product_name": "Acetone"})["grade"] == "AR"

    def test_what_the_model_supplied_always_wins(self):
        state = mem.remember(None, grade="AR")
        assert mem.backfill(state, {"grade": "LR"})["grade"] == "LR"

    def test_a_blank_supplied_value_is_treated_as_absent(self):
        state = mem.remember(None, grade="AR")
        assert mem.backfill(state, {"grade": "   "})["grade"] == "AR"

    def test_non_slot_args_pass_through_untouched(self):
        state = mem.remember(None, grade="AR")
        assert mem.backfill(state, {"query": "coa"})["query"] == "coa"

    def test_redundant_slots_flags_a_question_already_answered(self):
        state = mem.remember(None, contact_email="a@b.com")
        assert mem.redundant_slots(state, ("contact_email", "pack_size")) == ("contact_email",)


class TestEscalationTriggers:
    def test_asking_for_a_person_escalates(self):
        for msg in ("can I talk to a human?", "put me through to someone",
                    "I want to speak with a real person", "contact your sales team please"):
            assert esc.check(message=msg) is not None, msg

    def test_an_ordinary_question_does_not_escalate(self):
        for msg in ("what grades of acetone do you stock?", "is it available in 2.5 Ltr?",
                    "who uses this product?"):
            assert esc.check(message=msg) is None, msg

    def test_asking_for_a_discount_escalates_rather_than_being_answered(self):
        for msg in ("can you give me a discount?", "what's your best price?",
                    "can you beat that price?", "can you deliver by Friday?"):
            result = esc.check(message=msg)
            assert result is not None and result.cause is esc.EscalationCause.PROMISE_REQUESTED, msg

    def test_a_person_request_outranks_a_promise_request(self):
        result = esc.check(message="let me talk to a human about a discount")
        assert result.cause is esc.EscalationCause.PERSON_REQUESTED

    def test_a_second_refusal_on_the_same_topic_escalates(self):
        result = esc.check(
            proposed_state=TurnState.NO_DATA, topic_outcomes=[TurnState.NO_DATA]
        )
        assert result.cause is esc.EscalationCause.REPEAT_REFUSAL
        assert result.context["previous"] == "no_data"

    def test_a_first_refusal_does_not_escalate(self):
        assert esc.check(proposed_state=TurnState.NO_DATA, topic_outcomes=[]) is None

    def test_a_refusal_after_a_successful_answer_does_not_escalate(self):
        assert esc.check(
            proposed_state=TurnState.NO_DATA, topic_outcomes=[TurnState.ANSWERED]
        ) is None

    def test_a_system_error_after_a_refusal_escalates(self):
        result = esc.check(
            proposed_state=TurnState.SYSTEM_ERROR, topic_outcomes=[TurnState.NO_DATA]
        )
        assert result.cause is esc.EscalationCause.REPEAT_REFUSAL

    def test_a_dead_end_after_the_visitor_already_clarified_escalates(self):
        result = esc.check(
            tool_trace=[ToolCall(name="get_product_spec", status="not_found")],
            disambiguated=True,
        )
        assert result.cause is esc.EscalationCause.DEAD_END_AFTER_CLARIFY
        assert result.context["tool"] == "get_product_spec"

    def test_the_same_dead_end_before_any_clarification_does_not_escalate(self):
        assert esc.check(
            tool_trace=[ToolCall(name="get_product_spec", status="not_found")],
            disambiguated=False,
        ) is None

    def test_a_successful_tool_call_is_not_a_dead_end(self):
        assert esc.check(
            tool_trace=[ToolCall(name="get_sds", status="found")], disambiguated=True
        ) is None


class TestBuyingIntent:
    """The fifth trigger: the server-side replacement for the widget's
    ``userBuyingIntent`` list (owner decision, 2026-08-11)."""

    def test_buying_language_escalates(self):
        for msg in ("how much is a drum of acetone?", "I want to buy 200 litres",
                    "can I get a quote", "how do I sign up", "is there a free trial?"):
            result = esc.check(message=msg)
            assert result is not None and result.cause is esc.EscalationCause.BUYING_INTENT, msg

    def test_a_plain_product_question_is_not_buying_intent(self):
        for msg in ("what is the boiling point of acetone?",
                    "do you have an SDS for it?", "which grades exist?"):
            assert esc.check(message=msg) is None, msg

    def test_every_real_failure_outranks_buying_intent(self):
        person = esc.check(message="I want to buy this, can I talk to a human?")
        assert person.cause is esc.EscalationCause.PERSON_REQUESTED
        promise = esc.check(message="I want to buy 200L, what's your best price?")
        assert promise.cause is esc.EscalationCause.PROMISE_REQUESTED
        refusal = esc.check(
            message="how much does it cost?",
            proposed_state=TurnState.NO_DATA, topic_outcomes=[TurnState.NO_DATA],
        )
        assert refusal.cause is esc.EscalationCause.REPEAT_REFUSAL

    def test_a_turn_that_closed_its_own_loop_can_suppress_it(self):
        assert esc.check(message="I'd like a quote", include_buying_intent=False) is None


class TestDestination:
    """Entitlement, not the trigger, decides which endpoint the form can post to."""

    def test_human_handoff_wins_when_both_are_granted(self):
        assert esc.destination(
            human_handoff_enabled=True, lead_capture_enabled=True) == "handoff"

    def test_lead_capture_only_still_gets_a_form(self):
        assert esc.destination(
            human_handoff_enabled=False, lead_capture_enabled=True) == "lead_capture"

    def test_a_bot_entitled_to_neither_is_shown_nothing(self):
        assert esc.destination(
            human_handoff_enabled=False, lead_capture_enabled=False) is None


class TestApplyAndPayload:
    def test_apply_attaches_one_escalate_event(self):
        result = esc.apply(
            TurnResult(state=TurnState.NEED_ONE_THING, text="Which grade?"),
            esc.Escalation(esc.EscalationCause.PERSON_REQUESTED),
        )
        assert result.is_escalating
        assert result.events[0].payload["cause"] == "person_requested"

    def test_apply_is_idempotent(self):
        result = TurnResult(state=TurnState.NEED_ONE_THING, text="")
        escalation = esc.Escalation(esc.EscalationCause.PERSON_REQUESTED)
        esc.apply(esc.apply(result, escalation), escalation)
        assert len(result.events) == 1

    def test_apply_with_no_escalation_changes_nothing(self):
        result = esc.apply(TurnResult(state=TurnState.PARTIAL, text="x"), None)
        assert result.events == []

    def test_the_handoff_carries_identity_and_conversation_context(self):
        payload = esc.handoff_payload(
            esc.Escalation(esc.EscalationCause.REPEAT_REFUSAL, {"previous": "no_data"}),
            slots={"contact_name": "Asha", "contact_email": "asha@acme.com",
                   "product_name": "Acetone", "grade": "AR"},
            session_id="sess-1",
        )
        assert payload["visitor_email"] == "asha@acme.com"
        assert payload["visitor_name"] == "Asha"
        assert payload["context"] == {"product_name": "Acetone", "grade": "AR"}
        assert payload["cause"] == "repeat_refusal" and payload["previous"] == "no_data"
        assert payload["session_id"] == "sess-1"

    def test_an_anonymous_handoff_still_carries_context(self):
        payload = esc.handoff_payload(
            esc.Escalation(esc.EscalationCause.PERSON_REQUESTED),
            slots={"product_name": "Acetone"},
        )
        assert payload["visitor_email"] is None
        assert payload["context"] == {"product_name": "Acetone"}
