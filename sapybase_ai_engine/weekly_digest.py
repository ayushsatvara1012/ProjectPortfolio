"""Weekly results digest — pure, testable helpers (no I/O).

Builds the weekly lead-results summary and its email from data the caller has
already fetched. The DB query, SMTP send, and once-per-week dedupe live in main
(run_weekly_digest endpoint); keeping these functions pure means the summary
math and the HTML (including injection-escaping of visitor fields) can be unit
-tested without a database or mail server.
"""

from datetime import datetime
from html import escape


def iso_week_key(dt: datetime) -> str:
    """Stable per-ISO-week key like '2026-W23', used to dedupe sends so a company
    is emailed at most once per calendar week regardless of trigger frequency."""
    year, week, _ = dt.isocalendar()
    return f"{year}-W{week:02d}"


def resolve_digest_recipient(company: dict):
    """Where to send this company's weekly digest, or None to skip.

    Honors the `weekly_digest_enabled` toggle (defaults True so existing
    customers keep receiving digests) and the optional `alert_email` override,
    falling back to the account owner's email (`owner_email`)."""
    if not company.get("weekly_digest_enabled", True):
        return None
    override = (company.get("alert_email") or "").strip()
    if override:
        return override
    owner = (company.get("owner_email") or "").strip()
    return owner or None


def summarize_leads(leads) -> dict:
    """Summarize a week's captured leads.

    `leads` is an iterable of dicts with keys: email, name, score, band, context.
    Returns counts by band, total, and the top leads by score (desc).
    """
    leads = list(leads or [])
    total = len(leads)
    bands = {"HOT": 0, "WARM": 0, "COLD": 0}
    for lead in leads:
        b = str(lead.get("band") or "").strip().upper()
        if b in bands:
            bands[b] += 1

    def _score(lead):
        try:
            return int(lead.get("score"))
        except (TypeError, ValueError):
            return -1

    top = sorted(leads, key=_score, reverse=True)[:5]
    top_leads = [
        {
            "name": lead.get("name") or "",
            "email": lead.get("email") or "",
            "score": lead.get("score"),
            "band": str(lead.get("band") or "").strip().upper(),
            "context": lead.get("context") or "",
        }
        for lead in top
    ]
    return {
        "total": total,
        "hot": bands["HOT"],
        "warm": bands["WARM"],
        "cold": bands["COLD"],
        "top_leads": top_leads,
    }


def should_send_digest(stats: dict) -> bool:
    """Skip empty weeks — sending '0 leads' digests trains owners to ignore the
    email. Only send when there was real activity."""
    return bool(stats and stats.get("total", 0) > 0)


def build_digest_email(bot_name, stats: dict, period_label: str) -> tuple:
    """Return (subject, html_body) for the weekly digest. Every visitor-supplied
    value (names, emails, context) is HTML-escaped."""
    bot = escape(str(bot_name or "Your bot"))
    period = escape(str(period_label or "this week"))
    total = int(stats.get("total", 0))
    hot = int(stats.get("hot", 0))
    warm = int(stats.get("warm", 0))
    cold = int(stats.get("cold", 0))

    subject = f"📊 {bot}: {total} new lead{'s' if total != 1 else ''} ({hot} hot) — {period}"

    rows_html = ""
    for lead in stats.get("top_leads", []):
        name = escape(str(lead.get("name") or "").strip())
        email = escape(str(lead.get("email") or "").strip())
        context = escape(str(lead.get("context") or "").strip())
        band = escape(str(lead.get("band") or "").strip().upper())
        try:
            score = int(lead.get("score"))
            score_txt = f"{score}/100"
        except (TypeError, ValueError):
            score_txt = "—"
        who = name or email or "Anonymous visitor"
        contact = f" &lt;{email}&gt;" if email and name else ""
        ctx_line = (
            f"<div style='color:#64748b;font-size:13px;margin-top:2px'>{context}</div>"
            if context else ""
        )
        rows_html += (
            f"<tr><td style='padding:10px 0;border-bottom:1px solid #e2e8f0'>"
            f"<b>{who}</b>{contact}{ctx_line}</td>"
            f"<td style='padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap'>"
            f"<b>{score_txt}</b> <span style='color:#94a3b8;font-size:12px'>{band}</span></td></tr>"
        )

    top_block = (
        f"<h3 style='margin:24px 0 4px;font-size:15px'>Top leads to follow up</h3>"
        f"<table style='width:100%;border-collapse:collapse'>{rows_html}</table>"
        if rows_html else ""
    )

    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
      <h2 style="margin:0 0 4px">📊 {bot} — weekly results</h2>
      <p style="color:#64748b;margin:0 0 20px">{period}</p>
      <div style="display:flex;gap:12px;margin:0 0 8px">
        <div style="flex:1;background:#f8fafc;border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:700">{total}</div>
          <div style="color:#64748b;font-size:12px">New leads</div>
        </div>
        <div style="flex:1;background:#fef2f2;border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#dc2626">{hot}</div>
          <div style="color:#64748b;font-size:12px">🔥 Hot</div>
        </div>
        <div style="flex:1;background:#fffbeb;border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#d97706">{warm}</div>
          <div style="color:#64748b;font-size:12px">Warm</div>
        </div>
        <div style="flex:1;background:#f8fafc;border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:#64748b">{cold}</div>
          <div style="color:#64748b;font-size:12px">Cold</div>
        </div>
      </div>
      {top_block}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Sent by Sapybase. Manage these emails in your dashboard settings.</p>
    </div>
    """
    return subject, html
