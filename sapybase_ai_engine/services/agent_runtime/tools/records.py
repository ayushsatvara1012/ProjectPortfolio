"""Owner-lead writes shared by the tools and the form-submit endpoints.

``agent_requests`` is the generic capture table - a sample form submission, an
opportunistically-extracted contact, a COA dead end. It is written from a tool, from
``main``'s form endpoints, and from the contact-capture path, so it lives beside the
tools rather than inside any one of them.
"""
from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)


def insert_agent_request(cursor, company_id, *, kind, product, cas, grade,
                         pack_size, qty, note, name, email, phone,
                         session_id, form_data=None) -> bool:
    """Persist a record-and-route request as the owner's lead, tenant-scoped, committed.

    Used by the form-submit endpoint (the typed columns power the dashboard panel;
    ``form_data`` JSONB carries the FULL customizable submission so the spreadsheet
    columns can match the client's form exactly). Mirrors ``insert_quote``: a
    logged insert error degrades gracefully - capturing the lead must never break
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


def session_has_capture(cursor, company_id, session_id) -> bool:
    """True if this session already has an ``agent_requests`` or
    ``quote_requests`` row (Slice A, agent-conversation-gaps plan §3.3).

    Gates opportunistic contact capture so a session that already reached the
    owner via a quote or sample doesn't also fire a duplicate 'contact' ping.
    Tenant-scoped. Degrades to ``False`` (never suppress a real capture) on a
    missing session_id or a DB error - a duplicate ping costs the owner one
    extra notification; a wrongly-suppressed one loses a lead, which is the
    exact failure this plan repairs."""
    if not session_id:
        return False
    try:
        cursor.execute(
            "SELECT 1 FROM agent_requests WHERE company_id = %s AND session_id = %s LIMIT 1",
            (company_id, session_id),
        )
        if cursor.fetchone():
            return True
        cursor.execute(
            "SELECT 1 FROM quote_requests WHERE company_id = %s AND session_id = %s LIMIT 1",
            (company_id, session_id),
        )
        return cursor.fetchone() is not None
    except Exception:
        logger.exception("session_has_capture: lookup failed")
        return False


#: Quantity ceiling for a quote or a form submission - a pack count, not a volume.
QTY_MAX = 10_000


def classify_qty(v: object) -> tuple[int, bool]:
    """Classify a raw model/form quantity into ``(qty, needs_confirm)`` (Phase 1.4).

    - missing / blank            -> ``(1, False)``  a single-pack default; safe to use
    - a clean count ``1..QTY_MAX`` -> ``(n, False)`` (counts above the cap clamp to it)
    - anything else *present*    -> ``(1, True)``   unparseable (``"10-20"``, ``"a few"``)
                                                    or <=0 - never silently assume 1;
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


def parse_qty(v: object) -> int:
    """Quantity = number of packs, clamped to ``1..QTY_MAX``. Missing/invalid/<=0
    degrades to 1, never an error - a quote/record should still render. Use
    :func:`classify_qty` when you need to distinguish an unparseable input (to
    confirm it) from a legitimately-absent one (to default)."""
    qty, _ = classify_qty(v)
    return qty
