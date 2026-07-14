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
import os
import re
import secrets
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

from langchain_core.messages import ToolMessage

logger = logging.getLogger(__name__)

# Bounds: a vertical answer is at most this many Reason→Act rounds, and we never
# run more than this many tool calls in a single round. Prevents an LLM that keeps
# requesting tools from looping forever or draining the budget.
# Phase 5 raised rounds 3→4: qualification means the model both answers a product
# question AND reasons about weaving in a discovery question, which can need one
# extra tool round (e.g. spec → quote) within a single turn.
MAX_TOOL_ROUNDS = 4
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


def _split_packs(packaging: object) -> list:
    """Split a free-text packaging field into ordered pack-size options.

    Catalog packaging is stored as free text ("500 ml, 2.5 Ltr" / "500 ml and
    2.5 Ltr / 5 Ltr"). We split on commas, slashes, and the word 'and' so the
    widget can render selectable pack chips for product-discovery questions too
    (not just the quote flow). Returns [] when there's nothing usable.
    """
    if not isinstance(packaging, str) or not packaging.strip():
        return []
    import re
    parts = re.split(r"\s*(?:,|/|\band\b)\s*", packaging.strip(), flags=re.IGNORECASE)
    seen, out = set(), []
    for p in parts:
        p = p.strip()
        key = p.lower()
        if p and key not in seen:
            seen.add(key)
            out.append(p)
    return out


# The single column list every product lookup selects. A superset: ``get_sds``
# needs ``sds_ref``/``updated_at``; ``get_product_spec`` ignores them. Keeping one
# shape lets both tools share the resolver and the ``_candidate`` row indexing.
_PRODUCT_COLS = "name, cas_number, grade, packaging, sds_ref, updated_at"


def _resolve_product(cursor, company_id, cas: str, name: str, grade: str = "") -> Dict[str, Any]:
    """Resolve a CAS/name(/grade) to exactly one product row, or a terminal status.

    Shared by every product tool so resolution can never drift between them.
    Resolution order (CAS is the precise key; a fuzzy name never auto-resolves):
      1. exact CAS match
      2. exact (case-insensitive) name match
      3. partial name match -> returned as candidates to CONFIRM, never served

    When a name/CAS matches several rows (the common case: one product sold in
    LR / AR / HPLC grades, each with its OWN sheet), a supplied ``grade`` narrows
    them to the exact one. Without a grade, multiple matches stay ``ambiguous`` so
    the agent asks which grade — and can then act on the answer.

    Returns one of:
      - ``{"row": <tuple>}``                  — a single unambiguous match
      - ``{"status": "missing_identifier"}``  — neither CAS nor name supplied
      - ``{"status": "not_found", ...}``      — nothing matched
      - ``{"status": "ambiguous", ...}``      — >1 match and no/!matching grade

    SECURITY: every query is filtered by ``company_id`` — a tenant can never see
    another tenant's catalog. The caller decides what to do with the single row
    (e.g. ``get_sds`` still has to vet the ``sds_ref``).
    """
    if not cas and not name:
        return {
            "status": "missing_identifier",
            "message": "Ask the visitor for the product name or, ideally, its CAS number.",
        }

    rows = []

    # 1. CAS exact — the precise, unambiguous key.
    if cas:
        cursor.execute(
            f"SELECT {_PRODUCT_COLS} FROM products WHERE company_id = %s AND cas_number = %s",
            (company_id, cas),
        )
        rows = cursor.fetchall() or []

    # 2. Name exact (case-insensitive) fallback.
    if not rows and name:
        cursor.execute(
            f"SELECT {_PRODUCT_COLS} FROM products WHERE company_id = %s AND lower(name) = lower(%s)",
            (company_id, name),
        )
        rows = cursor.fetchall() or []

    # 3. Partial name — present as candidates, NEVER auto-resolve (a wrong product
    #    is worse than asking one more question; identical discipline for spec+SDS).
    if not rows and name:
        cursor.execute(
            f"SELECT {_PRODUCT_COLS} FROM products WHERE company_id = %s AND name ILIKE %s LIMIT 8",
            (company_id, f"%{name}%"),
        )
        partial = cursor.fetchall() or []
        if not partial:
            return {
                "status": "not_found",
                "message": (
                    "No matching product in the catalog. Tell the visitor you don't "
                    "have it on file and offer to connect them to the team."
                ),
            }
        # A grade can still single out one of the partial candidates.
        if grade:
            narrowed = [r for r in partial if (r[2] or "").strip().lower() == grade.strip().lower()]
            if len(narrowed) == 1:
                return {"row": narrowed[0]}
        return {
            "status": "ambiguous",
            "candidates": [_candidate(r) for r in partial[:8]],
            "message": (
                "One or more products partially match. Ask the visitor to confirm "
                "the exact product (by grade or CAS number) before sharing anything."
            ),
        }

    if not rows:
        return {
            "status": "not_found",
            "message": (
                "No matching product in the catalog. Tell the visitor you don't have "
                "it on file and offer to connect them to the team."
            ),
        }

    # Multiple exact matches = several grades share a name/CAS. A supplied grade
    # picks the exact one; otherwise ask which grade.
    if len(rows) > 1:
        if grade:
            g = grade.strip().lower()
            narrowed = [r for r in rows if (r[2] or "").strip().lower() == g]
            if len(narrowed) == 1:
                return {"row": narrowed[0]}
            if len(narrowed) > 1:
                rows = narrowed  # same grade duplicated — still ambiguous below
            else:
                # Grade given but not stocked — name the grades that ARE available.
                available = [str(r[2]) for r in rows if r[2]]
                return {
                    "status": "ambiguous",
                    "candidates": [_candidate(r) for r in rows[:8]],
                    "message": (
                        f"No '{grade}' grade is on file for this product. Available "
                        f"grades: {', '.join(available)}. Ask the visitor to pick one."
                    ),
                }
        return {
            "status": "ambiguous",
            "candidates": [_candidate(r) for r in rows[:8]],
            "message": "Several grades match. Ask the visitor which grade they need.",
        }

    return {"row": rows[0]}


