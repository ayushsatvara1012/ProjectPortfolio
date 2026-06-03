"""Deterministic, LLM-free lead quality scoring.

Pure functions — no I/O, no LLM, no external state. Safe to unit test in
isolation and to import from anywhere without circular-dependency risk.
Extracted verbatim from main.py (no logic changes).
"""

# ── LEAD SCORING (deterministic, no LLM) ─────────────────────────────────────

# Free/consumer email providers — a business domain is a stronger B2B signal.
_FREE_EMAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "ymail.com",
    "outlook.com", "hotmail.com", "live.com", "msn.com",
    "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
    "gmx.com", "zoho.com", "yandex.com", "mail.com", "pm.me",
}

_BUYING_KEYWORDS = (
    "quote", "pricing", "price", "how much", "cost", "buy", "purchase",
    "hire", "sign up", "signup", "get started", "book a", "schedule",
    "free trial", "trial", "demo", "subscribe", "upgrade", "checkout",
    "order", "invoice", "budget", "proposal",
)

_CONTACT_KEYWORDS = (
    "talk to a human", "talk to sales", "speak to someone", "speak to a person",
    "real person", "contact you", "contact us", "reach out", "get in touch",
    "sales team", "support team", "call me", "email me",
)


def _email_domain(email):
    if not email or "@" not in email:
        return ""
    return email.rsplit("@", 1)[-1].strip().lower()


def _score_lead(context, email, name):
    """Deterministic 0..100 lead quality score with explainable reasons.

    Pure function — no I/O, no LLM. Signals:
      * buying-intent keywords in conversation context  (+40 max)
      * sales/human-contact intent keywords             (+20 max)
      * business (non-free-provider) email domain        (+25)
      * visitor provided a name                          (+5)
      * substantive multi-turn context                   (+10 max)

    Returns {"score": int, "band": "HOT"|"WARM"|"COLD", "reasons": [str, ...]}.
    """
    ctx = (context or "").lower()
    reasons = []
    score = 0

    buy_hits = sorted({kw for kw in _BUYING_KEYWORDS if kw in ctx})
    if buy_hits:
        score += min(40, 20 + 10 * (len(buy_hits) - 1))   # 1 hit=20, 2=30, 3+=40
        reasons.append("buying intent (" + ", ".join(buy_hits[:3]) + ")")

    contact_hits = sorted({kw for kw in _CONTACT_KEYWORDS if kw in ctx})
    if contact_hits:
        score += min(20, 12 + 8 * (len(contact_hits) - 1))  # 1=12, 2+=20
        reasons.append("wants to talk to sales/human")

    domain = _email_domain(email)
    if domain and domain not in _FREE_EMAIL_DOMAINS:
        score += 25
        reasons.append("business email (" + domain + ")")
    elif domain:
        reasons.append("personal email")

    if name and name.strip():
        score += 5
        reasons.append("provided name")

    turns = [t for t in ctx.split("||") if len(t.strip()) >= 8]
    if len(turns) >= 3:
        score += 10
        reasons.append("engaged (3+ messages)")
    elif len(turns) == 2:
        score += 5
        reasons.append("engaged (2 messages)")

    score = max(0, min(100, score))
    band = "HOT" if score >= 70 else "WARM" if score >= 40 else "COLD"
    if not reasons:
        reasons.append("no strong signals")
    return {"score": score, "band": band, "reasons": reasons}
