"""Phase 4 §1.6: the one capture-then-connect decision, made server-side.

docs/agent-runtime-restructure-plan.md §1.6. Three mechanisms used to decide this
and the widget owned two of them, from keyword lists that only ran for generic bots.
These hold the merged version: one function, every bot, entitlement-routed.
"""
from services.agent_runtime.states import TurnState
from services.agent_runtime.turn import ToolCall


def _frame(**kwargs):
    from main import _escalation_frame

    defaults = dict(
        message="hello there",
        state=TurnState.ANSWERED,
        prior_messages=[],
        human_handoff_enabled=True,
        lead_capture_enabled=True,
    )
    defaults.update(kwargs)
    return _escalation_frame(**defaults)


def _settle(**kwargs):
    """The turn as ``main.py`` settles it, so these tests exercise the real state
    the escalation frame now receives rather than a hand-written enum."""
    from services.agent_runtime import compose

    defaults = dict(text="Here you go.", retrieved_doc_count=3,
                    sources=[{"kind": "kb", "label": "x"}])
    defaults.update(kwargs)
    return compose.settle(**defaults).state


class TestGenericAndVerticalParity:
    """The `!isVerticalBotRef.current` exclusion meant the bots most likely to be
    mid-deal were the only ones that never asked who they were talking to."""

    def test_the_same_request_escalates_for_a_generic_bot(self):
        frame = _frame(message="can I speak to someone on your team?")
        assert frame["escalate"]["cause"] == "person_requested"

    def test_and_identically_for_a_vertical_bot_mid_tool_call(self):
        trace = (ToolCall(name="get_product_spec", status="found"),)
        frame = _frame(
            message="can I speak to someone on your team?",
            state=_settle(tool_trace=trace, retrieved_doc_count=0),
            tool_answered=True,
            tool_trace=trace,
        )
        assert frame["escalate"]["cause"] == "person_requested"

    def test_a_priced_quote_does_not_get_a_form_bolted_under_it(self):
        # Buying intent alone, on a turn a tool already answered: the old client-side
        # list popped a form mid-quote, which is exactly what this suppresses.
        assert _frame(message="I'd like a quote for acetone", tool_answered=True) is None

    def test_the_same_message_does_escalate_when_nothing_answered_it(self):
        frame = _frame(message="I'd like a quote for acetone")
        assert frame["escalate"]["cause"] == "buying_intent"


class TestEntitlementRouting:
    def test_handoff_tier_posts_to_the_handoff_endpoint(self):
        frame = _frame(message="get me a human", lead_capture_enabled=False)
        assert frame["escalate"]["destination"] == "handoff"

    def test_lead_capture_tier_posts_to_the_lead_endpoint(self):
        frame = _frame(message="get me a human", human_handoff_enabled=False)
        assert frame["escalate"]["destination"] == "lead_capture"

    def test_a_bot_entitled_to_neither_emits_no_event(self):
        # Showing a form whose POST would 402 is worse than showing nothing.
        assert _frame(
            message="get me a human",
            human_handoff_enabled=False, lead_capture_enabled=False,
        ) is None


class TestRepeatRefusal:
    """Phase 5: the state comes from ``compose.settle``, not from the reply's wording.

    The prior turn is still read from the transcript - it predates
    ``chat_logs.turn_state`` - but through the runtime's one refusal definition.
    """

    def test_a_second_refusal_in_a_row_escalates(self):
        frame = _frame(
            message="what are your payment terms?",
            state=_settle(text="I don't have that on file.", retrieved_doc_count=0),
            prior_messages=[{"role": "assistant", "content": "I don't have that on file."}],
        )
        assert frame["escalate"]["cause"] == "repeat_refusal"

    def test_a_first_refusal_just_answers_plainly(self):
        assert _frame(
            message="what are your payment terms?",
            state=_settle(text="I don't have that on file.", retrieved_doc_count=0),
            prior_messages=[{"role": "assistant", "content": "Sure, acetone comes in 5L."}],
        ) is None

    def test_a_tool_answered_turn_is_not_a_refusal(self):
        # audit D3: zero retrieved documents is normal for a tool-answered turn, so
        # counting it as unanswered would escalate on every successful vertical turn.
        assert _frame(
            message="what pack sizes do you have?",
            state=_settle(
                text="Acetone AR comes in 2.5L and 5L.",
                retrieved_doc_count=0,
                tool_trace=[ToolCall(name="get_product_spec", status="found")],
            ),
            tool_answered=True,
            prior_messages=[{"role": "assistant", "content": "I don't have that on file."}],
        ) is None

    def test_client_sent_history_works_the_same_as_session_history(self):
        # Generic bots have no session store - the prior turn comes from the
        # widget's own history array, whose assistant role is spelled "bot".
        frame = _frame(
            message="what are your payment terms?",
            state=_settle(text="I don't have that on file.", retrieved_doc_count=0),
            prior_messages=[{"role": "bot", "content": "I don't have that on file."}],
        )
        assert frame["escalate"]["cause"] == "repeat_refusal"

    def test_a_dead_end_after_the_visitor_clarified_escalates(self):
        trace = (ToolCall(name="get_product_spec", status="not_found"),)
        frame = _frame(
            message="the AR grade one",
            state=_settle(text="I couldn't find that.", tool_trace=trace),
            tool_answered=True,
            tool_trace=trace,
            disambiguated=True,
        )
        assert frame["escalate"]["cause"] == "dead_end_after_clarify"

    def test_a_short_greeting_is_not_recorded_as_a_failure(self):
        # Inherited carve-out: "hi" retrieves nothing and must not therefore count
        # as a question the bot could not answer.
        assert _settle(text="Hi! How can I help?", retrieved_doc_count=0,
                       sources=[], small_talk=True) is TurnState.ANSWERED
