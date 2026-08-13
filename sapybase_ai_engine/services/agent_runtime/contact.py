"""Cleaning of model-supplied contact details.

The LLM parsed these out of free-text chat, so nothing here may be trusted before it
becomes an email ``reply_to`` header or is echoed back to the visitor. Lives in the
runtime (not ``main.py``) because both the quote tool's capture and the handoff
email path need the same cleaning.
"""
import re
from typing import Optional, Tuple

_REPLY_TO_EMAIL_RE = re.compile(r"\A[^@\s]+@[^@\s]+\.[^@\s]+\Z")

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")

#: The bot claiming it recorded a contact detail. Slice K exists because this
#: sentence is prompt-driven and fires whether or not a row was actually written -
#: session 5c7ec4f6 promised a follow-up that `agent_requests` never received.
_CAPTURE_CLAIM_RE = re.compile(
    r"\b(?:"
    r"i(?:'ve| have)?\s+(?:noted|recorded|saved|got|taken)\s+(?:down\s+)?(?:your|the)|"
    r"(?:your|the)\s+(?:number|mobile|phone|email|details?)\s+(?:has|have)\s+been\s+"
    r"(?:noted|recorded|saved)|"
    r"i(?:'ll| will)?\s+pass\s+(?:your|the|these)\s+(?:number|mobile|phone|email|details?)"
    r")\b",
    re.IGNORECASE,
)

#: Anchors the claim to a contact detail. "I've noted your preference for AR grade"
#: is not a capture claim and must survive untouched.
_CONTACT_NOUN_RE = re.compile(
    r"\b(number|mobile|phone|whatsapp|email|e-mail|contact|details?)\b", re.IGNORECASE)

#: What we say instead when the visitor clearly offered a detail we could not read.
#: Never claims capture, and gives them the two ways out RULE 6 already licenses.
UNREADABLE_ACK = (
    "I could not read that contact detail clearly, so I have not saved it. "
    "Could you send it again, or I can open a short form for you?"
)


def valid_reply_to(email) -> Optional[str]:
    """A trimmed email only if it is well-shaped, else None. A malformed value is
    dropped rather than injected into a mail header."""
    if not isinstance(email, str):
        return None
    e = email.strip()
    return e if (e and len(e) <= 254 and _REPLY_TO_EMAIL_RE.match(e)) else None


def captured_contact_echo(args: dict) -> Optional[dict]:
    """The contact the model captured, cleaned, for the widget to confirm back to
    the visitor - so a mis-read is caught before the lead goes out. None when
    nothing usable was captured."""
    email = valid_reply_to(args.get("contact_email"))
    phone = (str(args.get("contact_phone") or "")).strip()[:32] or None
    name = (str(args.get("contact_name") or "")).strip()[:120] or None
    if not (email or phone):
        return None
    return {"name": name, "email": email, "phone": phone}


def capture_claims(text: str) -> list:
    """Sentences in which the bot claims it recorded a contact detail."""
    sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split((text or "").strip())]
    return [s for s in sentences
            if s and _CAPTURE_CLAIM_RE.search(s) and _CONTACT_NOUN_RE.search(s)]


def bind_acknowledgement(text: str, *, captured: bool, cue: bool) -> Tuple[str, Optional[str]]:
    """Keep the acknowledgment honest about whether capture actually happened.

    Slice K (plan §6). The sentence is prompt-driven and decoupled from the write,
    so the bot promises a follow-up nobody will make. This is the
    ``_strip_source_citation`` pattern from §7.1: prompt for the common case, code
    for the guarantee.

    ``captured`` - a row was really written this turn.
    ``cue`` - the visitor's message carried an explicit contact cue, so they believe
    they just handed something over.

    Returns ``(text, finding)``; ``finding`` is None when nothing was wrong.
    """
    if captured:
        return text, None  # the claim is true; this is the path that already worked

    claims = capture_claims(text)
    if not claims:
        return text, None

    kept = [s for s in _SENTENCE_SPLIT_RE.split((text or "").strip())
            if s.strip() and s.strip() not in set(claims)]
    if cue:
        # They gave something we could not parse. Say so and offer a way through -
        # never silently drop it, or they will assume it landed.
        kept.append(UNREADABLE_ACK)
        finding = f"unreadable contact claimed as captured: {claims[0][:60]}"
    else:
        # Nothing was offered at all, so there is nothing to re-read. Removing the
        # false claim is the whole fix; asking them to repeat a number they never
        # gave would be its own kind of nonsense.
        finding = f"capture claimed with no contact in the message: {claims[0][:60]}"

    repaired = " ".join(s.strip() for s in kept).strip()
    # Never return an empty reply: a turn that was ONLY a false claim still has to
    # say something, and the corrective sentence is the honest minimum.
    return (repaired or UNREADABLE_ACK), finding
