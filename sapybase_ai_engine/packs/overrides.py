"""Per-company pack overrides — merge ``pack_defaults | company_overrides``.

Phase 5 (customise UI). A vertical pack (``packs/chemical.py``) ships immutable
DEFAULTS. An owner customises a single bot from the customise tab; those deltas are
stored as JSON in ``companies.pack_overrides`` and merged over the pack at runtime.

This module is PURE (no DB, no I/O): it is the single source of truth for both
- the API WRITE path (sanitise an owner-submitted form before storing), and
- the runtime READ path (resolve the effective form / required fields / sink),
so the widget, the submit endpoint, and the dashboard editor can never disagree.

Everything is defensive: a malformed override must degrade to the pack default,
never raise — a bad stored value cannot be allowed to 500 a live widget.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

# Mirror FormField.type (packs/schema.py). A field whose type isn't here is coerced
# to "text" rather than dropped — the safest visible fallback.
ALLOWED_FIELD_TYPES = ("text", "email", "tel", "number", "textarea", "product", "grade")

# Guard rails so a hostile / fat-fingered override can't bloat the form.
MAX_FIELDS = 30
MAX_NAME_LEN = 64
MAX_LABEL_LEN = 120
MAX_PLACEHOLDER_LEN = 160

# COA finder (coa-finder-plan §9 Phase 0). A Drive folder ID is interpolated into
# the Drive query `'{folder_id}' in parents`, so an ID containing an apostrophe
# would break out of the quoted string and rewrite the query (plan H1). This regex
# is the ONLY gate: enforced here on the write path and again by the connector
# before every Drive call. It is also the SSRF guard — we build the googleapis.com
# URL ourselves and never fetch an owner-supplied one.
COA_FOLDER_ID_RE = re.compile(r"^[A-Za-z0-9_-]{10,200}$")


def coerce_overrides(raw: Any) -> Dict[str, Any]:
    """Normalize a stored ``pack_overrides`` value (dict | JSON str | None) to a dict.

    JSONB comes back from psycopg2 as either a dict or a string depending on the
    adapter registration, and a hand-edited row could be anything — so accept all
    and collapse the garbage cases to ``{}`` (= no overrides = pure pack default).
    """
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _slug_name(value: Any) -> str:
    """Coerce a field name to a safe submission key: lowercase, [a-z0-9_], trimmed.

    Returns "" for anything that can't yield a usable key (caller drops the field).
    """
    if not isinstance(value, str):
        return ""
    out = []
    for ch in value.strip().lower():
        if ch.isalnum() and ch.isascii():
            out.append(ch)
        elif ch in (" ", "-", "_"):
            out.append("_")
        # everything else (punctuation, unicode) is dropped
    slug = "".join(out).strip("_")
    # collapse runs of underscores
    while "__" in slug:
        slug = slug.replace("__", "_")
    return slug[:MAX_NAME_LEN]


def sanitize_form_fields(raw: Any) -> List[Dict[str, Any]]:
    """Validate/coerce an owner-submitted field list into safe FormField dicts.

    Drops fields with no usable name; de-dupes by name (first wins); caps count and
    string lengths; coerces an unknown type to "text". Returns ``[]`` for non-list
    or empty input — the caller treats ``[]`` as "fall back to the pack default".
    """
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    seen: set = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = _slug_name(item.get("name") or item.get("label"))
        if not name or name in seen:
            continue
        seen.add(name)
        ftype = item.get("type")
        if ftype not in ALLOWED_FIELD_TYPES:
            ftype = "text"
        label = item.get("label")
        if not isinstance(label, str) or not label.strip():
            label = name.replace("_", " ").title()
        placeholder = item.get("placeholder")
        if not isinstance(placeholder, str):
            placeholder = ""
        out.append({
            "name": name,
            "label": label.strip()[:MAX_LABEL_LEN],
            "type": ftype,
            "required": bool(item.get("required")),
            "placeholder": placeholder.strip()[:MAX_PLACEHOLDER_LEN],
        })
        if len(out) >= MAX_FIELDS:
            break
    return out


# ── Visitor-side submission sanitiser (Phase 2.1) ────────────────────────────
#
# The OWNER-side sanitisers above harden the FORM DEFINITION. This hardens the
# VISITOR-submitted VALUES on the public /api/widget/sample-request endpoint: it
# is untrusted input, so we validate every value against the effective form and
# drop anything not declared (unknown junk, a honeypot, injection attempts).

# Per-type length caps — generous for real submissions, tight enough to stop a
# public endpoint being used to store megabytes of junk. A type not listed uses
# the default.
_VISITOR_MAX_LEN = {
    "email": 254,       # RFC 5321 max address length
    "tel": 32,
    "number": 32,
    "text": 200,
    "product": 200,
    "grade": 120,
    "textarea": 2000,
}
_VISITOR_DEFAULT_MAX = 200

# Keys the widget legitimately submits that are NOT visible form fields: hidden
# prefill carried from the request_sample tool. Kept (as text), everything else
# not in the effective form is dropped.
_VISITOR_EXTRA_KEYS = {"cas_number": "text"}

# Deliberately permissive: reject only clearly-malformed addresses (no @, no dot
# in the domain, whitespace). Full RFC validation is neither useful nor kind here.
_EMAIL_RE = re.compile(r"\A[^@\s]+@[^@\s]+\.[^@\s]+\Z")


def _sanitize_tel(s: str) -> str:
    """Keep digits and a single leading ``+`` — drop spaces, dashes, brackets."""
    plus = s.lstrip().startswith("+")
    digits = "".join(ch for ch in s if ch.isdigit())
    if not digits:
        return ""
    return ("+" + digits if plus else digits)[:_VISITOR_MAX_LEN["tel"]]


def sanitize_visitor_fields(raw: Any, effective_form: List[Dict[str, Any]]) -> Dict[str, str]:
    """Sanitise a visitor-submitted sample-form payload against the EFFECTIVE form.

    Public-endpoint hardening: the submit endpoint must never trust the raw
    ``fields`` dict. For each field DECLARED in the effective form (plus the small
    allowlist of hidden prefill keys):
      - coerce to a trimmed string and cap its length by type;
      - ``email`` type: keep only a well-formed address, else drop the value (the
        caller's required-field check then reports it as missing);
      - ``tel`` type: keep digits and a single leading ``+`` only.
    Keys NOT in the effective form (unknown junk, a honeypot, injection attempts)
    are dropped entirely. Returns a clean ``{name: str}`` dict; empties are omitted.
    """
    if not isinstance(raw, dict):
        return {}
    allowed: Dict[str, str] = {
        f["name"]: (f.get("type") or "text")
        for f in effective_form if isinstance(f, dict) and f.get("name")
    }
    allowed.update(_VISITOR_EXTRA_KEYS)
    out: Dict[str, str] = {}
    for name, ftype in allowed.items():
        if name not in raw:
            continue
        val = raw.get(name)
        if val is None:
            continue
        s = str(val).strip()
        if not s:
            continue
        s = s[: _VISITOR_MAX_LEN.get(ftype, _VISITOR_DEFAULT_MAX)]
        if ftype == "email":
            if not _EMAIL_RE.match(s):
                continue  # invalid email dropped → required check catches it
        elif ftype == "tel":
            s = _sanitize_tel(s)
            if not s:
                continue
        out[name] = s
    return out


def sanitize_sample_sink(raw: Any) -> Dict[str, str]:
    """Validate a ``sample_sink`` override → ``{"url", "secret"}`` (https-only url).

    A blank/invalid URL collapses to ``{}`` (no per-bot sink → caller falls back to
    the global env sink). The secret is kept only when a URL is present.
    """
    if not isinstance(raw, dict):
        return {}
    url = raw.get("url")
    if not isinstance(url, str):
        return {}
    url = url.strip()
    if not url or not url.lower().startswith("https://"):
        return {}
    secret = raw.get("secret")
    secret = secret.strip() if isinstance(secret, str) else ""
    return {"url": url[:2048], "secret": secret[:256]}


def extract_folder_id(raw: Any) -> str:
    """A Drive folder URL (or a bare ID) → the folder ID; ``""`` if unusable.

    Owners paste whatever the Drive UI gave them, which is any of::

        https://drive.google.com/drive/folders/<id>?usp=sharing
        https://drive.google.com/drive/u/0/folders/<id>
        https://drive.google.com/open?id=<id>
        <id>

    The extracted value is validated against ``COA_FOLDER_ID_RE`` (H1) before it is
    returned, so an unparseable or hostile paste collapses to ``""`` rather than
    reaching the connector.
    """
    if not isinstance(raw, str):
        return ""
    value = raw.strip()
    if not value or len(value) > 2048:
        return ""

    candidate = ""
    if COA_FOLDER_ID_RE.match(value):
        candidate = value
    else:
        m = re.search(r"/folders/([^/?#]+)", value)
        if m:
            candidate = m.group(1)
        else:
            try:
                qs = parse_qs(urlparse(value).query)
                candidate = (qs.get("id") or [""])[0]
            except Exception:
                candidate = ""

    candidate = candidate.strip()
    return candidate if COA_FOLDER_ID_RE.match(candidate) else ""


def sanitize_coa(raw: Any) -> Dict[str, str]:
    """Validate a ``coa`` override → ``{"folder_id"}``; ``{}`` when unusable.

    ``{}`` means "no COA folder configured", which is what disables the feature for
    a bot — there is no separate on/off flag to drift out of sync with the folder.
    """
    if not isinstance(raw, dict):
        return {}
    folder_id = extract_folder_id(raw.get("folder_id"))
    return {"folder_id": folder_id} if folder_id else {}


def sanitize_overrides(raw: Any) -> Dict[str, Any]:
    """Full sanitise of an overrides dict for STORAGE (drops empty sub-sections).

    Storing only the populated keys keeps a freshly-defaulted bot's column NULL-ish
    (``{}``) and makes "reset to pack default" simply omitting a key.
    """
    base = coerce_overrides(raw)
    out: Dict[str, Any] = {}
    fields = sanitize_form_fields(base.get("sample_form"))
    if fields:
        out["sample_form"] = fields
    sink = sanitize_sample_sink(base.get("sample_sink"))
    if sink:
        out["sample_sink"] = sink
    coa = sanitize_coa(base.get("coa"))
    if coa:
        out["coa"] = coa
    return out


def effective_sample_form(pack: Any, overrides: Any) -> List[Dict[str, Any]]:
    """The sample-form fields actually in force: owner override if any, else pack.

    ``pack`` may be ``None`` (no vertical) — then there is no form at all.
    """
    fields = sanitize_form_fields(coerce_overrides(overrides).get("sample_form"))
    if fields:
        return fields
    if pack is None:
        return []
    return pack.sample_form_payload()


def effective_required_fields(pack: Any, overrides: Any) -> Tuple[str, ...]:
    """Names of the required fields in the EFFECTIVE form (server-side validation
    source of truth for ``/api/widget/sample-request``)."""
    return tuple(f["name"] for f in effective_sample_form(pack, overrides) if f.get("required"))


def effective_sample_sink(overrides: Any) -> Tuple[str, str]:
    """Resolve the spreadsheet sink from the PER-BOT override only (Phase 2.4).

    There is deliberately no global/env fallback: a platform-wide sink would push
    one tenant's submissions to a shared webhook (a cross-tenant leak), and the DB
    record + owner email/Slack already capture every lead. Returns ``(url, secret)``;
    ``("", "")`` when the bot has no sink configured (the caller's fire-and-forget
    sink then no-ops).
    """
    sink = sanitize_sample_sink(coerce_overrides(overrides).get("sample_sink"))
    return sink.get("url", ""), sink.get("secret", "")


def effective_coa_config(overrides: Any) -> str:
    """Resolve the COA Drive folder from the PER-BOT override only → folder ID or ``""``.

    Deliberately no pack default and no env fallback: a platform-wide folder would
    serve one tenant's certificates to another. ``""`` means the bot has no COA
    library, and every caller treats that as "feature off".

    Re-validates on the way out (H1) so a row hand-edited around the write path
    still cannot reach the Drive query.
    """
    return sanitize_coa(coerce_overrides(overrides).get("coa")).get("folder_id", "")
