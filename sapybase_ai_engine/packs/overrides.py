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
from typing import Any, Dict, List, Optional, Tuple

# Mirror FormField.type (packs/schema.py). A field whose type isn't here is coerced
# to "text" rather than dropped — the safest visible fallback.
ALLOWED_FIELD_TYPES = ("text", "email", "tel", "number", "textarea", "product", "grade")

# Guard rails so a hostile / fat-fingered override can't bloat the form.
MAX_FIELDS = 30
MAX_NAME_LEN = 64
MAX_LABEL_LEN = 120
MAX_PLACEHOLDER_LEN = 160


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


def effective_sample_sink(overrides: Any, env_url: str, env_secret: str) -> Tuple[str, str]:
    """Resolve the spreadsheet sink: per-bot override wins, else the global env sink.

    Returns ``(url, secret)``; ``("", "")`` when neither is configured (the caller's
    fire-and-forget sink then no-ops).
    """
    sink = sanitize_sample_sink(coerce_overrides(overrides).get("sample_sink"))
    if sink.get("url"):
        return sink["url"], sink.get("secret", "")
    return (env_url or "").strip(), (env_secret or "").strip()
