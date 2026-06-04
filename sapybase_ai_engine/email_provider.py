"""Transactional email transport with provider fallback.

A single entry point — `send_transactional_email()` — chooses the backend at
send time so deployments can upgrade deliverability without code changes:

    1. Resend       (RESEND_API_KEY set)            — HTTP API, best deliverability.
    2. Gmail SMTP   (SMTP_USER + SMTP_PASS set)      — fallback / local dev.
    3. None         (neither configured)             — logs and no-ops.

It never raises: a provider outage or missing config must not break the request
path (lead capture, handoff, digest cron). Returns True only on a confirmed send.

Provider SELECTION and payload SHAPING are pure functions (unit-tested); the
actual network I/O is isolated in the private _send_via_* helpers.
"""
import os
import ssl
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

import httpx

logger = logging.getLogger("email_provider")

RESEND_ENDPOINT = "https://api.resend.com/emails"
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def resolve_email_provider(env=None):
    """Return the active provider name ('resend' | 'smtp') or None.

    Resend wins when its key is present; otherwise Gmail SMTP if both creds are
    set; otherwise None (feature dormant). Pure — pass `env` to test.
    """
    env = env if env is not None else os.environ
    if (env.get("RESEND_API_KEY") or "").strip():
        return "resend"
    if (env.get("SMTP_USER") or "").strip() and (env.get("SMTP_PASS") or "").strip():
        return "smtp"
    return None


def email_from_header(address: str) -> str:
    """Build a professional From header, e.g. 'Sapybase <bot@domain.com>'.

    Display name comes from EMAIL_FROM_NAME (default 'Sapybase'); a blank name
    falls back to the bare address.
    """
    name = (os.getenv("EMAIL_FROM_NAME") or "Sapybase").strip()
    return formataddr((name, address)) if name else address


def build_resend_payload(from_value: str, to: str, subject: str, html: str, reply_to=None) -> dict:
    """Shape the Resend API JSON body. Pure (no network).

    `reply_to` is included only when truthy so we never send an empty header.
    """
    payload = {
        "from": from_value,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    return payload


def _send_via_resend(to: str, subject: str, html: str, reply_to=None) -> bool:
    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    from_addr = (os.getenv("EMAIL_FROM") or "").strip()
    if not from_addr:
        logger.error("EMAIL (resend): RESEND_API_KEY set but EMAIL_FROM is missing — skipping.")
        return False

    payload = build_resend_payload(email_from_header(from_addr), to, subject, html, reply_to)
    try:
        resp = httpx.post(
            RESEND_ENDPOINT,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=10.0,
        )
        if resp.is_success:
            return True
        logger.error(f"EMAIL (resend) non-2xx: {resp.status_code} {resp.text[:300]}")
        return False
    except Exception as exc:
        logger.error(f"EMAIL (resend) error: {str(exc)[:300]}")
        return False


def _send_via_smtp(to: str, subject: str, html: str, reply_to=None) -> bool:
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    if not smtp_user or not smtp_pass:
        return False

    email_msg = MIMEMultipart("alternative")
    email_msg["Subject"] = subject
    email_msg["From"] = email_from_header(smtp_user)
    email_msg["To"] = to
    if reply_to:
        email_msg["Reply-To"] = reply_to
    email_msg.attach(MIMEText(html, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(smtp_user, smtp_pass)
            # Envelope sender must stay the authenticated address (Gmail requirement).
            server.sendmail(smtp_user, to, email_msg.as_string())
        return True
    except Exception as exc:
        logger.error(f"EMAIL (smtp) error to {to}: {str(exc)[:300]}")
        return False


def send_transactional_email(to: str, subject: str, html: str, reply_to=None) -> bool:
    """Send one HTML email via the active provider. Returns True on success.

    No-ops (returns False) when no recipient or no provider is configured, and
    never raises — callers can fire-and-forget safely.
    """
    if not to:
        return False
    provider = resolve_email_provider()
    if provider is None:
        logger.info("EMAIL: no provider configured (set RESEND_API_KEY or SMTP_USER/SMTP_PASS) — skipping.")
        return False
    if provider == "resend":
        return _send_via_resend(to, subject, html, reply_to)
    return _send_via_smtp(to, subject, html, reply_to)
