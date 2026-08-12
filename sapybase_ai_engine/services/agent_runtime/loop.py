"""The bounded ReAct loop, extracted from ``services/agent.py``.

Reason -> Act -> Observe until the model settles on text. Pure over
(model, conversation, tool_executor): no capture, no SSE, no DB. It yields progress
events and the SSE layer decides what to do with them.

Two behaviours changed in the extraction, both previously untested (which is why
they survived - docs/audit-agent-behaviour.md B1, B2):

B1 - a round advertising more calls than the budget used to append the AIMessage
and then execute only the first four, leaving the rest with no ``ToolMessage``.
The model got four answers to five questions with no signal that one was dropped,
and the next round could be rejected outright for mismatched call/response parts.
Now every advertised call gets a response: the ones past the budget get an explicit
"not run" observation, so a dropped lookup is visible to the model instead of silent.

B2 - exhausting the round budget threw away every tool result gathered along the
way and returned the generic fallback, discarding a resolved product, a valid SDS
URL and a priced SKU. Now the loop makes one final tool-free compose call over the
observations it already has, and only falls back if that also produces nothing.
"""
import inspect
import json
import logging
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

from langchain_core.messages import ToolMessage

from . import registry
from .turn import ToolCall

logger = logging.getLogger(__name__)

# Bounds: a vertical answer is at most this many Reason->Act rounds, and we never
# run more than this many tool calls in a single round. Prevents an LLM that keeps
# requesting tools from looping forever or draining the budget.
MAX_TOOL_ROUNDS = 4
MAX_CALLS_PER_ROUND = 4

# Shown when the agent cannot produce a grounded answer (LLM error, exhausted
# rounds, or a tool failure). Always routes to a human - never guesses.
AGENT_FALLBACK_TEXT = (
    "I'm having trouble reaching our product system right now — let me connect "
    "you with our team so they can help you directly."
)

# Handed back for a call the round budget would not run, in place of silence.
_OVER_BUDGET_OBSERVATION = {
    "status": "not_run",
    "message": (
        "This lookup was not run — too many tool calls in one round. Answer with "
        "the results you did get and say which item you still need to check."
    ),
}

def _status_phrase(name: Optional[str]) -> str:
    """The visitor-safe label for a running tool."""
    return registry.status_phrase(name)


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


def _accumulate_usage(usage_out: Optional[Dict[str, int]], response) -> None:
    """Fold one model response's token usage into ``usage_out``.

    SUMs across the loop's rounds so the caller sees the whole turn's cost, and
    picks up ``cached_tokens`` (Gemini's implicit context-cache hit) where reported.
    Best-effort: metering must never affect the answer or raise.
    """
    if usage_out is None:
        return
    try:
        meta = getattr(response, "usage_metadata", None) or {}
        for key in ("input_tokens", "output_tokens", "total_tokens"):
            val = meta.get(key)
            if isinstance(val, (int, float)) and val > 0:
                usage_out[key] = usage_out.get(key, 0) + int(val)
        cache_read = (meta.get("input_token_details") or {}).get("cache_read")
        if isinstance(cache_read, (int, float)) and cache_read > 0:
            usage_out["cached_tokens"] = usage_out.get("cached_tokens", 0) + int(cache_read)
    except Exception:
        pass


def _finish_reason(response) -> Optional[str]:
    """Best-effort read of Gemini's per-call finish reason (STOP/MAX_TOKENS/...), so
    a fallback caused by hitting the token cap is distinguishable in logs from a
    real API error or an exhausted round budget."""
    try:
        return (getattr(response, "response_metadata", None) or {}).get("finish_reason")
    except Exception:
        return None


async def _observe(tool_executor: Callable, name: Optional[str], args: Dict[str, Any]) -> dict:
    """Run one tool call, degrading a failure into an observation the model can act on."""
    try:
        observation = tool_executor(name, args or {})
        # A tool may be async - get_coa reaches Google Drive, which must not block
        # the event loop the SSE stream runs on. Sync tools never return awaitables.
        if inspect.isawaitable(observation):
            observation = await observation
        return observation
    except Exception:
        logger.exception("agent loop: tool '%s' failed", name)
        return {
            "status": "error",
            "message": "The lookup failed. Offer to connect the visitor to the team.",
        }


async def _compose_without_tools(model, convo: List[Any], usage_out) -> str:
    """The B2 compose round. The call itself lives in ``compose.py`` (Phase 5) so
    the loop and the pipeline settle a turn through the same code path."""
    from .compose import compose_without_tools

    return await compose_without_tools(model, convo, usage_out, _accumulate_usage)


