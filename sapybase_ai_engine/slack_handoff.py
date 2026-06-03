"""Slack lead handoff — pure, testable helpers (no I/O).

Validates the owner's Slack Incoming Webhook URL and builds the Slack message
for a captured lead. The actual HTTP POST lives in main (_fire_slack); keeping
these pure lets us unit-test the URL allow-list (an SSRF guard — only Slack's
webhook host is permitted) and the message formatting/escaping without a network.
"""

_SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/"

_BAND_EMOJI = {"HOT": "🔥", "WARM": "🌤️", "COLD": "❄️"}


def is_valid_slack_webhook(url) -> bool:
    """True only for genuine Slack Incoming Webhook URLs.

    Restricting to https://hooks.slack.com/ is a deliberate SSRF guard: the
    owner-supplied URL is fetched server-side, so it must not be allowed to
    point at internal hosts or arbitrary endpoints.
    """
    if not url or not isinstance(url, str):
        return False
    return url.strip().startswith(_SLACK_WEBHOOK_PREFIX)


def _slack_escape(text: str) -> str:
    """Escape the three characters Slack mrkdwn treats specially. Must replace
    & first so the &amp; entities aren't double-escaped."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_slack_lead_message(bot_name, lead) -> dict:
    """Build the Slack webhook JSON payload for a captured lead.

    `lead` is a dict with optional keys: email, name, context, score, band.
    Returns a payload with a `text` fallback (used for notifications) and
    Block Kit `blocks`. All visitor-supplied values are Slack-escaped.
    """
    band = str(lead.get("band") or "").strip().upper()
    emoji = _BAND_EMOJI.get(band, "📥")
    label = band.title() if band else "New"

    name = _slack_escape(str(lead.get("name") or "").strip())
    email = _slack_escape(str(lead.get("email") or "").strip())
    context = _slack_escape(str(lead.get("context") or "").strip())
    bot = _slack_escape(str(bot_name or "your bot"))

    try:
        score = int(lead.get("score"))
        score_txt = f"{score}/100"
    except (TypeError, ValueError):
        score_txt = "—"

    who = name or email or "A visitor"
    lines = []
    contact = who
    if email:
        contact += f"  <mailto:{email}|{email}>"
    lines.append(f"*{contact}*  on {bot}")
    lines.append(f"Score: *{score_txt}*" + (f"  ({band})" if band else ""))
    if context:
        lines.append(f"> {context}")
    section_text = "\n".join(lines)

    # Header uses plain_text with no visitor input (avoids any mrkdwn ambiguity).
    header = f"{emoji} {label} lead"
    fallback = f"{header}: {who} ({score_txt})"

    return {
        "text": fallback,
        "blocks": [
            {"type": "header", "text": {"type": "plain_text", "text": header, "emoji": True}},
            {"type": "section", "text": {"type": "mrkdwn", "text": section_text}},
        ],
    }
