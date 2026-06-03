"""Instant HOT-lead alerting — pure, testable helpers (no I/O).

Decides whether a freshly captured lead warrants an immediate owner alert and
builds the alert email. All visitor-provided fields are HTML-escaped before being
placed in the email body to prevent HTML/script injection into the owner's inbox.
The SMTP send lives in main (_send_hot_lead_email); these functions are pure so
they can be unit-tested without sending mail.
"""

from html import escape


def should_alert_hot_lead(band) -> bool:
    """True only for HOT leads. Case-insensitive; safe on None/non-str."""
    return str(band or "").strip().upper() == "HOT"


def resolve_alert_recipient(company: dict):
    """Decide where to send a HOT-lead alert for this company, or None to skip.

    Honors the owner's opt-in toggle (`hot_lead_alerts_enabled`, defaults to True
    so existing customers keep receiving alerts) and the optional `alert_email`
    override, falling back to the account owner's email (`owner_email`).
    Returns the recipient address, or None when alerts are off or no address
    is available.
    """
    if not company.get("hot_lead_alerts_enabled", True):
        return None
    override = (company.get("alert_email") or "").strip()
    if override:
        return override
    owner = (company.get("owner_email") or "").strip()
    return owner or None


def build_hot_lead_email(bot_name, lead) -> tuple[str, str]:
    """Return (subject, html_body) for a HOT-lead alert.

    `lead` is a dict with optional keys: email, name, context, score, reasons.
    Every visitor-supplied value is HTML-escaped.
    """
    bot = escape(str(bot_name or "Your bot"))
    email = escape(str(lead.get("email") or ""))
    name = escape(str(lead.get("name") or "").strip())
    context = escape(str(lead.get("context") or "").strip())

    try:
        score = int(lead.get("score"))
    except (TypeError, ValueError):
        score = None
    score_txt = f"{score}/100" if score is not None else "—"

    reasons = lead.get("reasons") or []
    if isinstance(reasons, str):
        reasons = [reasons]
    reasons_html = "".join(
        f"<li style='margin:2px 0'>{escape(str(r))}</li>" for r in reasons if str(r).strip()
    )
    reasons_block = (
        f"<ul style='margin:8px 0 16px;padding-left:18px;color:#475569'>{reasons_html}</ul>"
        if reasons_html else ""
    )

    who = name or email or "A visitor"
    subject = f"🔥 Hot lead ({score_txt}): {name or email or 'new visitor'}"

    context_block = (
        f"<p style='color:#475569;margin:0 0 16px'><b>What they said:</b><br>{context}</p>"
        if context else ""
    )
    email_block = (
        f"<p style='margin:0 0 4px'><b>Email:</b> <a href='mailto:{email}'>{email}</a></p>"
        if email else "<p style='margin:0 0 4px;color:#94a3b8'>No email provided</p>"
    )
    name_block = (
        f"<p style='margin:0 0 12px'><b>Name:</b> {name}</p>" if name else ""
    )

    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
      <h2 style="margin:0 0 4px">🔥 New hot lead on {bot}</h2>
      <p style="color:#64748b;margin:0 0 16px"><b>{who}</b> scored <b>{score_txt}</b> (HOT). Follow up now while they're still engaged.</p>
      {email_block}
      {name_block}
      {reasons_block}
      {context_block}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Reply directly to this email to reach the lead. Sent by Sapybase.</p>
    </div>
    """
    return subject, html
