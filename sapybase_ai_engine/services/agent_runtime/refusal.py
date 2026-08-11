"""The one way this bot says "I don't have that".

docs/agent-runtime-restructure-plan.md §1.4 / Phase 5. One builder, one voice,
three parts: what is specifically missing, a real next step, and the conversation's
context carried into that next step. Never the same sentence twice per topic per
conversation.

What this replaces: RULE 6 told the model to reproduce a canned paragraph verbatim,
RULE 2 then had to forbid it from stitching that paragraph onto the front of a real
answer, and ``FALLBACK_PHRASES`` tried to detect afterwards whether it had complied.
Three mechanisms guessing at each other. A refusal is a decision the server makes,
so the server writes it.

Deliberately not apologetic and never "unfortunately": a front desk that doesn't
hold a piece of information says so and moves the visitor forward (§1.1).
"""
from typing import Dict, Optional, Sequence

from .states import RefusalCause, TurnState

#: The one sentence RULE 6 asks the model for when it has nothing. The prompt reads
#: it from here so the instruction and the detector below cannot drift apart - that
#: drift is how "did the bot refuse?" ended up with three different answers.
NOTHING_ON_FILE = "I don't have that on file."

#: Detects a refusal in prose. Kept as ONE definition, here, because two lived in
#: ``main.py`` and a third in ``ChatWidget.tsx`` and none was authoritative (audit
#: F3). Used to catch a model that refused while the rest of the turn looked
#: successful - not to decide refusals in the first place. The first three are the
#: wording the retired canned paragraphs used, still live in cached rows and in
#: conversations already in progress.
_CANNED_MARKERS = (
    "i don't have specific information about that yet",
    "i don't have that information",
    "i'm here specifically to help you with",
    NOTHING_ON_FILE.lower(),
    "i do not have that information",
)

#: "What is missing", per cause. The subject of the sentence, not a whole sentence,
#: so one voice can phrase it and the variants below stay readable.
_MISSING = {
    RefusalCause.NOT_IN_KNOWLEDGE_BASE: "that on file",
    RefusalCause.TOOL_NOT_FOUND: "a record for that",
    RefusalCause.TOOL_AMBIGUOUS: "a single match for that",
    RefusalCause.MISSING_SLOT: "enough detail to look that up",
    RefusalCause.NO_SOURCE: "a source I can stand behind for that",
    RefusalCause.UNAUTHORISED_PROMISE: "the authority to confirm that",
    RefusalCause.OFF_TOPIC: "anything on that",
    RefusalCause.TOOL_ERROR: "access to that system right now",
    RefusalCause.MODEL_ERROR: "a reliable answer right now",
    RefusalCause.ROUNDS_EXHAUSTED: "a complete answer right now",
}

#: Variants, rotated per topic so a visitor who rephrases never gets the identical
#: sentence back - the single loudest signal that nobody is really listening.
_OPENERS = (
    "I don't have {missing}{subject}.",
    "That one I can't confirm - I don't have {missing}{subject}.",
    "Still nothing on {missing}{subject} at my end.",
)

#: The system's own failure is never dressed up as a data gap (§1.2 outcome 6).
_SYSTEM_OPENERS = (
    "Something went wrong at my end, so I couldn't check that.",
    "That lookup failed on my side - it isn't that the record is missing.",
)

_NEXT_STEPS = {
    "handoff": "Let me get someone from the team to pick this up with you.",
    "retry": "Give it another moment and I'll try again.",
    "ask": "Tell me a little more and I'll take another look.",
}


def next_step(kind: str = "handoff") -> str:
    """Just the "here is what happens next" half (rule 9).

    The streaming generic bot has already sent its refusal sentence by the time the
    turn settles, so its next step is appended as one more token rather than
    written as part of a replacement.
    """
    return _NEXT_STEPS.get(kind, _NEXT_STEPS["handoff"])


def reads_as_refusal(text: str) -> bool:
    """Did this reply tell the visitor we don't have it?

    The single definition. Phase 6 should need it only for reading back turns that
    predate ``chat_logs.turn_state``.
    """
    low = (text or "").lower()
    return any(marker in low for marker in _CANNED_MARKERS)


def _subject(context: Optional[Dict[str, str]]) -> str:
    """The thing being refused, named, so the refusal is about their question and
    not a generic apology. Carried from conversation memory (§1.4)."""
    filled = context or {}
    for slot in ("product_name", "cas_number", "topic"):
        value = (filled.get(slot) or "").strip()
        if value:
            return f" for {value}"
    return ""


def build(
    cause: RefusalCause,
    *,
    context: Optional[Dict[str, str]] = None,
    next_step: str = "handoff",
    attempt: int = 0,
    options: Sequence[str] = (),
) -> str:
    """The refusal text for one turn.

    ``attempt`` is how many times this topic has already been refused; it selects
    the variant, which is how "never the same sentence twice per topic" is kept
    without a random generator making tests unrepeatable.
    ``options`` turns an ambiguous match into the one question worth asking (rule 5)
    rather than a refusal - the visitor can finish this in a word.
    """
    subject = _subject(context)

    if cause is RefusalCause.TOOL_AMBIGUOUS and options:
        listed = ", ".join(str(o) for o in options[:5])
        return f"I've got a few matches{subject} - which one did you mean: {listed}?"

    if cause in (RefusalCause.TOOL_ERROR, RefusalCause.MODEL_ERROR):
        opener = _SYSTEM_OPENERS[attempt % len(_SYSTEM_OPENERS)]
        step = _NEXT_STEPS["retry"] if attempt == 0 else _NEXT_STEPS["handoff"]
        return f"{opener} {step}"

    missing = _MISSING.get(cause, "that")
    opener = _OPENERS[attempt % len(_OPENERS)].format(missing=missing, subject=subject)
    step = _NEXT_STEPS.get(next_step, _NEXT_STEPS["handoff"])
    return f"{opener} {step}"


def for_state(
    state: TurnState,
    cause: Optional[RefusalCause],
    *,
    context: Optional[Dict[str, str]] = None,
    attempt: int = 0,
    options: Sequence[str] = (),
) -> Optional[str]:
    """The refusal text a given outcome calls for, or None when the turn should keep
    whatever the model wrote (ANSWERED, PARTIAL, OUT_OF_SCOPE)."""
    if state is TurnState.NO_DATA:
        return build(cause or RefusalCause.NOT_IN_KNOWLEDGE_BASE,
                     context=context, attempt=attempt)
    if state is TurnState.SYSTEM_ERROR:
        return build(cause or RefusalCause.MODEL_ERROR, context=context, attempt=attempt)
    if state is TurnState.NEED_ONE_THING:
        return build(cause or RefusalCause.MISSING_SLOT, context=context,
                     next_step="ask", attempt=attempt, options=options)
    return None
