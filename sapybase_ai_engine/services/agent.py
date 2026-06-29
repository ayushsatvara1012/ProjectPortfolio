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
    """Loose pack-size key for tolerant matching (mirrors the ingest normaliser):
    '2.5 Litre' / '2.5 ltr' / '2.5L' all collapse to the same key as '2.5 Ltr'."""
    import re
    t = (s if isinstance(s, str) else "").lower().strip().rstrip(".")
    t = t.replace("litres", "l").replace("liters", "l").replace("litre", "l")
    t = t.replace("liter", "l").replace("ltr", "l").replace("lit", "l")
    t = t.replace("millilitre", "ml").replace("milliliter", "ml")
    t = t.replace("gram", "g").replace("gms", "g").replace("gm", "g")
    t = t.replace("kilogram", "kg").replace("kgs", "kg")
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _parse_qty(v: object) -> int:
    """Quantity = number of packs. Missing/invalid/≤0 degrades to 1 (the agent is
    told to confirm the count), never an error — a quote should still render."""
    try:
        q = int(float(str(v).strip()))
        return q if q > 0 else 1
    except (TypeError, ValueError):
        return 1


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
        return {"status": "needs_grade", "product": product, "grades": grades[:20],
                "message": f"Ask which grade of {product} they need."}
    gmatch = [g for g in grades if g.lower() == grade_in.lower()] or \
             [g for g in grades if grade_in.lower() in g.lower()]
    if len(gmatch) != 1:
        return {"status": "needs_grade", "product": product, "grades": grades[:20],
                "message": (f"Couldn't match grade '{grade_in}'. Ask the visitor to pick "
                            f"one of the available grades for {product}.")}
    grade_sel = gmatch[0]
    grows = [r for r in rows if (r[2] or "") == grade_sel]

    # 2. Pack size. Tolerant normalised match.
    pack_in = (pack_size or "").strip()
    packs = sorted({(r[3] or "") for r in grows if r[3]})
    if not pack_in:
        return {"status": "needs_pack", "product": product, "grade": grade_sel,
                "pack_sizes": packs[:20],
                "message": f"Ask which pack size of {product} ({grade_sel}) they need."}
    pnorm = _norm_pack(pack_in)
    prows = [r for r in grows if (r[4] or _norm_pack(r[3])) == pnorm]
    if not prows:
        prows = [r for r in grows if pnorm and pnorm in _norm_pack(r[3])]
    if not prows:
        return {"status": "not_found_sku", "product": product, "grade": grade_sel,
                "pack_sizes": packs[:20],
                "message": (f"No '{pack_in}' pack for {product} ({grade_sel}). Offer the "
                            "available pack sizes or connect them to the team.")}

    # 3. Resolve to one priced SKU. Dup rows with DIFFERENT prices = ambiguous data
    #    → escalate, never pick. POR (or NULL/0 price) = route-to-human.
    priced = {(r[6] is None or bool(r[8]), None if r[6] is None else float(r[6])) for r in prows}
    if len({p for _, p in priced if p is not None}) > 1:
        return {"status": "ambiguous_price", "product": product, "grade": grade_sel,
                "message": ("More than one price is on file for this exact pack — do NOT "
                            "quote a number. Tell the visitor you'll confirm with the team.")}
    sku = prows[0]
    pack_sel, pack_code = sku[3], sku[5]
    # POR if flagged, or the price is missing/zero (a 0 list price is never "free").
    is_por = bool(sku[8]) or sku[6] is None or float(sku[6]) == 0
    gst_rate = float(sku[7]) if sku[7] is not None else None
    currency = sku[9] or "INR"
    qty = _parse_qty(quantity)
    has_contact = any([(contact_email or "").strip(), (contact_phone or "").strip()])

    if is_por:
        if not has_contact:
            return {"status": "needs_contact", "product": product, "grade": grade_sel,
                    "pack_size": pack_sel,
                    "message": ("This pack is priced on request. Ask for the visitor's "
                                "name and email (or phone) so the team can send a quote.")}
        _insert_quote(cursor, company_id, product=product, cas=sku[1], grade=grade_sel,
                      pack_size=pack_sel, pack_code=pack_code, qty=qty, unit_price=None,
                      subtotal=None, gst_rate=gst_rate, currency=currency, is_por=True,
                      name=contact_name, email=contact_email, phone=contact_phone,
                      session_id=session_id)
        return {"status": "price_on_request", "product": product, "grade": grade_sel,
                "pack_size": pack_sel, "quantity": qty, "currency": currency,
                "message": ("Confirm you've logged the request and the team will send a "
                            "price shortly. Do NOT invent a number.")}

    unit_price = float(sku[6])
    subtotal = round(unit_price * qty, 2)
    _insert_quote(cursor, company_id, product=product, cas=sku[1], grade=grade_sel,
                  pack_size=pack_sel, pack_code=pack_code, qty=qty, unit_price=unit_price,
                  subtotal=subtotal, gst_rate=gst_rate, currency=currency, is_por=False,
                  name=contact_name, email=contact_email, phone=contact_phone,
                  session_id=session_id)
    return {
        "status": "quoted", "product": product, "grade": grade_sel,
        "pack_size": pack_sel, "quantity": qty, "unit_price": unit_price,
        "subtotal": subtotal, "gst_rate": gst_rate, "currency": currency,
        "gst_note": "GST extra as applicable",
        "message": ("The visitor is shown a structured quote card with these figures — "
                    "state the pack, quantity and total briefly and note GST is extra as "
                    "applicable; the quote is subject to confirmation. Do NOT make up any "
                    "figure beyond what is given here."),
    }