def get_sds(
    cursor,
    company_id,
    *,
    cas_number: Optional[str] = None,
    product_name: Optional[str] = None,
    grade: Optional[str] = None,
) -> Dict[str, Any]:
    """Look up a product's real SDS, scoped to ONE tenant. Pure data, no LLM.

    Resolution is delegated to ``_resolve_product`` (CAS exact -> name exact ->
    partial = confirm), with ``grade`` narrowing the common many-grades-per-name
    case to one sheet. Returns a status dict the model reads as its observation:
      found | no_sheet_on_file | ambiguous | not_found | missing_identifier

    SECURITY: resolution is tenant-scoped. A product with a missing/non-https
    ``sds_ref`` is reported as ``no_sheet_on_file`` (we have the product but no
    servable sheet) so the agent escalates instead of handing out a broken or
    insecure link.
    """
    resolved = _resolve_product(
        cursor, company_id, (cas_number or "").strip(), (product_name or "").strip(),
        (grade or "").strip(),
    )
    if "row" not in resolved:
        return resolved

    name_, cas_, grade_, packaging_, sds_ref_, updated_ = resolved["row"]

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
            "The visitor is automatically shown an 'Open SDS' button that links to "
            "this official sheet — do NOT paste the URL or a markdown link yourself. "
            "Just briefly confirm the safety sheet for this product is ready. Do not "
            "summarise or paraphrase hazard, handling, or storage details — the "
            "document is the source of truth."
        ),
    }


