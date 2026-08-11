"""When to stop answering and get a person - and the one capture-then-connect flow.

docs/agent-runtime-restructure-plan.md §1.5 / §1.6, Phase 4.

Three overlapping mechanisms used to decide this and none of them was driven by an
actual escalation signal: the widget sniffed keywords client-side (generic bots
only), the manual handoff button redirected with no form, no transcript and no
identity, and the server sniffed contacts passively without ever showing anything.
This module replaces the decision half of all three. One set of triggers, evaluated
server-side, for every bot; the caller renders one form on the resulting event.

Everything here reads signals the system already has - turn outcomes, tool results,
the visitor's own message. No new data source, no calibration.
"""
import re
from enum import Enum
from typing import Any, Dict, Iterable, Optional, Sequence

from .states import TurnState
from .turn import TurnResult

#: Outcomes that count as a refusal for the "second time on this topic" trigger.
_REFUSALS = (TurnState.NO_DATA, TurnState.SYSTEM_ERROR)


class EscalationCause(str, Enum):
    REPEAT_REFUSAL = "repeat_refusal"
    PERSON_REQUESTED = "person_requested"
    PROMISE_REQUESTED = "promise_requested"
    DEAD_END_AFTER_CLARIFY = "dead_end_after_clarify"
    BUYING_INTENT = "buying_intent"


class Destination(str, Enum):
    """Where the form the visitor is about to fill in actually posts."""

    HANDOFF = "handoff"
    LEAD_CAPTURE = "lead_capture"


#: "Get me a human." Deterministic and server-side, replacing the widget's
#: ``userHumanIntent`` list - the same decision, made where the transcript is.
_PERSON_PATTERNS = (
    r"\b(talk|speak|chat)\s+(to|with)\s+(a\s+)?(human|person|someone|somebody|rep|agent|sales|team)\b",
    r"\breal\s+(human|person)\b",
    r"\b(get|put)\s+me\s+(through\s+)?(to\s+)?(a\s+)?(human|person|someone|manager|sales)\b",
    r"\b(contact|call|email)\s+(you|your|the)\s+(team|sales|support|office)\b",
    r"\bcan\s+(i|we)\s+(talk|speak)\s+to\s+(anyone|someone)\b",
)

#: Asking the business to commit to something it has not authorised (rule 10):
#: a discount, a delivery promise, a bespoke change. The bot must never grant
#: these - it hands them to whoever can.
_PROMISE_PATTERNS = (
    r"\b(discount|rebate|best\s+price|lowest\s+price|price\s+match|beat\s+(that|this)\s+price)\b",
    r"\b(negotiat\w+|bargain|special\s+(rate|deal|price))\b",
    r"\b(guarantee|promise|commit)\s+(me\s+)?(a\s+)?(delivery|date|price|discount)\b",
    r"\b(can|could|will)\s+you\s+(deliver|ship|dispatch)\s+(it\s+)?(by|before|on)\b",
    r"\b(custom(is|iz)e|bespoke|made\s+to\s+order|tailor(ed)?)\b",
)

#: Buying language. Not one of the four §1.5 triggers - a fifth, kept because it
#: is what actually fired the widget's ``userBuyingIntent`` list, and retiring that
#: list without a server-side replacement would quietly stop most generic bots
#: capturing anyone (owner decision, 2026-08-11). Lowest priority of the five: it
#: is an opportunity, not a failure, so any real failure outranks it.
_BUYING_PATTERNS = (
    r"\b(quote|quotation|pricing|price\s+list|how\s+much|what\s+does\s+it\s+cost)\b",
    r"\b(cost|costs)\s+(of|for|to)\b",
    r"\b(buy|purchase|order|hire|book\s+a|sign\s+up|get\s+started|subscribe)\b",
    r"\b(free\s+trial|demo|trial\s+account|onboarding)\b",
)

_PERSON_RE = re.compile("|".join(_PERSON_PATTERNS), re.I)
_PROMISE_RE = re.compile("|".join(_PROMISE_PATTERNS), re.I)
_BUYING_RE = re.compile("|".join(_BUYING_PATTERNS), re.I)


class Escalation:
    """Why this turn should hand off, and the context that travels with it."""

    def __init__(self, cause: EscalationCause, context: Optional[Dict[str, Any]] = None):
        self.cause = cause
        self.context = context or {}

    def __eq__(self, other) -> bool:
        return (isinstance(other, Escalation)
                and other.cause == self.cause and other.context == self.context)

    def __repr__(self) -> str:
        return f"Escalation({self.cause.value}, {self.context})"

    def as_event_payload(self) -> Dict[str, Any]:
        return {"cause": self.cause.value, **self.context}


