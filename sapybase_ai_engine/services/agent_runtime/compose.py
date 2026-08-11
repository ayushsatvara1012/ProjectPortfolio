"""Settling a turn: what state it ended in, and what the visitor actually reads.

docs/agent-runtime-restructure-plan.md §2 / Phase 5. Two jobs that belong together:

  * ``compose_without_tools`` - the final tool-free model call (B2), so an exhausted
    round budget answers over the observations already gathered instead of throwing
    a resolved product and a priced SKU away for a generic apology.
  * ``settle`` - turn (model text, tool trace, retrieval count, sources) into one
    ``TurnResult``. This is the single place a turn's outcome is decided; before it,
    the same question was answered three different ways by three mechanisms that
    disagreed (``is_unanswered``, ``confidence``, and a substring list).

The tool gate takes precedence over the prose gate on purpose. A vertical bot
answering entirely from a tool routinely retrieves zero documents, and letting the
prose half drag that down to NO_DATA is audit D3 - the finding that a correct
tool-sourced price logs as unanswered while a confident fabrication logs as answered.
"""
import logging
from typing import Any, Dict, List, Optional, Sequence

from langchain_core.messages import HumanMessage

from . import gate, refusal
from .states import RefusalCause, TurnState
from .turn import TurnResult

logger = logging.getLogger(__name__)

_COMPOSE_INSTRUCTION = (
    "Answer the visitor now using only the tool results already above. Do not call "
    "any more tools. If those results do not answer the question, say plainly what "
    "you could not find and stop there - the platform adds the next step itself."
)


def _content_to_text(content: object) -> str:
    """Flatten a LangChain message content (str | list of parts) to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for chunk in content:
            if isinstance(chunk, dict):
                parts.append(chunk.get("text", ""))
            elif isinstance(chunk, str):
                parts.append(chunk)
        return "".join(parts)
    return str(content) if content is not None else ""


async def compose_without_tools(model, convo: List[Any], usage_out, accumulate) -> str:
    """One final answer over the observations already gathered (B2).

    ``compose_model`` is preferred when the caller has an unbound model to hand;
    otherwise the same bound model is asked, with an explicit instruction not to
    call anything. Either way a tool call in the reply is ignored - this is the
    last round, and half an answer beats the generic fallback.
    """
    try:
        response = await model.ainvoke(convo + [HumanMessage(content=_COMPOSE_INSTRUCTION)])
    except Exception:
        logger.exception("compose: tool-free compose failed")
        return ""
    accumulate(usage_out, response)
    return _content_to_text(getattr(response, "content", ""))


def settle(
    *,
    text: str,
    tool_trace: Sequence = (),
    retrieved_doc_count: int = 0,
    sources: Optional[List[Dict[str, Any]]] = None,
    context: Optional[Dict[str, str]] = None,
    attempt: int = 0,
    options: Sequence[str] = (),
    system_error: bool = False,
    small_talk: bool = False,
    allow_rewrite: bool = True,
) -> TurnResult:
    """The settled outcome of one turn.

    ``attempt`` is how many times this topic has already been refused, so the
    refusal builder can avoid repeating itself (§1.4).
    ``system_error`` is the caller's own failure - a raised exception, a blown
    deadline - which outranks everything: outcome 6 is never presented as outcome 4.
    ``small_talk`` suppresses the prose gate for a message too short to be a real
    question ("hi", "ok"), inheriting today's carve-out: a greeting retrieves
    nothing and must not therefore be recorded as a question we failed to answer.
    ``allow_rewrite=False`` keeps the model's words no matter the outcome - the
    generic bot streams token by token, so by the time the turn settles the text
    is already on the visitor's screen and can only be classified, not replaced.
    """
    settled_sources = list(sources or [])

    if system_error:
        return _finish(TurnState.SYSTEM_ERROR, RefusalCause.MODEL_ERROR, text,
                       settled_sources, tool_trace, context, attempt, options,
                       replace_text=allow_rewrite)

    state, cause = gate.gate_tools(tool_trace)
    tool_gated = state is not None
    if state is None and not small_talk:
        state, cause = gate.gate_prose(retrieved_doc_count)
    if state is None and small_talk and not settled_sources:
        # Nothing was looked up because nothing needed looking up. Rule 3 still
        # holds - the system can name where this came from, and it wasn't a record.
        settled_sources = [{"kind": "conversation", "label": "no lookup needed"}]
    if state is None:
        # Neither gate can justify a claim: no tool ran and documents came back.
        # Whether those documents actually support the answer is the grounding gate,
        # deferred to the audit's Slice A - so the honest reading is "answered", the
        # same reading today's code makes, not a threshold invented here.
        state, cause = TurnState.ANSWERED, None

    replace_text = False

    # The model refused in prose. Whatever the gates concluded, the visitor was told
    # we don't have it, so that is the outcome - and one canned paragraph is exactly
    # what §1.4's builder exists to replace.
    if refusal.reads_as_refusal(text):
        degraded = gate.worst([state, TurnState.NO_DATA])
        if degraded is not state:
            cause = cause or RefusalCause.NOT_IN_KNOWLEDGE_BASE
        state = degraded
        replace_text = allow_rewrite
    elif tool_gated and state is TurnState.NO_DATA:
        # Every lookup came back empty, so there is no real answer underneath the
        # model's wording. The server writes this one (owner ruling, 2026-08-11).
        replace_text = allow_rewrite
    elif state is TurnState.SYSTEM_ERROR and not (text or "").strip():
        replace_text = allow_rewrite

    # Rule 3: if the system can't name the source, it can't say the fact. Enforced
    # here rather than in TurnResult, which can only raise - a live turn has to
    # degrade to something sayable instead of 500ing on the visitor.
    if state is TurnState.ANSWERED and not settled_sources:
        state, cause = TurnState.PARTIAL, RefusalCause.NO_SOURCE

    return _finish(state, cause, text, settled_sources, tool_trace, context,
                   attempt, options, replace_text=replace_text)


def _finish(state, cause, text, sources, tool_trace, context, attempt, options,
            *, replace_text: bool) -> TurnResult:
    final_text = text or ""
    if replace_text:
        written = refusal.for_state(state, cause, context=context,
                                    attempt=attempt, options=options)
        if written:
            final_text = written
    if state in (TurnState.NO_DATA, TurnState.SYSTEM_ERROR) and cause is None:
        cause = RefusalCause.NOT_IN_KNOWLEDGE_BASE
    return TurnResult(
        state=state,
        text=final_text,
        cause=cause,
        sources=list(sources),
        tool_trace=list(tool_trace or ()),
    )