def get_product_spec(
    cursor,
    company_id,
    *,
    cas_number: Optional[str] = None,
    product_name: Optional[str] = None,
    grade: Optional[str] = None,
) -> Dict[str, Any]:
    """Look up a product's COMMERCIAL spec (grade, packaging), tenant-scoped.

    Read-only, no LLM. Resolution is the same shared ``_resolve_product`` path as
    ``get_sds`` (CAS exact -> name exact -> partial = confirm, ``grade`` narrows),
    so a fuzzy name never auto-serves the wrong product's spec. Statuses:
      found | ambiguous | not_found | missing_identifier

    This is COMMERCIAL data only — it never returns hazard/handling info and never
    returns the SDS URL itself (``sds_available`` is a boolean nudge so the agent
    can offer the sheet via ``get_sds``). The safety guardrail is preserved: the
    ``message`` tells the model to route any safety question to ``get_sds`` and to
    not infer hazards from grade or purity.
    """
    resolved = _resolve_product(
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
        return resolved

    name_, cas_, grade_, packaging_, sds_ref_, _updated_ = resolved["row"]

    return {
        "status": "found",
        "product": {
            "name": name_,
            "cas_number": cas_,
            "grade": grade_,
            "packaging": packaging_,
        },
        "pack_sizes": _split_packs(packaging_),
        "sds_available": _is_https(sds_ref_),
        "message": (
            "Share the commercial spec fields that are present; do not invent any "
            "field that is null. This is commercial information only — for ANY "
            "safety, hazard, handling, storage, or regulatory question call get_sds "
            "and answer only from that document. Never infer hazards from grade or "
            "purity. If sds_available is true, you may offer to fetch the SDS."
        ),
    }


# ── request_quote: the first transactional tool (Phase 4a, §10) ──────────────
#
# Pricing is a LOOKUP, not a formula: the real Expresolv catalog prices each SKU
# at the pack level (product × grade × pack size). The model collects which
# grade/pack/qty; this code reads the number. Larger bulk packs carry no list
# price by design ("POR" = Price On Request) → those route to a human, recorded
# for the owner. A (product, grade, pack) that maps to >1 *different* price (real
# data-entry dups exist) is treated as ambiguous and escalates — we never guess a
# price. Every query is tenant-scoped: pricing is commercially sensitive.

# product_skus columns, one fixed shape shared by the resolver below.
#   0 name  1 cas  2 grade  3 pack_size  4 pack_norm  5 pack_code
#   6 list_price  7 gst_rate  8 is_por  9 currency
_SKU_COLS = (
    "product_name, cas_number, grade, pack_size, pack_size_norm, pack_code, "
    "list_price, gst_rate, is_por, currency"
)


def _norm_pack(s: object) -> str:
    """Canonical pack-size key for exact, collision-free matching.

    Converts a size to a NUMERIC BASE UNIT so every spelling of the same size
    collapses to one key AND different sizes never collide:
      '5 Ltr' / '5L' / '5 litre' / '5000 ml'  -> '5000ml'
      '2.5 Ltr'                                -> '2500ml'
      '35 Kg' / '35000 g'                      -> '35000g'

    This replaces the old letter-form key ('5 l'), which was BOTH unreliable
    (stored pack_size_norm could be '5000 ml', never equal to '5 l') and unsafe
    for substring matching ('5 l' is a substring of '2.5 l', so a 5 Ltr query
    wrongly matched the 2.5 Ltr SKU and surfaced two prices as 'ambiguous').

    Unparseable input (no number+unit) falls back to whitespace-collapsed text so
    a non-standard pack still compares equal to an identical non-standard pack.
    """
    import re
    t = (s if isinstance(s, str) else "").lower().strip()
    # Last number+unit pair wins (handles '8 x 500 ml' -> the 500 ml size).
    matches = re.findall(
        r"(\d+(?:\.\d+)?)\s*"
        r"(kilograms?|kgs?|kg|grams?|gms?|gm|g|"
        r"millilitres?|milliliters?|ml|litres?|liters?|ltrs?|ltr|lit|l)\b",
        t,
    )
    if not matches:
        return re.sub(r"\s+", " ", t)
    num_str, unit = matches[-1]
    num = float(num_str)
    if unit in ("kg", "kgs", "kilogram", "kilograms"):
        base, u = num * 1000, "g"
    elif unit in ("g", "gm", "gms", "gram", "grams"):
        base, u = num, "g"
    elif unit in ("ml", "millilitre", "millilitres", "milliliter", "milliliters"):
        base, u = num, "ml"
    else:  # litre family → millilitres
        base, u = num * 1000, "ml"
    if base == int(base):
        base = int(base)
    return f"{base}{u}"


QTY_MAX = 10_000


def _classify_qty(v: object) -> tuple[int, bool]:
    """Classify a raw model/form quantity into ``(qty, needs_confirm)`` (Phase 1.4).

    - missing / blank            → ``(1, False)``  a single-pack default; safe to use
    - a clean count ``1..QTY_MAX`` → ``(n, False)`` (counts above the cap clamp to it)
    - anything else *present*    → ``(1, True)``   unparseable (``"10-20"``, ``"a few"``)
                                                    or ``≤0`` — never silently assume 1;
                                                    the caller confirms the count instead.
    """
    if v is None:
        return 1, False
    s = str(v).strip()
    if not s:
        return 1, False
    try:
        q = int(float(s))
    except (TypeError, ValueError):
        return 1, True
    if q <= 0:
        return 1, True
    return min(q, QTY_MAX), False


def _parse_qty(v: object) -> int:
    """Quantity = number of packs, clamped to ``1..QTY_MAX``. Missing/invalid/≤0
    degrades to 1, never an error — a quote/record should still render. Use
    :func:`_classify_qty` when you need to distinguish an unparseable input (to
    confirm it) from a legitimately-absent one (to default)."""
    qty, _ = _classify_qty(v)
    return qty


# A permissive shape check (not deliverability) — mirrors main._valid_reply_to so
# the POR contact gate and the owner-notification tier agree on what counts as an
# email. Phone alone is not enough to finalize a POR (Phase 3.3).
_EMAIL_SHAPE = re.compile(r"\A[^@\s]+@[^@\s]+\.[^@\s]+\Z")


def _looks_like_email(v: object) -> bool:
    return bool(v and _EMAIL_SHAPE.match(str(v).strip()))


def _quote_rows(cursor, company_id, cas: str, name: str) -> Dict[str, Any]:
    """Fetch the SKU rows for ONE product, or a terminal status.

    Unlike ``_resolve_product`` (which keys on CAS), pricing must resolve to a
    single *product* first — and CAS is NOT unique in this catalog (one CAS can be
    two different products, e.g. an acid and a rust-remover). So after any lookup
    we check: if the rows span >1 distinct product name, it's ``ambiguous`` and we
    ask the visitor to pick. Resolution order mirrors the other tools: CAS exact →
    name exact (ci) → partial (confirm, never auto-serve).
    """
    if not cas and not name:
        return {"status": "missing_identifier",
                "message": "Ask the visitor which product (name or CAS number)."}

    rows: List[Any] = []
    if cas:
        cursor.execute(
            f"SELECT {_SKU_COLS} FROM product_skus WHERE company_id = %s AND cas_number = %s",
            (company_id, cas),
        )
        rows = cursor.fetchall() or []
    if not rows and name:
        cursor.execute(
            f"SELECT {_SKU_COLS} FROM product_skus WHERE company_id = %s AND lower(product_name) = lower(%s)",
            (company_id, name),
        )
        rows = cursor.fetchall() or []
    if not rows and name:
        cursor.execute(
            f"SELECT {_SKU_COLS} FROM product_skus WHERE company_id = %s AND product_name ILIKE %s",
            (company_id, f"%{name}%"),
        )
        rows = cursor.fetchall() or []

    if not rows:
        return {"status": "not_found",
                "message": ("No matching product in the price list. Tell the visitor "
                            "you don't have it and offer to connect them to the team.")}

    distinct = sorted({r[0] for r in rows})
    if len(distinct) > 1:
        return {"status": "ambiguous", "candidates": distinct[:8],
                "message": "Several products match. Ask the visitor to pick the exact one."}
    return {"rows": rows}


def request_quote(
    cursor,
    company_id,
    *,
    product_name: Optional[str] = None,
    cas_number: Optional[str] = None,
    grade: Optional[str] = None,
    pack_size: Optional[str] = None,
    quantity: object = None,
    contact_name: Optional[str] = None,
    contact_email: Optional[str] = None,
    contact_phone: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Price a SKU deterministically, or route a Price-On-Request to a human.

    Collects product → grade → pack, then reads the list price (never computes it).
    Statuses the model reads as its observation:
      missing_identifier | not_found | ambiguous   (product step)
      needs_grade | needs_pack | not_found_sku      (narrowing step)
      ambiguous_price                               (dup rows, differing price → escalate)
      needs_contact                                 (POR with no way to reach the lead)
      price_on_request                              (POR → quote_requests record + handoff)
      quoted                                        (priced → quote_requests record)

    GST is shown as "extra as applicable" (pre-GST total quoted), per the owner's
    choice; the gst_rate is still snapshotted on the record. The priced/ POR record
    is the owner's lead — written tenant-scoped, committed here.
    """
    resolved = _quote_rows(
        cursor, company_id, (cas_number or "").strip(), (product_name or "").strip()
    )
    if "rows" not in resolved:
        return resolved
    rows = resolved["rows"]
    product = rows[0][0]

    # 1. Grade. Match case-insensitively (exact preferred, else substring).
    grade_in = (grade or "").strip()
    grades = sorted({(r[2] or "") for r in rows if r[2]})
    if not grade_in:
        grade_pack_map: Dict[str, list] = {}
        for g in grades[:20]:
            gps = sorted({r[3] or "" for r in rows if (r[2] or "") == g and r[3]})
            if gps:
                grade_pack_map[g] = gps
        return {"status": "needs_grade", "product": product, "grades": grades[:20],
                "grade_pack_map": grade_pack_map,
                "message": (f"Tell the visitor: {product} is available in these grades: "
                            f"{', '.join(grades[:20])}. Ask which grade they need.")}
    gmatch = [g for g in grades if g.lower() == grade_in.lower()] or \
             [g for g in grades if grade_in.lower() in g.lower()]
    if len(gmatch) != 1:
        return {"status": "needs_grade", "product": product, "grades": grades[:20],
                "message": (f"Couldn't match grade '{grade_in}'. Tell the visitor the available grades "
                            f"for {product}: {', '.join(grades[:20])}. Ask them to pick one.")}
    grade_sel = gmatch[0]
    grows = [r for r in rows if (r[2] or "") == grade_sel]

    # 2. Pack size. Tolerant normalised match.
    pack_in = (pack_size or "").strip()
    packs = sorted({(r[3] or "") for r in grows if r[3]})
    if not pack_in:
        return {"status": "needs_pack", "product": product, "grade": grade_sel,
                "pack_sizes": packs[:20],
                "message": (f"Tell the visitor: {product} ({grade_sel}) is available in these pack sizes: "
                            f"{', '.join(packs[:20])}. Ask which pack size they need.")}
    # Canonicalise BOTH sides from the human pack_size text (r[3]) — the stored
    # pack_size_norm (r[4]) is unreliable (uploads use different formats) and the
    # old substring fallback collided '5 Ltr' with '2.5 Ltr'. Exact canonical
    # match only: '5 Ltr' -> '5000ml' matches the 5 Ltr SKU and nothing else.
    pnorm = _norm_pack(pack_in)
    prows = [r for r in grows if r[3] and _norm_pack(r[3]) == pnorm]
    if not prows:
        return {"status": "not_found_sku", "product": product, "grade": grade_sel,
                "pack_sizes": packs[:20],
                "message": (f"No '{pack_in}' pack for {product} ({grade_sel}). Offer the "
                            "available pack sizes or connect them to the team.")}

    # 3. Resolve to one priced SKU. Dup rows for this exact pack must agree, or we
    #    escalate rather than pick arbitrarily by DB order (Phase 1.3). A row is POR
    #    when flagged, or its price is missing/zero (a 0 list price is never "free").
    #    Two kinds of conflict escalate to ambiguous_price:
    #      - rows disagree on POR-ness (some priced, some price-on-request), or
    #      - the priced rows disagree on the number.
    #    Only rows that agree on both are safe to quote / route.
    def _row_is_por(r) -> bool:
        return bool(r[8]) or r[6] is None or float(r[6]) == 0

    por_flags = {_row_is_por(r) for r in prows}
    priced_values = {float(r[6]) for r in prows if not _row_is_por(r)}
    if len(por_flags) > 1 or len(priced_values) > 1:
        return {"status": "ambiguous_price", "product": product, "grade": grade_sel,
                "message": ("Conflicting prices are on file for this exact pack — do NOT "
                            "quote a number. Tell the visitor you'll confirm with the team.")}
    sku = prows[0]
    pack_sel, pack_code = sku[3], sku[5]
    is_por = _row_is_por(sku)
    gst_rate = float(sku[7]) if sku[7] is not None else None
    currency = sku[9] or "INR"
    qty, qty_needs_confirm = _classify_qty(quantity)
    if qty_needs_confirm:
        # The buyer wrote a quantity we can't turn into a pack count ("10-20",
        # "a few", 0). Never quote or record a fabricated 1 — ask them to confirm.
        return {"status": "confirm_quantity", "product": product, "grade": grade_sel,
                "pack_size": pack_sel,
                "message": ("The quantity isn't clear. Ask the visitor how many packs "
                            "they need as a whole number before quoting — do NOT assume "
                            "a number or produce a quote yet.")}
    if is_por:
        # POR contact gate (Phase 3.3): finalize only with a valid EMAIL — that is
        # the channel the owner alert replies to, and every POR ping must carry a
        # reachable lead. A phone number alone is not enough. Solicit, don't block
        # the conversation: we return a directive to ask, not an error.
        if not _looks_like_email(contact_email):
            return {"status": "needs_contact", "product": product, "grade": grade_sel,
                    "pack_size": pack_sel,
                    "message": ("This pack is priced on request. Ask for the visitor's "
                                "name and email so the team can send a quote — an email "
                                "address is required (a phone number alone isn't enough).")}
        token = _insert_quote(cursor, company_id, product=product, cas=sku[1], grade=grade_sel,
                              pack_size=pack_sel, pack_code=pack_code, qty=qty, unit_price=None,
                              subtotal=None, gst_rate=gst_rate, currency=currency, is_por=True,
                              name=contact_name, email=contact_email, phone=contact_phone,
                              session_id=session_id)
        obs = {"status": "price_on_request", "product": product, "grade": grade_sel,
               "pack_size": pack_sel, "quantity": qty, "currency": currency,
               "message": ("Confirm you've logged the request and the team will send a "
                           "price shortly. Do NOT invent a number.")}
        if token:
            # Phase 4: a shareable, read-only quote page was minted. The widget shows
            # the link as a deterministic button; the model may mention it exists but
            # must NEVER fabricate or alter the URL.
            obs["quote_url"] = _public_quote_url(token)
            obs["message"] += (" A shareable quote link has been created and shown to "
                               "the visitor as a button — you may mention it, but never "
                               "type out or invent a link yourself.")
        return obs

    unit_price = float(sku[6])
    subtotal = round(unit_price * qty, 2)
    token = _insert_quote(cursor, company_id, product=product, cas=sku[1], grade=grade_sel,
                          pack_size=pack_sel, pack_code=pack_code, qty=qty, unit_price=unit_price,
                          subtotal=subtotal, gst_rate=gst_rate, currency=currency, is_por=False,
                          name=contact_name, email=contact_email, phone=contact_phone,
                          session_id=session_id)
    obs = {
        "status": "quoted", "product": product, "grade": grade_sel,
        "pack_size": pack_sel, "quantity": qty, "unit_price": unit_price,
        "subtotal": subtotal, "gst_rate": gst_rate, "currency": currency,
        "gst_note": "GST extra as applicable",
        "message": ("The visitor is shown a structured quote card with these figures — "
                    "state the pack, quantity and total briefly and note GST is extra as "
                    "applicable; the quote is subject to confirmation. Do NOT make up any "
                    "figure beyond what is given here."),
    }
    if token:
        # Phase 4: shareable read-only quote page. Widget renders the link button
        # deterministically; the model may mention it but must never fabricate a URL.
        obs["quote_url"] = _public_quote_url(token)
        obs["message"] += (" A shareable quote link has been created and shown to the "
                           "visitor as a button — you may mention it, but never type out "
                           "or invent a link yourself.")
    return obs


# Base URL of the public site that serves /q/<token>. Read from the same env the
# backend uses elsewhere (main._super_admin email builder) so links point at the
# real deployment; the www default matches production.
_QUOTE_LINK_BASE = os.getenv("APP_BASE_URL", "https://www.sapybase.com").rstrip("/")

# Validity horizon for a shareable quote link (Phase 4). Kept as a plain constant
# (not env-configurable) — the SQL sets expires_at = created_at + this interval.
QUOTE_LINK_TTL_DAYS = 30

# Repeat-ask dedup window (cost-control follow-up to Phase 4): a visitor asking
# for the SAME product/grade/pack/quantity again within this window reuses the
# earlier row's public_token instead of minting a new one and inserting a new
# quote_requests record. Mirrors the 10-min sample-request dedup (Phase 2.2).
QUOTE_DEDUP_WINDOW_MINUTES = 10


def _public_quote_url(token: str) -> str:
    """Absolute URL of the branded, read-only quote page for a minted token."""
    return f"{_QUOTE_LINK_BASE}/q/{token}"


def _insert_quote(cursor, company_id, *, product, cas, grade, pack_size, pack_code,
                  qty, unit_price, subtotal, gst_rate, currency, is_por,
                  name, email, phone, session_id) -> Optional[str]:
    """Persist the quote/POR as the owner's lead record, tenant-scoped, committed.

    Returns the minted ``public_token`` (Phase 4 shareable link) on success, or
    ``None`` if the insert failed. Failure must never break the conversation: a
    logged insert error degrades to a still-valid quote on screen (the record is
    the owner's nicety, not the visitor's answer) — the caller simply omits the
    share link when there is no token.

    Dedup: a repeat ask for the exact same (session, product, grade, pack,
    quantity, POR-ness) within ``QUOTE_DEDUP_WINDOW_MINUTES`` reuses the earlier
    row's token instead of minting a new one — stops a spammed/re-asked price
    from growing quote_requests or the token count unboundedly. Scoped to a
    session (never bare company_id) so it can't merge two different visitors'
    asks; skipped entirely when session_id is absent (can't safely scope it)."""
    if session_id:
        try:
            cursor.execute(
                """
                SELECT public_token FROM quote_requests
                WHERE company_id = %s AND session_id = %s AND product_name = %s
                  AND grade = %s AND pack_size = %s AND quantity = %s AND is_por = %s
                  AND public_token IS NOT NULL
                  AND created_at > NOW() - (%s || ' minutes')::interval
                ORDER BY created_at DESC LIMIT 1
                """,
                (company_id, session_id, product, grade, pack_size, qty, is_por,
                 str(QUOTE_DEDUP_WINDOW_MINUTES)),
            )
            existing = cursor.fetchone()
            if existing and existing[0]:
                return existing[0]
        except Exception:
            logger.exception("request_quote: dedup lookup failed, proceeding to insert")
    token = secrets.token_urlsafe(16)
    try:
        cursor.execute(
            """
            INSERT INTO quote_requests
                (company_id, session_id, product_name, cas_number, grade, pack_size,
                 pack_code, quantity, unit_price, subtotal, gst_rate, currency, is_por,
                 contact_name, contact_email, contact_phone, status,
                 public_token, expires_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'new',
                    %s, NOW() + (%s || ' days')::interval)
            """,
            (company_id, session_id, product, cas, grade, pack_size, pack_code, qty,
             unit_price, subtotal, gst_rate, currency, is_por,
             (name or None), (email or None), (phone or None),
             token, str(QUOTE_LINK_TTL_DAYS)),
        )
        conn = getattr(cursor, "connection", None)
        if conn is not None:
            conn.commit()
        return token
    except Exception:
        logger.exception("request_quote: failed to persist quote_requests record")
        return None


# ── request_sample: opens the structured sample FORM (Phase 4b, §10) ──────────
#
# A sample request is a structured intake (product, grade, quantity, contact,
# shipping, …), so collection is a FORM, not conversational slot-filling. When the
# visitor asks for a sample the agent calls this tool, which simply tells the
# widget to open the sample form (optionally prefilled with the product/grade the
# visitor named). The deterministic record-and-route + spreadsheet push happen when
# the FORM is submitted (main.submit_sample_request), never from the model. This
# keeps the sample flow LLM-free, so it can't loop on disambiguation or time out.


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

    Returns a single ``open_form`` status; ``main`` turns it into a {form} action
    the widget renders. Any product/grade the model parsed from the message is
    passed back as a prefill hint so the form opens with those fields filled in.
    Extra kwargs are ignored so the model can't drive collection through the tool
    (``cursor`` is unused; the signature stays uniform with the other tools)."""
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


def _insert_agent_request(cursor, company_id, *, kind, product, cas, grade,
                          pack_size, qty, note, name, email, phone,
                          session_id, form_data=None) -> bool:
    """Persist a record-and-route request as the owner's lead, tenant-scoped, committed.

    Used by the form-submit endpoint (the typed columns power the dashboard panel;
    ``form_data`` JSONB carries the FULL customizable submission so the spreadsheet
    columns can match the client's form exactly). Mirrors ``_insert_quote``: a
    logged insert error degrades gracefully — capturing the lead must never break
    the request. Never raises; returns ``True`` if the row was persisted, ``False``
    if the insert failed (so the caller can decide whether the lead was actually
    captured before telling the visitor "we've got it")."""
    try:
        cursor.execute(
            """
            INSERT INTO agent_requests
                (company_id, session_id, kind, product_name, cas_number, grade,
                 pack_size, quantity, contact_name, contact_email, contact_phone,
                 note, form_data, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,'new')
            """,
            (company_id, session_id, kind, product, cas, grade, pack_size, qty,
             (name or None), (email or None), (phone or None), note,
             json.dumps(form_data) if form_data else None),
        )
        conn = getattr(cursor, "connection", None)
        if conn is not None:
            conn.commit()
        return True
    except Exception:
        logger.exception("request_sample: failed to persist agent_requests record")
        return False


def execute_tool(name: str, args: Dict[str, Any], cursor, company_id,
                 session_id: Optional[str] = None) -> Dict[str, Any]:
    """Dispatch a model-requested tool to its deterministic implementation.

    An unknown tool name (a hallucinated tool, or one not wired yet) returns a
    benign error observation rather than raising — the model recovers and answers
    normally or escalates.

    ``session_id`` ties side-effecting tools (``request_quote``) to the visitor's
    conversation so ``quote_requests.session_id`` is populated for funnel/BI joins
    (Phase 1.2); it is threaded through from the chat handler.
    """
    if name == "get_sds":
        return get_sds(
            cursor,
            company_id,
            cas_number=args.get("cas_number"),
            product_name=args.get("product_name"),
            grade=args.get("grade"),
        )
    if name == "get_product_spec":
        return get_product_spec(
            cursor,
            company_id,
            cas_number=args.get("cas_number"),
            product_name=args.get("product_name"),
            grade=args.get("grade"),
        )
    if name == "request_quote":
        return request_quote(
            cursor,
            company_id,
            product_name=args.get("product_name"),
            cas_number=args.get("cas_number"),
            grade=args.get("grade"),
            pack_size=args.get("pack_size"),
            quantity=args.get("quantity"),
            contact_name=args.get("contact_name"),
            contact_email=args.get("contact_email"),
            contact_phone=args.get("contact_phone"),
            session_id=session_id,
        )
    if name == "request_sample":
        return request_sample(
            cursor,
            company_id,
            product_name=args.get("product_name"),
            cas_number=args.get("cas_number"),
            grade=args.get("grade"),
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
        "For a product's COMMERCIAL spec (grade, purity, packaging, available "
        "sizes) call get_product_spec — including when the visitor asks which "
        "grades or pack sizes are available. Do NOT answer grade/pack availability "
        "from your own memory or the knowledge base; route it through the tool so "
        "the widget can show selectable grade/pack chips. That tool returns "
        "commercial data only — never treat its grade or purity as a basis to "
        "infer hazards or handling. After sharing the spec, proactively offer to "
        "prepare a price quote (request_quote) — do not wait to be asked. Any "
        "safety-class question still goes to get_sds, even mid-conversation.\n\n"
        "For a PRICE or quotation call request_quote IMMEDIATELY when the visitor "
        "mentions a product and price — do NOT ask for grade or pack size yourself "
        "before calling the tool. Pass whatever the visitor already gave (product, "
        "grade, pack size) in ONE call; the tool tells you step-by-step what is "
        "still missing and the widget handles the selection UI. NEVER state, compute, "
        "estimate, or round a price yourself — quote ONLY the figures request_quote "
        "returns. If it returns needs_contact (price-on-request only), THEN ask for "
        "name and email. If ambiguous_price, say you'll confirm with the team. "
        "Pricing is not safety: a hazard question still goes to get_sds. BEFORE "
        "calling request_quote, check the conversation for a `[State: ... quoted "
        "at ...]` or `[State: ... price on request ...]` note for the EXACT same "
        "product, grade, pack size, AND quantity — if one exists, just restate that "
        "same figure; do NOT call request_quote again for an unchanged repeat ask. "
        "Call it again if the product, grade, pack size, or quantity differs at "
        "all, or the visitor explicitly asks you to recheck/update the price.\n\n"
        "When the visitor wants a free SAMPLE of a product, call request_sample. It "
        "opens a short sample request FORM for them to fill in — do NOT collect the "
        "product, grade, contact, or address yourself. If you know the product (and "
        "grade) they mentioned, pass them so the form opens prefilled. After "
        "calling it, just tell them to complete the form; never quote a price (use "
        "request_quote), never give safety info (use get_sds), and never promise a "
        "delivery date or quantity limit.\n\n"
        "GRADE DISAMBIGUATION: many products share one name/CAS across several "
        "grades (e.g. LR, AR, HPLC), each with its OWN sheet. When a tool returns "
        "ambiguous, ask which grade — then call the tool AGAIN passing that grade "
        "in the grade argument. Once the visitor names a grade (e.g. 'AR'), you "
        "MUST re-call the tool with grade set; do not re-ask the same question. If "
        "the visitor wants several grades ('both', 'AR and LR', 'all of them'), "
        "call the tool ONCE PER GRADE and present each result.\n\n"
        "If a tool returns no servable result (statuses not_found or "
        "no_sheet_on_file), tell the visitor you don't have it on file and offer "
        "to connect them to the team. If it is ambiguous, ask the visitor to "
        "confirm the exact product (by grade or CAS number). Never guess, and NEVER "
        "fall back to a generic 'I don't have specific information about that' "
        "reply for a product/SDS/price request — drive it through the tools or "
        "offer the team handoff."
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


def _accumulate_usage(usage_out: Optional[Dict[str, int]], response) -> None:
    """Fold one model response's token usage into ``usage_out`` (Phase 6 metering).

    LangChain surfaces per-call counts on ``AIMessage.usage_metadata`` as
    ``{input_tokens, output_tokens, total_tokens}``. We SUM across the agent's
    tool-loop rounds so the caller sees the whole turn's cost. Best-effort: a model
    that doesn't report usage (or a malformed blob) simply contributes nothing —
    metering must never affect the answer or raise.

    Phase 6 Slice B: also captures ``cached_tokens`` — the ``cache_read`` count
    LangChain nests under ``usage_metadata["input_token_details"]``. This is how
    Gemini reports an IMPLICIT context-cache hit (automatic on 2.x models, no
    ``cached_content`` wiring needed on our side); explicit caching turned out
    to require a 32,768-token static prefix we don't have, so this is the only
    caching signal currently reachable — surfaced purely for visibility.
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
    """Best-effort read of Gemini's per-call finish reason (STOP/MAX_TOKENS/...).

    Surfaced so a fallback caused by hitting the token cap mid-thought is
    distinguishable in logs from a real API error or an exhausted round budget —
    previously all three looked identical.
    """
    try:
        return (getattr(response, "response_metadata", None) or {}).get("finish_reason")
    except Exception:
        return None


# Friendly, visitor-safe phrases for the streaming status ticker (Phase 1). The
# widget shows these while a tool round runs; raw tool identifiers are never sent.
_TOOL_STATUS_PHRASES = {
    "get_sds": "Looking up the safety data sheet…",
    "request_quote": "Checking pricing…",
    "request_sample": "Preparing the sample request…",
    "get_product_spec": "Finding the product…",
}


def _tool_status_phrase(tool_name: Optional[str]) -> str:
    """Map a tool name to a visitor-safe status phrase (generic for unknown tools)."""
    return _TOOL_STATUS_PHRASES.get(tool_name or "", "Working on it…")


async def stream_agent_loop(
    model,
    messages: List[Any],
    tool_executor: Callable[[str, Dict[str, Any]], Dict[str, Any]],
    *,
    max_rounds: int = MAX_TOOL_ROUNDS,
    max_calls_per_round: int = MAX_CALLS_PER_ROUND,
    usage_out: Optional[Dict[str, int]] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """Async-generator form of :func:`run_agent_loop` (Phase 1 streaming).

    Yields progress events so the SSE layer can show motion during the blocking
    tool rounds instead of a dead spinner:
      * ``{"type": "status", "tool": <name>, "label": <friendly phrase>}`` — emitted
        just before each tool call executes.
      * ``{"type": "final", "text": <answer>}`` — emitted exactly once at the end,
        carrying the settled answer (or ``AGENT_FALLBACK_TEXT``).

    Round budget, empty-response retry, MAX_TOKENS logging and ``usage_out`` metering
    are byte-for-byte identical to the old ``run_agent_loop`` (now a thin drain of
    this generator). The final answer is still produced by a blocking ``ainvoke`` —
    token-level streaming of the compose is a later slice, since it entangles with
    the empty-retry guard that fixed the truncation bug.
    """
    convo = list(messages)
    for _round in range(max_rounds):
        try:
            response = await model.ainvoke(convo)
        except Exception:
            logger.exception("agent loop: model.ainvoke failed")
            yield {"type": "final", "text": AGENT_FALLBACK_TEXT}
            return

        _accumulate_usage(usage_out, response)
        finish_reason = _finish_reason(response)
        if finish_reason == "MAX_TOKENS":
            logger.warning("agent loop: round %d hit MAX_TOKENS", _round)

        tool_calls = getattr(response, "tool_calls", None) or []
        if not tool_calls:
            text = _content_to_text(getattr(response, "content", ""))
            if text:
                yield {"type": "final", "text": text}
                return
            # Empty content + no tool call is usually a one-off token-budget roll
            # (thinking consumed the round) rather than a real failure — screenshot
            # evidence showed the very next turn often succeeds unprompted. Retry
            # once before giving up on the whole turn.
            logger.warning(
                "agent loop: empty response (finish_reason=%s), retrying once", finish_reason
            )
            try:
                retry_response = await model.ainvoke(convo)
            except Exception:
                logger.exception("agent loop: retry model.ainvoke failed")
                yield {"type": "final", "text": AGENT_FALLBACK_TEXT}
                return
            _accumulate_usage(usage_out, retry_response)
            retry_finish_reason = _finish_reason(retry_response)
            if retry_finish_reason == "MAX_TOKENS":
                logger.warning("agent loop: retry hit MAX_TOKENS")
            retry_tool_calls = getattr(retry_response, "tool_calls", None) or []
            if retry_tool_calls:
                response, tool_calls = retry_response, retry_tool_calls
            else:
                yield {
                    "type": "final",
                    "text": _content_to_text(getattr(retry_response, "content", ""))
                    or AGENT_FALLBACK_TEXT,
                }
                return

        # Reason produced tool calls → Act + Observe, then loop to let the model
        # read the results and (usually) answer on the next round.
        convo.append(response)
        for call in tool_calls[:max_calls_per_round]:
            yield {
                "type": "status",
                "tool": call.get("name"),
                "label": _tool_status_phrase(call.get("name")),
            }
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
    yield {"type": "final", "text": AGENT_FALLBACK_TEXT}


async def run_agent_loop(
    model,
    messages: List[Any],
    tool_executor: Callable[[str, Dict[str, Any]], Dict[str, Any]],
    *,
    max_rounds: int = MAX_TOOL_ROUNDS,
    max_calls_per_round: int = MAX_CALLS_PER_ROUND,
    usage_out: Optional[Dict[str, int]] = None,
) -> str:
    """Run Reason → Act → Observe until the model returns text, bounded.

    Thin drain of :func:`stream_agent_loop`: returns only the final answer text and
    discards the progress events, preserving the exact prior contract (including the
    ``AGENT_FALLBACK_TEXT`` degrade path and ``usage_out`` metering) for callers that
    do not stream.
    """
    final_text = AGENT_FALLBACK_TEXT
    async for event in stream_agent_loop(
        model, messages, tool_executor,
        max_rounds=max_rounds, max_calls_per_round=max_calls_per_round,
        usage_out=usage_out,
    ):
        if event.get("type") == "final":
            final_text = event.get("text") or AGENT_FALLBACK_TEXT
    return final_text
