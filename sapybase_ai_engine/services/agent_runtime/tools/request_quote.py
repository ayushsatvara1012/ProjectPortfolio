"""``request_quote`` - price a SKU deterministically, or log a price-on-request.

Pricing is a LOOKUP, not a formula: the real catalog prices each SKU at the pack
level (product x grade x pack size). The model collects which grade/pack/qty; this
code reads the number. Larger bulk packs carry no list price by design ("POR" =
Price On Request) -> those route to a human, recorded for the owner. A (product,
grade, pack) that maps to >1 *different* price (real data-entry dups exist) is
treated as ambiguous and escalates - we never guess a price. Every query is
tenant-scoped: pricing is commercially sensitive.

Every priced/POR quote is also a warm lead, so the capture emits the owner handoff
alongside the visitor's quote card. The model is told to describe these figures,
never to re-derive them.
"""
from __future__ import annotations

import logging
import os
import re
import secrets
from typing import Any, Dict, List, Optional

from ..contact import captured_contact_echo
from ..registry import RuntimeTool, ToolContext, register
from .records import classify_qty

logger = logging.getLogger(__name__)

# product_skus columns, one fixed shape shared by the resolver below.
#   0 name  1 cas  2 grade  3 pack_size  4 pack_norm  5 pack_code
#   6 list_price  7 gst_rate  8 is_por  9 currency
_SKU_COLS = (
    "product_name, cas_number, grade, pack_size, pack_size_norm, pack_code, "
    "list_price, gst_rate, is_por, currency"
)

# Base URL of the public site that serves /q/<token>. Read from the same env the
# backend uses elsewhere so links point at the real deployment; the www default
# matches production.
_QUOTE_LINK_BASE = os.getenv("APP_BASE_URL", "https://www.sapybase.com").rstrip("/")

# Validity horizon for a shareable quote link. Kept as a plain constant (not
# env-configurable) — the SQL sets expires_at = created_at + this interval.
QUOTE_LINK_TTL_DAYS = 30

# Repeat-ask dedup window: a visitor asking for the SAME product/grade/pack/quantity
# again within this window reuses the earlier row's public_token instead of minting a
# new one and inserting a new quote_requests record. Mirrors the 10-min sample-request
# dedup (Phase 2.2).
QUOTE_DEDUP_WINDOW_MINUTES = 10

# A permissive shape check (not deliverability) — mirrors contact.valid_reply_to so
# the POR contact gate and the owner-notification tier agree on what counts as an
# email. Phone alone is not enough to finalize a POR (Phase 3.3).
_EMAIL_SHAPE = re.compile(r"\A[^@\s]+@[^@\s]+\.[^@\s]+\Z")


def _looks_like_email(v: object) -> bool:
    return bool(v and _EMAIL_SHAPE.match(str(v).strip()))


def _pack_magnitude(s: object) -> Optional[tuple]:
    """``(numeric value, base unit)`` for a pack-size string, or ``None`` if
    unparseable — e.g. ``'2.5 Ltr'`` -> ``(2500.0, 'ml')``.

    A standalone parser, NOT a refactor of ``_norm_pack`` below: that function
    resolves which SKU a visitor's pack matches and is frozen by the
    agent-conversation-gaps plan §2 (pricing/POR gating must stay byte-for-byte).
    This exists only to compare magnitude for the not_found_sku bulk-routing hint
    (plan §4.3) — same number+unit grammar, duplicated on purpose to keep the
    two call sites independently safe to change.
    """
    t = (s if isinstance(s, str) else "").lower().strip()
    matches = re.findall(
        r"(\d+(?:\.\d+)?)\s*"
        r"(kilograms?|kgs?|kg|grams?|gms?|gm|g|"
        r"millilitres?|milliliters?|ml|litres?|liters?|ltrs?|ltr|lit|l)\b",
        t,
    )
    if not matches:
        return None
    num_str, unit = matches[-1]
    num = float(num_str)
    if unit in ("kg", "kgs", "kilogram", "kilograms"):
        return num * 1000, "g"
    if unit in ("g", "gm", "gms", "gram", "grams"):
        return num, "g"
    if unit in ("ml", "millilitre", "millilitres", "milliliter", "milliliters"):
        return num, "ml"
    return num * 1000, "ml"


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