def asks_for_a_person(message: str) -> bool:
    return bool(_PERSON_RE.search(message or ""))


def asks_for_a_promise(message: str) -> bool:
    return bool(_PROMISE_RE.search(message or ""))


def signals_buying_intent(message: str) -> bool:
    return bool(_BUYING_RE.search(message or ""))


def destination(*, human_handoff_enabled: bool, lead_capture_enabled: bool) -> Optional[str]:
    """Which endpoint the connect form should post to, or None to stay silent.

    ``/api/handoff`` 402s on a plan without ``human_handoff``, and a lead-capture
    tier has ``/api/leads/capture`` instead - so entitlement, not the trigger,
    decides the destination. A bot entitled to neither must not be shown a form
    it cannot submit, which is the only case where a fired trigger emits nothing.
    """
    if human_handoff_enabled:
        return Destination.HANDOFF.value
    if lead_capture_enabled:
        return Destination.LEAD_CAPTURE.value
    return None


def _tool_dead_end(tool_trace: Sequence) -> bool:
    return any(getattr(call, "status", "") in ("not_found", "ambiguous")
               for call in tool_trace or ())


def check(
    *,
    message: str = "",
    proposed_state: Optional[TurnState] = None,
    topic_outcomes: Optional[Iterable[TurnState]] = None,
    tool_trace: Sequence = (),
    disambiguated: bool = False,
    include_buying_intent: bool = True,
) -> Optional[Escalation]:
    """The §1.5 triggers plus buying intent, in priority order. None means carry on.

    ``topic_outcomes`` is this topic's prior outcomes, oldest first.
    ``disambiguated`` records that the visitor has already answered a clarifying
    question on this topic - a ``not_found`` after that is a dead end, not progress.
    ``include_buying_intent`` lets the caller drop the fifth trigger for a turn that
    already closed the loop itself (a priced quote card needs no form).
    """
    if asks_for_a_person(message):
        return Escalation(EscalationCause.PERSON_REQUESTED)

    if asks_for_a_promise(message):
        return Escalation(EscalationCause.PROMISE_REQUESTED)

    prior = list(topic_outcomes or ())
    if proposed_state in _REFUSALS and any(o in _REFUSALS for o in prior):
        return Escalation(
            EscalationCause.REPEAT_REFUSAL,
            {"previous": next(o.value for o in prior if o in _REFUSALS)},
        )

    if disambiguated and _tool_dead_end(tool_trace):
        failed = next(
            (c.name for c in tool_trace if getattr(c, "status", "") in ("not_found", "ambiguous")),
            None,
        )
        return Escalation(EscalationCause.DEAD_END_AFTER_CLARIFY, {"tool": failed})

    if include_buying_intent and signals_buying_intent(message):
        return Escalation(EscalationCause.BUYING_INTENT)

    return None


def apply(result: TurnResult, escalation: Optional[Escalation]) -> TurnResult:
    """Attach an escalation to a turn.

    The event is what the widget renders the capture-then-connect form on: name
    (optional) plus email, one button. Same component for every bot, generic or
    vertical - the ``!isVerticalBotRef`` exclusion this replaces meant the bots most
    likely to be handling a real buying conversation were the ones that never asked
    who they were talking to.
    """
    if escalation is not None and not result.is_escalating:
        result.add_event("escalate", **escalation.as_event_payload())
    return result


def handoff_payload(
    escalation: Escalation,
    *,
    slots: Optional[Dict[str, str]] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """What travels to ``/api/handoff`` when the visitor connects.

    Carries the conversation's context into the next step (§1.4): the owner opens a
    handoff that already says who it is and what they were asking about. This is
    sent on the redirect path too - a configured ``handoff_redirect_url`` opens
    immediately after, so the visitor still gets an instant hop, but the owner no
    longer receives a message from an unidentified stranger.
    """
    filled = dict(slots or {})
    return {
        "cause": escalation.cause.value,
        "session_id": session_id,
        "visitor_name": filled.get("contact_name"),
        "visitor_email": filled.get("contact_email"),
        "visitor_phone": filled.get("contact_phone"),
        "context": {k: v for k, v in filled.items()
                    if k not in ("contact_name", "contact_email", "contact_phone")},
        **escalation.context,
    }
