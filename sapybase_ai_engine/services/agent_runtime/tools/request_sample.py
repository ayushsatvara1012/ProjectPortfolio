"""``request_sample`` - open the structured sample form inline.

The record, the spreadsheet push and the owner handoff all happen on FORM SUBMIT
(``submit_sample_request``), not here; this only surfaces the form, prefilled with
whatever product/grade the model parsed.
"""
from services import agent
from ..registry import RuntimeTool, ToolContext, register


def _execute(ctx: ToolContext, args: dict) -> dict:
    return agent.request_sample(
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
