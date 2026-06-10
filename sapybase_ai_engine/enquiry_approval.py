"""Explore enquiry approval — signed one-click tokens + state machine (Explore §6).

Pure helpers, no I/O — unit-testable. Two concerns:

1. **Signed action tokens** for the email "Approve / Decline" buttons: an admin
   can action an enquiry from their phone with no login. HMAC-signed, action-bound,
   enquiry-bound, 72h expiry. Mirrors the widget-session token scheme.

2. **State machine** that decides whether an action should apply, given the
   enquiry's current status. Single-use is enforced by the *status* (once
   `approved`/`rejected`, the token is inert — re-clicks are friendly no-ops),
   so tokens don't need a server-side nonce store.

Status values match `migrations/v24_explore_enquiries.sql`: pending|approved|rejected.
"""

import base64
import hashlib
import hmac
import json
import secrets
import time

# Enquiry statuses (DB).
STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"

# Actions (carried in the token / requested by the admin).
ACTION_APPROVE = "approve"
ACTION_DECLINE = "decline"
_VALID_ACTIONS = frozenset({ACTION_APPROVE, ACTION_DECLINE})

# resolve_action() outcomes.
OUTCOME_APPLY = "apply"                 # pending → perform the action
OUTCOME_NOOP_APPROVED = "already_approved"  # terminal: already granted
OUTCOME_NOOP_REJECTED = "already_rejected"  # terminal: already declined
OUTCOME_INVALID = "invalid_action"      # unknown action

DEFAULT_TOKEN_TTL = 72 * 3600  # 72 hours, per §6


def target_status_for(action: str) -> str | None:
    """The enquiry status an action transitions a pending row into."""
    if action == ACTION_APPROVE:
        return STATUS_APPROVED
    if action == ACTION_DECLINE:
        return STATUS_REJECTED
    return None


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def mint_action_token(
    enquiry_id: str,
    action: str,
    secret: str,
    *,
    now: int | None = None,
    ttl: int = DEFAULT_TOKEN_TTL,
) -> str:
    """Mint a signed, action-bound, expiring token. Raises ValueError on bad input."""
    if action not in _VALID_ACTIONS:
        raise ValueError(f"invalid action: {action!r}")
    if not secret:
        raise ValueError("secret is required to mint a token")
    if not enquiry_id:
        raise ValueError("enquiry_id is required")
    issued = int(now if now is not None else time.time())
    payload = {
        "eid": str(enquiry_id),
        "act": action,
        "exp": issued + int(ttl),
        "n": secrets.token_urlsafe(8),
    }
    raw = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{sig}"


def verify_action_token(token: str, secret: str, *, now: int | None = None):
    """Verify a token. Returns (True, {"enquiry_id","action"}) or (False, reason).

    Reasons: secret_unset | malformed | bad_sig | bad_payload | bad_action | expired.
    Constant-time signature comparison; expiry checked against `now`.
    """
    if not secret:
        return (False, "secret_unset")
    if not token or not isinstance(token, str) or "." not in token:
        return (False, "malformed")
    raw, _, sig = token.rpartition(".")
    if not raw or not sig:
        return (False, "malformed")
    expected = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return (False, "bad_sig")
    try:
        payload = json.loads(_b64url_decode(raw).decode())
    except Exception:
        return (False, "bad_payload")
    eid = payload.get("eid")
    action = payload.get("act")
    exp = payload.get("exp")
    if not eid or action not in _VALID_ACTIONS or not isinstance(exp, int):
        return (False, "bad_action" if action not in _VALID_ACTIONS else "bad_payload")
    current = int(now if now is not None else time.time())
    if current >= exp:
        return (False, "expired")
    return (True, {"enquiry_id": str(eid), "action": action})


def resolve_action(current_status: str, action: str) -> str:
    """Decide what to do given the enquiry's current status and the requested action.

    pending  → OUTCOME_APPLY (perform it)
    approved → OUTCOME_NOOP_APPROVED (terminal; re-clicks are friendly no-ops)
    rejected → OUTCOME_NOOP_REJECTED (terminal)
    bad action → OUTCOME_INVALID
    """
    if action not in _VALID_ACTIONS:
        return OUTCOME_INVALID
    s = (current_status or "").strip().lower()
    if s == STATUS_APPROVED:
        return OUTCOME_NOOP_APPROVED
    if s == STATUS_REJECTED:
        return OUTCOME_NOOP_REJECTED
    # pending / null / anything unexpected → treat as actionable pending.
    return OUTCOME_APPLY
