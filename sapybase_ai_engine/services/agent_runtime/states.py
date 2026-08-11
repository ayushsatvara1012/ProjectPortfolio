"""The six turn outcomes, their refusal causes, and the legal-transition table.

docs/agent-runtime-restructure-plan.md §1.2 / §1.3 rule 8. Rule 8 was a prompt
instruction ("degrade in one direction only") that nothing enforced; here it is a
state machine the pipeline can actually check, per conversation topic.
"""
from enum import Enum
from typing import Optional


class TurnState(str, Enum):
    ANSWERED = "answered"
    PARTIAL = "partial"
    NEED_ONE_THING = "need_one_thing"
    NO_DATA = "no_data"
    OUT_OF_SCOPE = "out_of_scope"
    SYSTEM_ERROR = "system_error"


class RefusalCause(str, Enum):
    """Why a turn could not be ANSWERED - carried so refusal.py can say what is
    specifically missing (§1.4) instead of one generic apology."""

    NOT_IN_KNOWLEDGE_BASE = "not_in_knowledge_base"
    TOOL_NOT_FOUND = "tool_not_found"
    TOOL_AMBIGUOUS = "tool_ambiguous"
    MISSING_SLOT = "missing_slot"
    NO_SOURCE = "no_source"
    UNAUTHORISED_PROMISE = "unauthorised_promise"
    OFF_TOPIC = "off_topic"
    TOOL_ERROR = "tool_error"
    MODEL_ERROR = "model_error"
    ROUNDS_EXHAUSTED = "rounds_exhausted"


#: The degrade ladder (§1.3 rule 8). Lower rank = stronger outcome.
_LADDER = {
    TurnState.ANSWERED: 0,
    TurnState.PARTIAL: 1,
    TurnState.NEED_ONE_THING: 2,
    TurnState.NO_DATA: 3,
}

#: Outcomes that always end a topic unless the turn escalates (§1.2).
TERMINAL_STATES = (TurnState.NO_DATA, TurnState.SYSTEM_ERROR)

#: Outcomes that are always reachable - finding the answer is never illegal.
_ALWAYS_LEGAL = (TurnState.ANSWERED, TurnState.PARTIAL, TurnState.OUT_OF_SCOPE)


def is_legal_transition(
    previous: Optional[TurnState],
    proposed: TurnState,
    *,
    escalating: bool = False,
) -> bool:
    """Is ``proposed`` a legal next outcome for a topic that last saw ``previous``?

    ``escalating`` means this turn carries an escalation event (§1.5) - the only
    way a topic may produce the same terminal outcome twice.
    """
    if previous is None:
        return True
    if proposed in _ALWAYS_LEGAL:
        return True
    if previous in TERMINAL_STATES and proposed == previous:
        return escalating
    previous_rank = _LADDER.get(previous)
    proposed_rank = _LADDER.get(proposed)
    if previous_rank is not None and proposed_rank is not None:
        return proposed_rank >= previous_rank
    return True


def next_legal_states(
    previous: Optional[TurnState], *, escalating: bool = False
) -> tuple:
    """Every outcome reachable from ``previous`` - the enumeration the tests and
    the pipeline share, so neither can drift from the table above."""
    return tuple(
        s for s in TurnState if is_legal_transition(previous, s, escalating=escalating)
    )