async def stream_agent_loop(
    model,
    messages: List[Any],
    tool_executor: Callable[[str, Dict[str, Any]], Dict[str, Any]],
    *,
    max_rounds: int = MAX_TOOL_ROUNDS,
    max_calls_per_round: int = MAX_CALLS_PER_ROUND,
    usage_out: Optional[Dict[str, int]] = None,
    compose_model=None,
    trace_out: Optional[List[ToolCall]] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """Run the loop, yielding progress so the SSE layer can show motion.

      * ``{"type": "status", "tool": <name>, "label": <phrase>}`` before each call.
      * ``{"type": "final", "text": <answer>}`` exactly once at the end, carrying
        the settled answer (or ``AGENT_FALLBACK_TEXT``).

    ``trace_out``, like ``usage_out``, is an out-param the caller owns: every call
    the loop performed, in order, with the status its observation reported. It is
    what lets escalation see a ``not_found`` (§1.5) instead of inferring one from
    the wording of the reply.
    """
    convo = list(messages)
    used_tools = False

    for _round in range(max_rounds):
        try:
            response = await model.ainvoke(convo)
        except Exception:
            logger.exception("agent loop: model.ainvoke failed")
            yield {"type": "final", "text": AGENT_FALLBACK_TEXT}
            return

        _accumulate_usage(usage_out, response)
        if _finish_reason(response) == "MAX_TOKENS":
            logger.warning("agent loop: round %d hit MAX_TOKENS", _round)

        tool_calls = getattr(response, "tool_calls", None) or []
        if not tool_calls:
            text = _content_to_text(getattr(response, "content", ""))
            if text:
                yield {"type": "final", "text": text}
                return
            # Empty content + no tool call is usually a one-off token-budget roll
            # (thinking consumed the round) rather than a real failure - the very
            # next turn often succeeds unprompted. Retry once before giving up.
            logger.warning(
                "agent loop: empty response (finish_reason=%s), retrying once",
                _finish_reason(response),
            )
            try:
                retry = await model.ainvoke(convo)
            except Exception:
                logger.exception("agent loop: retry model.ainvoke failed")
                yield {"type": "final", "text": AGENT_FALLBACK_TEXT}
                return
            _accumulate_usage(usage_out, retry)
            if _finish_reason(retry) == "MAX_TOKENS":
                logger.warning("agent loop: retry hit MAX_TOKENS")
            retry_calls = getattr(retry, "tool_calls", None) or []
            if retry_calls:
                response, tool_calls = retry, retry_calls
            else:
                yield {
                    "type": "final",
                    "text": _content_to_text(getattr(retry, "content", "")) or AGENT_FALLBACK_TEXT,
                }
                return

        # Reason produced tool calls -> Act + Observe, then loop so the model can
        # read the results and (usually) answer on the next round.
        convo.append(response)
        used_tools = True
        if len(tool_calls) > max_calls_per_round:
            logger.warning(
                "agent loop: round %d requested %d calls, budget %d — the rest are "
                "answered 'not_run'", _round, len(tool_calls), max_calls_per_round,
            )
        for index, call in enumerate(tool_calls):
            name = call.get("name")
            if index < max_calls_per_round:
                yield {"type": "status", "tool": name, "label": _status_phrase(name)}
                observation = await _observe(tool_executor, name, call.get("args"))
            else:
                # Every advertised call gets a response, budget or not (B1).
                observation = _OVER_BUDGET_OBSERVATION
            if trace_out is not None:
                trace_out.append(ToolCall(
                    name=name or "",
                    args=dict(call.get("args") or {}),
                    status=str((observation or {}).get("status") or ""),
                ))
            convo.append(
                ToolMessage(
                    content=json.dumps(observation, default=str),
                    tool_call_id=call.get("id") or "",
                )
            )

    # Ran the round budget without the model settling on text. Everything the tools
    # returned is still in `convo` - compose over it rather than discarding it (B2).
    logger.warning("agent loop: exhausted %d rounds without a text answer", max_rounds)
    if used_tools:
        text = await _compose_without_tools(compose_model or model, convo, usage_out)
        if text:
            yield {"type": "final", "text": text}
            return
    yield {"type": "final", "text": AGENT_FALLBACK_TEXT}


async def run_agent_loop(
    model,
    messages: List[Any],
    tool_executor: Callable[[str, Dict[str, Any]], Dict[str, Any]],
    *,
    max_rounds: int = MAX_TOOL_ROUNDS,
    max_calls_per_round: int = MAX_CALLS_PER_ROUND,
    usage_out: Optional[Dict[str, int]] = None,
    compose_model=None,
    trace_out: Optional[List[ToolCall]] = None,
) -> str:
    """Thin drain of :func:`stream_agent_loop` for callers that do not stream:
    returns only the final answer text and discards the progress events."""
    final_text = AGENT_FALLBACK_TEXT
    async for event in stream_agent_loop(
        model, messages, tool_executor,
        max_rounds=max_rounds, max_calls_per_round=max_calls_per_round,
        usage_out=usage_out, compose_model=compose_model, trace_out=trace_out,
    ):
        if event.get("type") == "final":
            final_text = event.get("text") or AGENT_FALLBACK_TEXT
    return final_text
