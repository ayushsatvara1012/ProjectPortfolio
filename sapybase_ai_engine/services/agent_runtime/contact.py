"""Cleaning of model-supplied contact details.

The LLM parsed these out of free-text chat, so nothing here may be trusted before it
becomes an email ``reply_to`` header or is echoed back to the visitor. Lives in the
runtime (not ``main.py``) because both the quote tool's capture and the handoff
email path need the same cleaning.
"""
import re
from typing import Optional

_REPLY_TO_EMAIL_RE = re.compile(r"\A[^@\s]+@[^@\s]+\.[^@\s]+\Z")


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
