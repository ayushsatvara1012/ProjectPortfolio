"""Vertical-agent runtime — the ReAct (Reason → Act → Observe) loop + tools.

Phase 1 of the chemical-vertical-agent plan (§9). This module is the *behaviour*
half of the pack machinery whose *shape* lives in ``packs/``. It holds:

  - ``get_sds``           — the one Phase 1 tool: a deterministic, tenant-scoped
                            lookup of a product's real Safety Data Sheet URL.
  - ``execute_tool``      — dispatch a model-requested tool name to its function.
  - ``build_tool_schemas``— turn a Pack's declared tools into function-call
                            declarations for ``ChatGoogleGenerativeAI.bind_tools``.
  - ``build_agent_directive`` — the high-priority safety/tool-use system block.
  - ``run_agent_loop``    — the bounded ReAct loop (Reason → Act → Observe → text).

THE non-negotiable guardrail (plan §5): safety / SDS / handling / dosage /
storage / regulatory answers come ONLY from a tool that pulls the real document —
NEVER from the model's own words. ``get_sds`` is that tool; everything here is
built so a miss escalates to a human rather than improvising chemistry.

Design constraints discovered in the codebase (must hold):
  - The DB connection in ``/api/chat`` is released BEFORE the SSE generator is
    consumed, so the whole loop runs in the handler body (conn alive) and the
    answer is precomputed — never call a tool from inside the stream generator.
  - Companies with ``vertical = NULL`` never reach this module (load_pack -> None),
    so the generic bot path is untouched.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict, List, Optional

from langchain_core.messages import ToolMessage

logger = logging.getLogger(__name__)

# Bounds: a vertical answer is at most this many Reason→Act rounds, and we never
# run more than this many tool calls in a single round. Prevents an LLM that keeps
# requesting tools from looping forever or draining the budget.
MAX_TOOL_ROUNDS = 3
MAX_CALLS_PER_ROUND = 4

# Shown when the agent cannot produce a grounded answer (LLM error, exhausted
# rounds, or a tool failure). Always routes to a human — never guesses.
AGENT_FALLBACK_TEXT = (
    "I'm having trouble reaching our product system right now — let me connect "
    "you with our team so they can help you directly."
)


# ── Deterministic tools ──────────────────────────────────────────────────────

def _is_https(url: object) -> bool:
    """An SDS link is only servable if it's a real https URL (no http/relative)."""
    return isinstance(url, str) and url.strip().lower().startswith("https://")


def _candidate(row) -> Dict[str, Any]:
    """Shrink a product row to the fields the agent needs to disambiguate."""
    return {"name": row[0], "cas_number": row[1], "grade": row[2]}


