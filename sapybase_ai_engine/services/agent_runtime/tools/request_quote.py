"""``request_quote`` - price a SKU, or log a price-on-request.

Every priced/POR quote is also a warm lead, so the capture emits the owner handoff
alongside the visitor's quote card. The model is told to describe these figures,
never to re-derive them.
"""
from services import agent
from ..contact import captured_contact_echo
from ..registry import RuntimeTool, ToolContext, register


def _execute(ctx: ToolContext, args: dict) -> dict:
    return agent.request_quote(
        ctx.cursor,
        ctx.company_id,
        product_name=args.get("product_name"),
        cas_number=args.get("cas_number"),
        grade=args.get("grade"),
        pack_size=args.get("pack_size"),
        quantity=args.get("quantity"),
        contact_name=args.get("contact_name"),
        contact_email=args.get("contact_email"),
        contact_phone=args.get("contact_phone"),
        session_id=ctx.session_id,
    )


def _capture(args: dict, obs: dict) -> dict:
    if not isinstance(obs, dict):
        return {}
    status = obs.get("status")
    if status in ("quoted", "price_on_request"):
        money = {
            "product": obs.get("product"),
            "grade": obs.get("grade"),
            "pack_size": obs.get("pack_size"),
            "quantity": obs.get("quantity"),
            "unit_price": obs.get("unit_price"),
            "subtotal": obs.get("subtotal"),
            "gst_rate": obs.get("gst_rate"),
            "currency": obs.get("currency") or "INR",
        }
        return {
            "quote": {
                "status": status,
                **money,
                "gst_note": obs.get("gst_note"),
                "captured_contact": captured_contact_echo(args),
                "quote_url": obs.get("quote_url"),
            },
            "handoff": {
                "kind": "quote",
                "status": status,
                **money,
                "is_por": status == "price_on_request",
                "contact_name": args.get("contact_name"),
                "contact_email": args.get("contact_email"),
                "contact_phone": args.get("contact_phone"),
            },
        }
    if status == "needs_grade" and obs.get("grades"):
        return {
            "grade_selector": {
                "product": obs.get("product"),
                "grades": obs.get("grades", []),
                "grade_pack_map": obs.get("grade_pack_map", {}),
            }
        }
    if status == "needs_pack" and obs.get("pack_sizes"):
        return {
            "pack_selector": {
                "product": obs.get("product"),
                "grade": obs.get("grade"),
                "pack_sizes": obs.get("pack_sizes", []),
            }
        }
    return {}


TOOL = register(
    RuntimeTool(
        name="request_quote",
        execute=_execute,
        status_phrase="Checking pricing…",
        capture=_capture,
        capture_keys=("quote", "handoff", "grade_selector", "pack_selector"),
    )
)
