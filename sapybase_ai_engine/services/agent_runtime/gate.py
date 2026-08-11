"""What the lookups actually found - the tool half of the turn outcome.

docs/agent-runtime-restructure-plan.md §2 / Phase 5. Today a turn's success is
inferred after the fact from the wording of the model's reply and from how many
documents retrieval happened to return, which is why a correct tool-sourced price
logs as unanswered and a confident fabrication logs as answered (audit D3).

This module makes the tool half deterministic: tool statuses are facts the runtime
already has, so the outcome is read off them rather than guessed from prose. The
prose half stays a pass-through on purpose - scoring retrieved chunks needs the
threshold calibration the plan defers to the audit's Slice A, and a made-up
threshold now would be a worse lie than the honest "unknown" below.
"""
from typing import Iterable, Optional, Sequence, Tuple

from .states import RefusalCause, TurnState

#: The lookup succeeded and produced a record to answer from.
_FOUND = ("found", "quoted", "price_on_request", "open_form", "ok", "confirm_quantity")

#: The lookup ran and there is genuinely nothing on file.
_NOT_FOUND = ("not_found", "not_found_sku", "no_sheet_on_file", "empty")

#: More than one record matches - answering would mean picking one at random.
_AMBIGUOUS = ("ambiguous", "ambiguous_price", "too_broad")

#: The tool needs one more thing from the visitor before it can run.
_NEEDS_INPUT = ("needs_grade", "needs_pack", "needs_contact", "missing_identifier")

#: The system failed, or was never able to try. Never presented as "not on file".
_SYSTEM = ("error", "not_run", "unavailable")

#: Ran correctly and refused for a policy reason of its own (COA throttle, a tool
#: the company has not configured). Not a system fault and not a data gap - the
#: tool's own message is the answer, so the turn is left as the model wrote it.
_POLICY = ("locked_out", "not_configured")

_CAUSE_BY_KIND = {
    "not_found": RefusalCause.TOOL_NOT_FOUND,
    "ambiguous": RefusalCause.TOOL_AMBIGUOUS,
    "needs_input": RefusalCause.MISSING_SLOT,
    "system": RefusalCause.TOOL_ERROR,
}


def classify_status(status: str) -> str:
    """One tool status -> one of found / not_found / ambiguous / needs_input /
    system / policy / unknown. Unknown is deliberate: a new tool status must not
    be silently read as success."""
    value = (status or "").strip().lower()
    if value in _FOUND:
        return "found"
    if value in _NOT_FOUND:
        return "not_found"
    if value in _AMBIGUOUS:
        return "ambiguous"
    if value in _NEEDS_INPUT:
        return "needs_input"
    if value in _SYSTEM:
        return "system"
    if value in _POLICY:
        return "policy"
    return "unknown"


def gate_tools(tool_trace: Sequence) -> Tuple[Optional[TurnState], Optional[RefusalCause]]:
    """The outcome the tool calls alone justify, or (None, None) if no tool ran.

    Precedence is by what the visitor needs to hear, not by call order:

      * anything found -> the turn has a record to answer from (PARTIAL when
        another lookup in the same turn came back empty - some of it was found,
        which is exactly §1.2's PARTIAL, and saying so beats implying completeness);
      * needs one more thing -> ask for it (NEED_ONE_THING), before reporting a
        gap that the missing input may well explain;
      * ambiguous -> also NEED_ONE_THING, but the question is "which one";
      * nothing found -> NO_DATA;
      * only a failure -> SYSTEM_ERROR, never dressed up as NO_DATA (§1.2).
    """
    kinds = [classify_status(getattr(call, "status", "")) for call in tool_trace or ()]
    if not kinds:
        return None, None

    if "found" in kinds:
        incomplete = any(k in ("not_found", "needs_input", "ambiguous", "system") for k in kinds)
        return (TurnState.PARTIAL if incomplete else TurnState.ANSWERED), None
    if "needs_input" in kinds:
        return TurnState.NEED_ONE_THING, RefusalCause.MISSING_SLOT
    if "ambiguous" in kinds:
        return TurnState.NEED_ONE_THING, RefusalCause.TOOL_AMBIGUOUS
    if "not_found" in kinds:
        return TurnState.NO_DATA, RefusalCause.TOOL_NOT_FOUND
    if "system" in kinds:
        return TurnState.SYSTEM_ERROR, RefusalCause.TOOL_ERROR
    # Only policy/unknown statuses: the tool said its piece and the reply carries
    # it. Claiming an outcome we cannot justify is the failure mode this avoids.
    return None, None


def gate_prose(retrieved_doc_count: int) -> Tuple[Optional[TurnState], Optional[RefusalCause]]:
    """The prose path's stub (plan §2): documents or no documents, nothing more.

    No relevant chunk at all is the one honest signal available without scoring -
    there is nothing to have answered from. Anything above zero returns None
    ("unknown"), because judging whether those chunks actually support the answer
    is the grounding gate, and that needs the shadow-mode score data the plan
    defers to Slice A. Do not put a guessed threshold here.
    """
    if retrieved_doc_count <= 0:
        return TurnState.NO_DATA, RefusalCause.NOT_IN_KNOWLEDGE_BASE
    return None, None


#: Rule 8's ladder as a rank. OUT_OF_SCOPE sits at the top because it is a settled
#: turn, not a degradation - neither gate produces it (declining a question about
#: the weather is a judgement about the question, not about what a lookup returned).
_SEVERITY = (TurnState.OUT_OF_SCOPE, TurnState.ANSWERED, TurnState.PARTIAL,
             TurnState.NEED_ONE_THING, TurnState.NO_DATA, TurnState.SYSTEM_ERROR)


def worst(states: Iterable[Optional[TurnState]]) -> Optional[TurnState]:
    """The weakest of several outcomes - rule 8 degrades in one direction only, so
    a turn is only as strong as its weakest part.

    NOT for combining the tool gate with the prose gate: a tool-answered turn
    routinely retrieves no documents, and letting the prose half drag it down to
    NO_DATA is audit D3 exactly. ``compose`` gives the tool gate precedence instead.
    """
    present = [s for s in states if s is not None]
    if not present:
        return None
    return max(present, key=_SEVERITY.index)