def get_sds(
    cursor,
    company_id,
    *,
    cas_number: Optional[str] = None,
    product_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Look up a product's real SDS, scoped to ONE tenant. Pure data, no LLM.

    Resolution order (CAS is the precise key; a fuzzy name never auto-serves):
      1. exact CAS match
      2. exact (case-insensitive) name match
      3. partial name match -> returned as candidates to CONFIRM, never served

    Returns a status dict the model reads as its observation. Possible statuses:
      found | no_sheet_on_file | ambiguous | not_found | missing_identifier

    SECURITY: every query is filtered by ``company_id`` — a tenant can never see
    another tenant's catalog or SDS. A product with a missing/non-https ``sds_ref``
    is reported as ``no_sheet_on_file`` (we have the product but no servable sheet)
    so the agent escalates instead of handing out a broken or insecure link.
    """
    cas = (cas_number or "").strip()
    name = (product_name or "").strip()

    if not cas and not name:
        return {
            "status": "missing_identifier",
            "message": "Ask the visitor for the product name or, ideally, its CAS number.",
        }

    cols = "name, cas_number, grade, packaging, sds_ref, updated_at"
    rows = []

    # 1. CAS exact — the precise, unambiguous key.
    if cas:
        cursor.execute(
            f"SELECT {cols} FROM products WHERE company_id = %s AND cas_number = %s",
            (company_id, cas),
        )
        rows = cursor.fetchall() or []

    # 2. Name exact (case-insensitive) fallback.
    if not rows and name:
        cursor.execute(
            f"SELECT {cols} FROM products WHERE company_id = %s AND lower(name) = lower(%s)",
            (company_id, name),
        )
        rows = cursor.fetchall() or []

    # 3. Partial name — present as candidates, NEVER auto-serve (safety domain:
    #    a wrong sheet is worse than asking one more question).
    if not rows and name:
        cursor.execute(
            f"SELECT {cols} FROM products WHERE company_id = %s AND name ILIKE %s LIMIT 8",
            (company_id, f"%{name}%"),
        )
        partial = cursor.fetchall() or []
        if not partial:
            return {
                "status": "not_found",
                "message": (
                    "No matching product in the catalog. Tell the visitor you don't "
                    "have that sheet and offer to connect them to the team."
                ),
            }
        return {
            "status": "ambiguous",
            "candidates": [_candidate(r) for r in partial[:8]],
            "message": (
                "One or more products partially match. Ask the visitor to confirm "
                "the exact product (by grade or CAS number) before sharing any SDS."
            ),
        }

    if not rows:
        return {
            "status": "not_found",
            "message": (
                "No matching product in the catalog. Tell the visitor you don't have "
                "that sheet and offer to connect them to the team."
            ),
        }

    # Multiple exact matches = several grades share a name/CAS. Disambiguate.
    if len(rows) > 1:
        return {
            "status": "ambiguous",
            "candidates": [_candidate(r) for r in rows[:8]],
            "message": "Several grades match. Ask the visitor which grade they need.",
        }

    name_, cas_, grade_, packaging_, sds_ref_, updated_ = rows[0]

    if not _is_https(sds_ref_):
        return {
            "status": "no_sheet_on_file",
            "product": {"name": name_, "cas_number": cas_, "grade": grade_},
            "message": (
                "We have this product but no SDS is on file. Tell the visitor you "
                "don't have the sheet and offer to connect them to the team. Do NOT "
                "provide any safety, hazard, or handling information yourself."
            ),
        }

    return {
        "status": "found",
        "product": {
            "name": name_,
            "cas_number": cas_,
            "grade": grade_,
            "packaging": packaging_,
        },
        "sds_url": sds_ref_.strip(),
        "last_updated": (
            updated_.isoformat() if hasattr(updated_, "isoformat")
            else (str(updated_) if updated_ else None)
        ),
        "message": (
            "Share this official SDS link with the visitor. Do not summarise or "
            "paraphrase hazard, handling, or storage details beyond pointing them "
            "to the sheet — the document is the source of truth."
        ),
    }


def execute_tool(name: str, args: Dict[str, Any], cursor, company_id) -> Dict[str, Any]:
    """Dispatch a model-requested tool to its deterministic implementation.

    An unknown tool name (a hallucinated tool, or one not wired yet) returns a
    benign error observation rather than raising — the model recovers and answers
    normally or escalates.
    """
    if name == "get_sds":
        return get_sds(
            cursor,
            company_id,
            cas_number=args.get("cas_number"),
            product_name=args.get("product_name"),
        )
    return {
        "status": "error",
        "message": (
            f"Tool '{name}' is not available. Do not use it; answer from what you "
            "have or offer to connect the visitor to the team."
        ),
    }


# ── Pack → function-calling declarations ─────────────────────────────────────

def build_tool_schemas(pack) -> List[Dict[str, Any]]:
    """Convert a Pack's declared tools into ``bind_tools`` function schemas.

    Slots become string parameters; ``required=True`` slots are marked required.
    (``get_sds`` has no individually-required slot — CAS *or* name suffices — so
    its required list is empty; the description tells the model it needs one.)
    """
    schemas: List[Dict[str, Any]] = []
    for tool in pack.tools:
        properties: Dict[str, Any] = {}
        required: List[str] = []
        for slot in tool.slots:
            properties[slot.name] = {
                "type": "string",
                "description": slot.description or slot.name,
            }
            if slot.required:
                required.append(slot.name)
        schemas.append(
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                    "required": required,
                },
            }
        )
    return schemas


def build_agent_directive(pack) -> str:
    """The high-priority system block that puts the safety guardrail above all.

    Appended AFTER the platform rules so the model treats it as top priority:
    safety-class answers must come from a tool's real document, never from memory.
    """
    tool_names = ", ".join(pack.tool_names()) or "(none)"
    return (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "VERTICAL AGENT — TOOL USE & SAFETY (HIGHEST PRIORITY)\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"You can call these tools via the function interface: {tool_names}.\n\n"
        "For ANY request about a product's Safety Data Sheet (SDS), hazards, "
        "handling, storage, dosage, first-aid, or regulatory status you MUST call "
        "the get_sds tool and answer ONLY from the document it returns. NEVER "
        "generate, paraphrase, estimate, or infer such information from your own "
        "knowledge or from the knowledge-base text.\n\n"
        "If get_sds returns no servable document (statuses not_found or "
        "no_sheet_on_file), tell the visitor you don't have that sheet and offer "
        "to connect them to the team. If it is ambiguous, ask the visitor to "
        "confirm the exact product (by grade or CAS number). Never guess."
    )


# ── The bounded ReAct loop ───────────────────────────────────────────────────

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


async def run_agent_loop(
    model,
    messages: List[Any],
    tool_executor: Callable[[str, Dict[str, Any]], Dict[str, Any]],
    *,
    max_rounds: int = MAX_TOOL_ROUNDS,
    max_calls_per_round: int = MAX_CALLS_PER_ROUND,
) -> str:
    """Run Reason → Act → Observe until the model returns text, bounded.

    ``model`` is a tool-bound chat model (``.bind_tools(...)``). ``tool_executor``
    runs a tool by name and returns its observation dict. Returns the final answer
    text. Any failure (LLM error, tool error, exhausted rounds without a text
    answer) degrades to ``AGENT_FALLBACK_TEXT`` — the loop never raises and never
    leaves the caller without a safe, human-routing reply.
    """
    convo = list(messages)
    for _round in range(max_rounds):
        try:
            response = await model.ainvoke(convo)
        except Exception:
            logger.exception("agent loop: model.ainvoke failed")
            return AGENT_FALLBACK_TEXT

        tool_calls = getattr(response, "tool_calls", None) or []
        if not tool_calls:
            return _content_to_text(getattr(response, "content", "")) or AGENT_FALLBACK_TEXT

        # Reason produced tool calls → Act + Observe, then loop to let the model
        # read the results and (usually) answer on the next round.
        convo.append(response)
        for call in tool_calls[:max_calls_per_round]:
            try:
                observation = tool_executor(call.get("name"), call.get("args") or {})
            except Exception:
                logger.exception("agent loop: tool '%s' failed", call.get("name"))
                observation = {
                    "status": "error",
                    "message": "The lookup failed. Offer to connect the visitor to the team.",
                }
            convo.append(
                ToolMessage(
                    content=json.dumps(observation),
                    tool_call_id=call.get("id") or "",
                )
            )

    # Ran the round budget without the model settling on a text answer.
    logger.warning("agent loop: exhausted %d rounds without a text answer", max_rounds)
    return AGENT_FALLBACK_TEXT
