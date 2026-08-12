"""``request_sample`` - open the structured sample form inline.

A sample request is a structured intake (product, grade, quantity, contact,
shipping, ...), so collection is a FORM, not conversational slot-filling. The
record, the spreadsheet push and the owner handoff all happen on FORM SUBMIT
(``submit_sample_request``), never from the model; this only surfaces the form,
prefilled with whatever product/grade the model parsed. That keeps the sample flow
LLM-free, so it can't loop on disambiguation or time out.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from ..registry import RuntimeTool, ToolContext, register


def request_sample(
    cursor,
    company_id,
    *,
    product_name: Optional[str] = None,
    cas_number: Optional[str] = None,
    grade: Optional[str] = None,
    **_ignored,
) -> Dict[str, Any]:
    """Open the sample request form for the visitor. No DB write, no LLM.

    Returns a single ``open_form`` status; the capture below turns it into the
    {form} action the widget renders. Any product/grade the model parsed from the
    message is passed back as a prefill hint so the form opens with those fields
    filled in. Extra kwargs are ignored so the model can't drive collection through
    the tool (``cursor`` is unused; the signature stays uniform with the other
    tools)."""
    prefill: Dict[str, Any] = {}
    if (product_name or "").strip():
        prefill["product"] = product_name.strip()
    if (grade or "").strip():
        prefill["grade"] = grade.strip()
    if (cas_number or "").strip():
        prefill["cas_number"] = cas_number.strip()
    return {
        "status": "open_form",
        "form_id": "sample",
        "prefill": prefill,
        "message": (
            "A sample request form has been opened for the visitor to fill in. Tell "
            "them briefly to complete the short form and you'll get their request to "
            "the team. Do NOT ask for the fields yourself, and do NOT promise a "
            "price, a quantity limit, or a delivery date."
        ),
    }


def _execute(ctx: ToolContext, args: dict) -> dict:
    return request_sample(
        ctx.cursor,
        ctx.company_id,
        product_name=args.get("product_name"),
        cas_number=args.get("cas_number"),
        grade=args.get("grade"),
    )


def _capture(args: dict, obs: dict) -> dict:
    if not isinstance(obs, dict) or obs.get("status") != "open_form":
        return {}
    return {
        "form": {
            "form_id": obs.get("form_id") or "sample",
            "prefill": obs.get("prefill") or {},
        }
    }


TOOL = register(
    RuntimeTool(
        name="request_sample",
        execute=_execute,
        status_phrase="Preparing the sample request…",
        capture=_capture,
        capture_keys=("form",),
    )
)
