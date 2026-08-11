"""``get_product_spec`` - commercial spec lookup for product-discovery questions.

Product discovery goes through here, not ``request_quote``, so without this capture
it would surface no selection chips and never advance the funnel. Mirrors the quote
flow: chips when there is a choice, a resolved product when there is not.
"""
from services import agent
from ..registry import RuntimeTool, ToolContext, register


def _execute(ctx: ToolContext, args: dict) -> dict:
    return agent.get_product_spec(
        ctx.cursor,
        ctx.company_id,
        cas_number=args.get("cas_number"),
        product_name=args.get("product_name"),
        grade=args.get("grade"),
    )


def _capture(args: dict, obs: dict) -> dict:
    if not isinstance(obs, dict):
        return {}
    if obs.get("status") == "ambiguous" and obs.get("grades"):
        return {
            "grade_selector": {
                "product": obs.get("product"),
                "grades": obs.get("grades", []),
                "grade_pack_map": {},
            }
        }
    if obs.get("status") != "found":
        return {}
    product = obs.get("product") or {}
    packs = obs.get("pack_sizes") or []
    patch = {
        "spec": {
            "product": product.get("name"),
            "grade": product.get("grade"),
            "packaging": product.get("packaging"),
        }
    }
    if len(packs) > 1:
        patch["pack_selector"] = {
            "product": product.get("name"),
            "grade": product.get("grade"),
            "pack_sizes": packs,
        }
    return patch


TOOL = register(
    RuntimeTool(
        name="get_product_spec",
        execute=_execute,
        status_phrase="Finding the product…",
        capture=_capture,
        capture_keys=("spec", "grade_selector", "pack_selector"),
    )
)
