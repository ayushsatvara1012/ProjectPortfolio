"""Real-time owner handoff for transactional agent actions — pure builders.

Phase 4b of the chemical-vertical-agent plan (§10). When the agent *commits* on a
visitor's behalf — logs a sample request, or prices/records a quote — the owner
should hear about it immediately, not only when they next open the dashboard.

This module is the *formatting* half of that handoff: pure functions that turn a
captured request dict into a Slack Block Kit payload and a transactional email
(subject + HTML). The actual network I/O (the Slack POST, the email send) lives
in ``main`` (``_fire_agent_handoff``), scheduled as a background task — same
split as ``slack_handoff`` (pure builders) vs ``main._fire_slack`` (I/O). Keeping
this pure makes the escaping and money/label logic unit-testable without a network.

The ``req`` dict shape (built by ``main``'s ``_tool_executor`` capture):

    {
      "kind": "sample" | "quote",
      "status": "quoted" | "price_on_request" | "sample_requested",  # quote only uses
      "product": str, "grade": str|None, "pack_size": str|None, "quantity": int,
      "unit_price": float|None, "subtotal": float|None,   # quote only
      "gst_rate": float|None, "currency": str, "is_por": bool,  # quote only
      "note": str|None,
      "contact_name": str|None, "contact_email": str|None, "contact_phone": str|None,
    }
"""
from __future__ import annotations

import html as _html
from typing import Any, Dict, Tuple

# Reuse the SAME Slack escaper as the lead handoff so escaping never diverges
# (it's security-relevant: visitor-supplied product/contact text is interpolated).
from slack_handoff import _slack_escape

_KIND_META = {
    "sample": ("🧪", "New sample request"),
    "quote": ("🧾", "New quote"),
}


def _money(amount, currency: str = "INR") -> str:
    """Format a money amount with a thousands separator. ₹ for INR, else the code."""
    try:
        n = float(amount)
    except (TypeError, ValueError):
        return ""
    symbol = "₹" if (currency or "INR").upper() == "INR" else f"{currency} "
    return f"{symbol}{n:,.2f}"


def _heading(req: Dict[str, Any]) -> Tuple[str, str]:
    """(emoji, label) for the request — a POR quote reads differently from a price."""
    kind = str(req.get("kind") or "").lower()
    emoji, label = _KIND_META.get(kind, ("📥", "New request"))
    if kind == "quote" and (req.get("status") == "price_on_request" or req.get("is_por")):
        label = "Price-on-request"
    return emoji, label


def _product_line(req: Dict[str, Any]) -> str:
    """A compact 'Acetone · AR · 2.5 Ltr · ×3' description of what was requested."""
    parts = [str(req.get("product") or "").strip() or "(unspecified product)"]
    if (req.get("grade") or "").strip():
        parts.append(str(req["grade"]).strip())
    if (req.get("pack_size") or "").strip():
        parts.append(str(req["pack_size"]).strip())
    try:
        qty = int(req.get("quantity"))
        if qty and qty != 1:
            parts.append(f"×{qty}")
    except (TypeError, ValueError):
        pass
    return " · ".join(parts)


def summarize_agent_request(req: Dict[str, Any]) -> str:
    """One human-readable line — used for the email subject and Slack fallback text.

    Quotes append the figure (or 'price on request'); samples are just the product.
    No markup here — callers escape for their channel.
    """
    _, label = _heading(req)
    line = _product_line(req)
    if str(req.get("kind") or "").lower() == "quote":
        if req.get("status") == "price_on_request" or req.get("is_por"):
            return f"{label}: {line} — price on request"
        money = _money(req.get("subtotal"), req.get("currency") or "INR")
        tail = f" — {money} (GST extra)" if money else ""
        return f"{label}: {line}{tail}"
    return f"{label}: {line}"


def _contact_line(req: Dict[str, Any]) -> str:
    """'Name · email · phone' from whatever contact fields are present, or a note
    that none were captured."""
    bits = []
    for key in ("contact_name", "contact_email", "contact_phone"):
        val = (req.get(key) or "").strip()
        if val:
            bits.append(val)
    return " · ".join(bits) if bits else "No contact captured"


def build_agent_request_slack_payload(bot_name, req: Dict[str, Any]) -> dict:
    """Build the Slack webhook JSON for a transactional agent request.

    All visitor-supplied values are Slack-escaped. Returns a `text` fallback plus
    Block Kit `blocks`, the same shape ``main._fire_slack``'s POST expects.
    """
    emoji, label = _heading(req)
    bot = _slack_escape(str(bot_name or "your bot"))

    lines = [f"*{_slack_escape(_product_line(req))}*  on {bot}"]

    if str(req.get("kind") or "").lower() == "quote":
        if req.get("status") == "price_on_request" or req.get("is_por"):
            lines.append("Price: *on request* — send the buyer a price")
        else:
            money = _money(req.get("subtotal"), req.get("currency") or "INR")
            if money:
                lines.append(f"Total: *{_slack_escape(money)}*  (GST extra as applicable)")

    lines.append(f"Contact: {_slack_escape(_contact_line(req))}")
    note = (req.get("note") or "").strip()
    if note:
        lines.append(f"> {_slack_escape(note)}")

    header = f"{emoji} {label}"
    fallback = f"{header}: {summarize_agent_request(req)}"
    return {
        "text": fallback,
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": header, "emoji": True}},
            {"type": "section", "text": {"type": "mrkdwn", "text": "\n".join(lines)}},
        ],
    }


def build_agent_request_email(bot_name, req: Dict[str, Any]) -> Tuple[str, str]:
    """Build the (subject, html) owner email for a transactional agent request.

    HTML-escapes every interpolated value. Mirrors the visual style of the other
    transactional owner emails (handoff / hot-lead).
    """
    emoji, label = _heading(req)
    bot = _html.escape(str(bot_name or "your bot"))
    product = _html.escape(_product_line(req))
    contact = _html.escape(_contact_line(req))
    note = (req.get("note") or "").strip()

    rows = [
        f"<tr><td style='padding:6px 0;color:#64748b'>Product</td>"
        f"<td style='padding:6px 0'><b>{product}</b></td></tr>"
    ]
    if str(req.get("kind") or "").lower() == "quote":
        if req.get("status") == "price_on_request" or req.get("is_por"):
            rows.append(
                "<tr><td style='padding:6px 0;color:#64748b'>Price</td>"
                "<td style='padding:6px 0'><b>On request</b> — send the buyer a price</td></tr>"
            )
        else:
            money = _html.escape(_money(req.get("subtotal"), req.get("currency") or "INR"))
            if money:
                rows.append(
                    "<tr><td style='padding:6px 0;color:#64748b'>Total</td>"
                    f"<td style='padding:6px 0'><b>{money}</b> (GST extra as applicable)</td></tr>"
                )
    rows.append(
        "<tr><td style='padding:6px 0;color:#64748b'>Contact</td>"
        f"<td style='padding:6px 0'>{contact}</td></tr>"
    )
    if note:
        rows.append(
            "<tr><td style='padding:6px 0;color:#64748b'>Note</td>"
            f"<td style='padding:6px 0'>{_html.escape(note)}</td></tr>"
        )

    subject = f"[{str(bot_name or 'your bot')}] {summarize_agent_request(req)}"
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
      <h2 style="margin:0 0 4px">{emoji} {label}</h2>
      <p style="color:#64748b;margin:0 0 16px">Captured by <b>{bot}</b> just now.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">{''.join(rows)}</table>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Sent by Sapybase</p>
    </div>
    """
    return subject, html
