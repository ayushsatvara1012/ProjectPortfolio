"""``get_product_spec`` - commercial spec lookup for product-discovery questions.

Commercial data only: it never returns hazard/handling info and never returns the
SDS URL itself (``sds_available`` is a boolean nudge so the agent can offer the
sheet via ``get_sds``).

Product discovery goes through here, not ``request_quote``, so without the capture
below it would surface no selection chips and never advance the funnel. Mirrors the
quote flow: chips when there is a choice, a resolved product when there is not.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from ..registry import RuntimeTool, ToolContext, register
from .resolve import is_https, resolve_product, split_packs


def get_product_spec(
    cursor,
    company_id,
    *,
    cas_number: Optional[str] = None,
    product_name: Optional[str] = None,
    grade: Optional[str] = None,
) -> Dict[str, Any]:
    """Look up a product's COMMERCIAL spec (grade, packaging), tenant-scoped.

    Read-only, no LLM. Resolution is the shared ``resolve_product`` path (CAS exact
    -> name exact -> partial = confirm, ``grade`` narrows), so a fuzzy name never
    auto-serves the wrong product's spec. Statuses:
      found | ambiguous | not_found | missing_identifier

    The safety guardrail is preserved: the ``message`` tells the model to route any
    safety question to ``get_sds`` and to not infer hazards from grade or purity.
    """
    resolved = resolve_product(
        cursor, company_id, (cas_number or "").strip(), (product_name or "").strip(),
        (grade or "").strip(),
    )
    if "row" not in resolved:
        # Ambiguous. Only enrich into a flat grade list (→ selectable grade chips)
        # when EVERY candidate is the SAME product sold in several grades. When the
        # candidates are DIFFERENT products (a CAS or fuzzy name that maps to more
        # than one product), flattening their grades under the first product's name
        # would mislabel them — so surface the product candidates instead and let
        # the agent ask which product (Phase 1.6).
        if resolved.get("status") == "ambiguous":
            cands = resolved.get("candidates") or []
            names = {(c.get("name") or "").strip().lower() for c in cands if c.get("name")}
            if len(names) == 1:
                grades = []
                for c in cands:
                    g = (c.get("grade") or "").strip()
                    if g and g not in grades:
                        grades.append(g)
                if grades:
                    resolved["grades"] = grades
                    resolved["product"] = cands[0].get("name")
            elif len(names) > 1:
                # Distinct product names to choose between — the disambiguation is
                # by product, not grade. No grade chips are emitted; the agent asks
                # which product from the ``candidates``/``products`` in the message.
                resolved["products"] = [c.get("name") for c in cands if c.get("name")]
        # `rows` is an internal helper field (raw DB tuples, incl. a datetime) —
        # never let it reach the model's observation. See resolve_product's docstring.
        resolved.pop("rows", None)
        return resolved

    name_, cas_, grade_, packaging_, sds_ref_, _updated_ = resolved["row"]

    # Fallback for symptom 3 (agent-conversation-gaps plan §4.1): `products` and
    # `product_skus` are catalogued at different levels — a product row can carry
    # no grade/packaging text of its own while its SKUs (the same rows the quote
    # flow reads) know exactly which grades and pack sizes exist. Only reached
    # when a field is actually blank; a populated `products` value always wins,
    # this never overrides it. Resolution itself is untouched — this runs strictly
    # after a single product is already chosen.
    if not (grade_ or "").strip() or not (packaging_ or "").strip():
        cursor.execute(
            "SELECT DISTINCT grade, pack_size FROM product_skus "
            "WHERE company_id = %s AND lower(product_name) = lower(%s)",
            (company_id, name_),
        )
        sku_rows = cursor.fetchall() or []
        if not (grade_ or "").strip():
            sku_grades = sorted({(r[0] or "").strip() for r in sku_rows if r[0] and r[0].strip()})
            if sku_grades:
                grade_ = ", ".join(sku_grades)
        if not (packaging_ or "").strip():
            sku_packs = sorted({(r[1] or "").strip() for r in sku_rows if r[1] and r[1].strip()})
            if sku_packs:
                packaging_ = ", ".join(sku_packs)

    # Additive, honest partial results (symptom 4, plan §4.2): `status` stays
    # "found" — a new status would be a value the widget/tests may switch on,
    # which the plan freezes. `missing_fields` tells the model plainly what's NOT
    # on file instead of silently answering the same question two different ways.
    missing_fields = [
        f for f, v in (("grade", grade_), ("packaging", packaging_))
        if not (v or "").strip()
    ]

    message = (
        "Share the commercial spec fields that are present; do not invent any "
        "field that is null. This is commercial information only — for ANY "
        "safety, hazard, handling, storage, or regulatory question call get_sds "
        "and answer only from that document. Never infer hazards from grade or "
        "purity. If sds_available is true, you may offer to fetch the SDS."
    )
    if missing_fields:
        message += (
            f" {', '.join(missing_fields)} — not on file for this product. State "
            "plainly that these details aren't on file and offer to connect the "
            "visitor with the team for them; do not stay silent about what's "
            "missing and do not imply the product doesn't exist."
        )

    return {
        "status": "found",
        "product": {
            "name": name_,
            "cas_number": cas_,
            "grade": grade_,
            "packaging": packaging_,
        },
        "pack_sizes": split_packs(packaging_),
        "sds_available": is_https(sds_ref_),
        "missing_fields": missing_fields,
        "message": message,
    }


def _execute(ctx: ToolContext, args: dict) -> dict:
    return get_product_spec(
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
