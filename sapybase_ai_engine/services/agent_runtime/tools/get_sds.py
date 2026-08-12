"""``get_sds`` - resolve a product's safety data sheet.

THE non-negotiable guardrail (CLAUDE.md): safety / SDS / handling / dosage /
storage / regulatory answers come ONLY from the real document this tool returns,
never from the model's own words. Everything here is built so a miss escalates to
a human rather than improvising chemistry.

The capture turns a resolved sheet into a deterministic button payload; the model
is told never to paste the link itself.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from ..registry import RuntimeTool, ToolContext, register
from .resolve import PRODUCT_COLS, is_https

logger = logging.getLogger(__name__)

# A partial-name match can pull in far more rows than the picker will ever need
# (`/api/widget/sds-products` is the exhaustive, capped list) — this just needs
# enough rows to reliably enumerate the DISTINCT product names for a
# conversational "which product?" confirmation.
_SDS_PARTIAL_LIMIT = 50


def resolve_sds(cursor, company_id, cas: str, name: str) -> Dict[str, Any]:
    """Resolve a CAS/name to ONE product's SDS, grade-agnostic (D2, D4, D9).

    A SEPARATE resolver from ``resolve_product`` (D8) — that shared path is what
    ``get_product_spec`` depends on for grade-level commercial data and is left
    byte-for-byte unchanged. An SDS is tied to the PRODUCT, not the grade, so this
    resolver never takes or narrows on a grade at all: every matched row is grouped
    by trimmed, case-insensitive product NAME (D4), and ambiguity is judged by
    DISTINCT NAME count, not row count — a single CAS shared across several
    distinct product names (real Expresolv data: one CAS -> 6 names) must still ask
    which product, even though the CAS matched unambiguously.

    Resolution order mirrors ``resolve_product``: exact CAS -> exact name ->
    partial name (never auto-served, only ever offered as candidates).

    Returns one of:
      - ``{"status": "found", "rows": [...]}`` — exactly one product name
        matched; ``rows`` are every row for THAT product (all its grades), for
        the caller to pick the newest https sheet from (see
        ``newest_https_row``). This ``rows`` key is internal — callers must strip
        it before returning.
      - ``{"status": "not_found", "message": ...}``
      - ``{"status": "missing_identifier", "message": ...}``
      - ``{"status": "ambiguous", "candidates": [...], "message": ...}`` — >1
        distinct product name matched; candidates are name/cas ONLY (no grade,
        no rows) since the ask is "which product", never "which grade".

    SECURITY: every query is company_id-scoped, identical discipline to
    ``resolve_product``.
    """
    if not cas and not name:
        return {
            "status": "missing_identifier",
            "message": "Ask the visitor for the product name or, ideally, its CAS number.",
        }

    rows = []

    if cas:
        cursor.execute(
            f"SELECT {PRODUCT_COLS} FROM products WHERE company_id = %s AND cas_number = %s",
            (company_id, cas),
        )
        rows = cursor.fetchall() or []

    if not rows and name:
        cursor.execute(
            f"SELECT {PRODUCT_COLS} FROM products WHERE company_id = %s AND lower(name) = lower(%s)",
            (company_id, name),
        )
        rows = cursor.fetchall() or []

    if not rows and name:
        cursor.execute(
            f"SELECT {PRODUCT_COLS} FROM products WHERE company_id = %s AND name ILIKE %s "
            f"LIMIT {_SDS_PARTIAL_LIMIT}",
            (company_id, f"%{name}%"),
        )
        rows = cursor.fetchall() or []

    if not rows:
        return {
            "status": "not_found",
            "message": (
                "No matching product in the catalog. Tell the visitor you don't "
                "have it on file and offer to connect them to the team."
            ),
        }

    groups: Dict[str, list] = {}
    order: List[str] = []
    for r in rows:
        key = (r[0] or "").strip().lower()
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(r)

    if len(order) > 1:
        return {
            "status": "ambiguous",
            "candidates": [{"name": groups[k][0][0], "cas_number": groups[k][0][1]} for k in order],
            "message": (
                "Several distinct products match. Ask the visitor to confirm the "
                "exact PRODUCT (never the grade — an SDS is per product) before "
                "sharing anything."
            ),
        }

    return {"status": "found", "rows": groups[order[0]]}


def newest_https_row(rows) -> tuple:
    """Pick the https-sheet row with the greatest ``updated_at`` (D3, NULLS LAST).

    Shared selection logic — the picker endpoint reuses this SAME helper so the
    conversational path and the picker can never disagree on which sheet a product
    resolves to (plan 3c).

    Never raises on a NULL ``updated_at`` (comparing two ``None`` values would
    raise ``TypeError``, so nulls are only ever skipped, never compared against
    each other) — a null-dated row simply loses to any dated row and, absent
    any dated row, the first https row wins deterministically.

    Returns ``(best_row_or_None, has_conflicting_links)`` — the second value
    flags when more than one DISTINCT https link exists across the rows (D3
    data-hygiene signal), independent of which one "won".
    """
    https_rows = [r for r in rows if is_https(r[4])]
    if not https_rows:
        return None, False

    best = https_rows[0]
    for r in https_rows[1:]:
        updated, best_updated = r[5], best[5]
        if updated is None:
            continue
        if best_updated is None or updated > best_updated:
            best = r

    distinct_links = {r[4].strip() for r in https_rows}
    return best, len(distinct_links) > 1


def get_sds(
    cursor,
    company_id,
    *,
    cas_number: Optional[str] = None,
    product_name: Optional[str] = None,
    grade: Optional[str] = None,
) -> Dict[str, Any]:
    """Look up a product's real SDS, scoped to ONE tenant. Pure data, no LLM.

    An SDS is tied to the PRODUCT, not the grade (D2). ``grade`` is accepted
    only for backward compatibility with older calls and is ALWAYS ignored
    (D9) — resolution uses the SEPARATE grade-agnostic ``resolve_sds`` (D8),
    never the shared ``resolve_product`` that ``get_product_spec`` depends
    on. When a product's grades carry the same sheet, or differing sheets, the
    newest https ``sds_ref`` wins deterministically (D3) — there is nothing to
    ask. Ambiguity only exists at the PRODUCT level: several DISTINCT products
    matched (a fuzzy name, or one CAS shared across names) -> ask which
    product, never which grade. Returns a status dict the model reads as its
    observation: found | no_sheet_on_file | ambiguous | not_found |
    missing_identifier

    SECURITY: resolution is tenant-scoped (via ``resolve_sds``). A product
    with no https sheet on any of its rows is reported as ``no_sheet_on_file``
    (we have the product but no servable sheet) so the agent escalates
    instead of handing out a broken or insecure link.
    """
    resolved = resolve_sds(cursor, company_id, (cas_number or "").strip(), (product_name or "").strip())

    if resolved.get("status") != "found":
        resolved.pop("rows", None)
        return resolved

    rows = resolved["rows"]
    name_, cas_ = rows[0][0], rows[0][1]
    best, has_conflicting_links = newest_https_row(rows)

    if has_conflicting_links:
        # Data-hygiene signal only (D3) — side-effect-free for the visitor.
        logger.warning(
            "get_sds: product %r (cas=%r) has multiple distinct https SDS links "
            "across its grades; serving the newest, owner should reconcile.",
            name_, cas_,
        )

    if best is None:
        return {
            "status": "no_sheet_on_file",
            "product": {"name": name_, "cas_number": cas_},
            "message": (
                "We have this product but no SDS is on file. Tell the visitor you "
                "don't have the sheet and offer to connect them to the team. Do NOT "
                "provide any safety, hazard, or handling information yourself."
            ),
        }

    sds_ref_, updated_ = best[4], best[5]

    return {
        "status": "found",
        "product": {"name": name_, "cas_number": cas_},
        "sds_url": sds_ref_.strip(),
        "last_updated": (
            updated_.isoformat() if hasattr(updated_, "isoformat")
            else (str(updated_) if updated_ else None)
        ),
        "message": (
            "The visitor is automatically shown a dedicated SDS panel with this "
            "sheet pinned and ready to open — do NOT paste the URL or a markdown "
            "link yourself. Just briefly confirm the safety sheet for this product "
            "is ready. Do not summarise or paraphrase hazard, handling, or storage "
            "details — the document is the source of truth."
        ),
    }


def _execute(ctx: ToolContext, args: dict) -> dict:
    return get_sds(
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
