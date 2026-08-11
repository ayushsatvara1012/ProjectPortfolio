"""``get_sds`` - resolve a product's safety data sheet.

The capture turns a resolved sheet into a deterministic button payload; the model
is told never to paste the link itself (SDS content is verbatim-from-document only,
per CLAUDE.md's safety rule).
"""
from services import agent
from ..registry import RuntimeTool, ToolContext, register


def _execute(ctx: ToolContext, args: dict) -> dict:
    return agent.get_sds(
        ctx.cursor,
        ctx.company_id,
        cas_number=args.get("cas_number"),
        product_name=args.get("product_name"),
        grade=args.get("grade"),
    )


def _capture(args: dict, obs: dict) -> dict:
    if not isinstance(obs, dict) or obs.get("status") != "found" or not obs.get("sds_url"):
        return {}
    product = obs.get("product") or {}
    return {
        "sds": {
            "url": obs["sds_url"],
            "product": product.get("name"),
            "cas_number": product.get("cas_number"),
            "updated_at": obs.get("last_updated"),
            "label": "Open SDS",
        }
    }


TOOL = register(
    RuntimeTool(
        name="get_sds",
        execute=_execute,
        status_phrase="Looking up the safety data sheet…",
        capture=_capture,
        capture_keys=("sds",),
    )
)