def _insert_quote(cursor, company_id, *, product, cas, grade, pack_size, pack_code,
                  qty, unit_price, subtotal, gst_rate, currency, is_por,
                  name, email, phone, session_id) -> None:
    """Persist the quote/POR as the owner's lead record, tenant-scoped, committed.

    Failure must never break the conversation: a logged insert error degrades to a
    still-valid quote on screen (the record is the owner's nicety, not the visitor's
    answer)."""
    try:
        cursor.execute(
            """
            INSERT INTO quote_requests
                (company_id, session_id, product_name, cas_number, grade, pack_size,
                 pack_code, quantity, unit_price, subtotal, gst_rate, currency, is_por,
                 contact_name, contact_email, contact_phone, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'new')
            """,
            (company_id, session_id, product, cas, grade, pack_size, pack_code, qty,
             unit_price, subtotal, gst_rate, currency, is_por,
             (name or None), (email or None), (phone or None)),
        )
        conn = getattr(cursor, "connection", None)
        if conn is not None:
            conn.commit()
    except Exception:
        logger.exception("request_quote: failed to persist quote_requests record")


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
                          session_id, form_data=None) -> None:
    """Persist a record-and-route request as the owner's lead, tenant-scoped, committed.

    Used by the form-submit endpoint (the typed columns power the dashboard panel;
    ``form_data`` JSONB carries the FULL customizable submission so the spreadsheet
    columns can match the client's form exactly). Mirrors ``_insert_quote``: a
    logged insert error degrades gracefully — capturing the lead must never break
    the request. Returns nothing; raises nothing."""
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
    except Exception:
        logger.exception("request_sample: failed to persist agent_requests record")


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
        "sizes) call get_product_spec. That tool returns commercial data only — "
        "never treat its grade or purity as a basis to infer hazards or handling. "
        "Any safety-class question still goes to get_sds, even mid-conversation.\n\n"
        "For a PRICE or quotation call request_quote. Pass ALL info the visitor "
        "already gave (product, grade, pack size) in ONE call — do NOT pre-ask for "
        "contact details or anything the tool hasn't requested yet. The tool itself "
        "tells you what is missing; relay that to the visitor. NEVER state, compute, "
        "estimate, or round a price yourself — quote ONLY the figures request_quote "
        "returns. If it returns needs_contact (price-on-request only), THEN ask for "
        "name and email. If ambiguous_price, say you'll confirm with the team. "
        "Pricing is not safety: a hazard question still goes to get_sds.\n\n"
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