def _quote_rows(cursor, company_id, cas: str, name: str) -> Dict[str, Any]:
    """Fetch the SKU rows for ONE product, or a terminal status.

    Unlike ``resolve_product`` (which keys on CAS), pricing must resolve to a
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


def public_quote_url(token: str) -> str:
    """Absolute URL of the branded, read-only quote page for a minted token."""
    return f"{_QUOTE_LINK_BASE}/q/{token}"


def insert_quote(cursor, company_id, *, product, cas, grade, pack_size, pack_code,
                 qty, unit_price, subtotal, gst_rate, currency, is_por,
                 name, email, phone, session_id) -> Optional[str]:
    """Persist the quote/POR as the owner's lead record, tenant-scoped, committed.

    Returns the minted ``public_token`` (shareable link) on success, or ``None`` if
    the insert failed. Failure must never break the conversation: a logged insert
    error degrades to a still-valid quote on screen (the record is the owner's
    nicety, not the visitor's answer) — the caller simply omits the share link when
    there is no token.

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
    choice; the gst_rate is still snapshotted on the record. The priced/POR record
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
        # Symptom 5 (plan §4.3): "not in the price list" is not "does not exist" —
        # neither branch below touches price/POR gating, only the message and a
        # routing hint. A requested pack strictly larger (same unit family) than
        # every listed pack for this grade is a bulk enquiry, not a dead end.
        req_mag = _pack_magnitude(pack_in)
        listed_mags = [_pack_magnitude(p) for p in packs]
        is_bulk = bool(listed_mags) and req_mag is not None and all(
            m is not None and m[1] == req_mag[1] and m[0] < req_mag[0] for m in listed_mags
        )
        if is_bulk:
            message = (
                f"'{pack_in}' is larger than every pack we price online for "
                f"{product} ({grade_sel}) — that's a bulk enquiry, not a pack that "
                "doesn't exist. Do NOT offer only the smaller listed packs; tell "
                "the visitor you'll route this to the team for a bulk quote and "
                "offer to take their contact details."
            )
        else:
            message = (
                f"'{pack_in}' is not in the price list for {product} ({grade_sel}) "
                "— that does not mean it doesn't exist. Offer the available pack "
                f"sizes ({', '.join(packs[:20])}) or connect the visitor with the team."
            )
        return {"status": "not_found_sku", "product": product, "grade": grade_sel,
                "pack_sizes": packs[:20], "message": message}

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
    qty, qty_needs_confirm = classify_qty(quantity)
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
        token = insert_quote(cursor, company_id, product=product, cas=sku[1], grade=grade_sel,
                             pack_size=pack_sel, pack_code=pack_code, qty=qty, unit_price=None,
                             subtotal=None, gst_rate=gst_rate, currency=currency, is_por=True,
                             name=contact_name, email=contact_email, phone=contact_phone,
                             session_id=session_id)
        obs = {"status": "price_on_request", "product": product, "grade": grade_sel,
               "pack_size": pack_sel, "quantity": qty, "currency": currency,
               "message": ("Confirm you've logged the request and the team will send a "
                           "price shortly. Do NOT invent a number.")}
        if token:
            # A shareable, read-only quote page was minted. The widget shows the link
            # as a deterministic button; the model may mention it exists but must
            # NEVER fabricate or alter the URL.
            obs["quote_url"] = public_quote_url(token)
            obs["message"] += (" A shareable quote link has been created and shown to "
                               "the visitor as a button — you may mention it, but never "
                               "type out or invent a link yourself.")
        return obs

    unit_price = float(sku[6])
    subtotal = round(unit_price * qty, 2)
    token = insert_quote(cursor, company_id, product=product, cas=sku[1], grade=grade_sel,
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
        obs["quote_url"] = public_quote_url(token)
        obs["message"] += (" A shareable quote link has been created and shown to the "
                           "visitor as a button — you may mention it, but never type out "
                           "or invent a link yourself.")
    return obs


def _execute(ctx: ToolContext, args: dict) -> dict:
    return request_quote(
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
