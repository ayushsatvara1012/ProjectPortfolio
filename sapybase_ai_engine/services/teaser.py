"""Contextual teaser bubble — config sanitization + widget payload (Phase 1).

The teaser is owner-authored copy rendered by the host-page loader
(public/sapybase-loader.js). Everything here is defensive: the stored
``companies.teaser_config`` JSONB may be NULL, a JSON string, or hold junk,
and the strings it carries end up on third-party pages — so they are cleaned
and length-capped on every read AND every write. The loader injects them via
``textContent`` only; the caps here are defense-in-depth, not the XSS gate.

See docs/contextual-teaser-plan.md (Phase 1 — static teaser).
"""
import json
import re

DEFAULT_TITLE = "Hi, I'm {botName}"
DEFAULT_SUBTEXT = "Need help getting started?"
DEFAULT_DELAY_MS = 5000
TITLE_MAX = 80
SUBTEXT_MAX = 140
DELAY_MIN_MS = 1000
DELAY_MAX_MS = 60000
RULE_ID_MAX = 64
MATCH_MAX = 200
PAGE_MAX = 40
RULES_MAX = 40

VALID_EVENTS = frozenset({"impression", "dismiss", "click"})

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]")
_RULE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")
_SLUG_STRIP_RE = re.compile(r"[^a-z0-9_-]+")


def _clean_text(value, max_len):
    """Plain-text cleaner: strip control chars, collapse whitespace, cap length.

    Returns None for anything that isn't a non-empty string after cleaning,
    so callers can treat None as "no override, use the default"."""
    if not isinstance(value, str):
        return None
    cleaned = _CONTROL_CHARS_RE.sub(" ", value)
    cleaned = " ".join(cleaned.split()).strip()
    if not cleaned:
        return None
    return cleaned[:max_len]


def _norm_match(value):
    """Normalize a URL-path match token: strip query/hash, lowercase, ensure a
    leading slash, drop a trailing slash. Returns None for empty/junk so a rule
    can be page-tag-only. Leading-slash + segment matching happens in the loader;
    keeping a leading slash here makes ``/products`` segment-safe vs ``/myproducts``."""
    m = _clean_text(value, MATCH_MAX)
    if not m:
        return None
    m = m.split("?", 1)[0].split("#", 1)[0].strip().lower()
    if not m:
        return None
    if not m.startswith("/"):
        m = "/" + m
    if len(m) > 1:
        m = "/" + m.strip("/")
    return m


def _derive_rule_id(token, seen):
    """Build a stable, unique [a-z0-9_-] rule id from a match/page token."""
    base = _SLUG_STRIP_RE.sub("-", (token or "").lower()).strip("-_")[:RULE_ID_MAX]
    base = base or "rule"
    rid = base
    n = 2
    while rid in seen:
        suffix = "-" + str(n)
        rid = base[: RULE_ID_MAX - len(suffix)] + suffix
        n += 1
    return rid


def _clean_rule(raw, seen_ids):
    """Sanitize one owner/seed rule dict. Returns None for a rule with no title
    or no target (neither ``match`` nor ``page``) — a rule that can never fire."""
    if not isinstance(raw, dict):
        return None
    title = _clean_text(raw.get("title"), TITLE_MAX)
    if not title:
        return None
    match = _norm_match(raw.get("match"))
    page = _clean_text(raw.get("page"), PAGE_MAX)
    page = page.lower() if page else None
    if not match and not page:
        return None
    rid = raw.get("id")
    if not (isinstance(rid, str) and _RULE_ID_RE.match(rid)) or rid in seen_ids:
        rid = _derive_rule_id(match or page, seen_ids)
    seen_ids.add(rid)
    out = {"id": rid, "title": title}
    subtext = _clean_text(raw.get("subtext"), SUBTEXT_MAX)
    if subtext:
        out["subtext"] = subtext
    if match:
        out["match"] = match
    if page:
        out["page"] = page
    return out


def coerce_rules(raw_list):
    """list -> ordered list of sanitized rule dicts (capped, unique ids)."""
    if not isinstance(raw_list, list):
        return []
    out = []
    seen = set()
    for item in raw_list:
        rule = _clean_rule(item, seen)
        if rule:
            out.append(rule)
        if len(out) >= RULES_MAX:
            break
    return out


def coerce_teaser_config(raw):
    """dict | JSON str | None -> sanitized dict holding only known keys.

    An empty dict means "all defaults" (enabled, default copy, 5s delay)."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (ValueError, TypeError):
            return {}
    if not isinstance(raw, dict):
        return {}
    out = {}
    if isinstance(raw.get("enabled"), bool):
        out["enabled"] = raw["enabled"]
    title = _clean_text(raw.get("title"), TITLE_MAX)
    if title:
        out["title"] = title
    subtext = _clean_text(raw.get("subtext"), SUBTEXT_MAX)
    if subtext:
        out["subtext"] = subtext
    delay = raw.get("delay_ms")
    if isinstance(delay, (int, float)) and not isinstance(delay, bool):
        out["delay_ms"] = int(min(max(delay, DELAY_MIN_MS), DELAY_MAX_MS))
    rules = coerce_rules(raw.get("rules"))
    if rules:
        out["rules"] = rules
    return out


def merge_teaser_update(existing_raw, updates):
    """Fold PATCH /api/company teaser fields into the stored config.

    ``updates`` holds only the keys the owner actually sent (exclude_unset):
    ``enabled`` (bool), ``title`` / ``subtext`` (str; blank clears the
    override so the copy falls back to the default)."""
    cfg = coerce_teaser_config(existing_raw)
    if "enabled" in updates and isinstance(updates["enabled"], bool):
        cfg["enabled"] = updates["enabled"]
    for key, max_len in (("title", TITLE_MAX), ("subtext", SUBTEXT_MAX)):
        if key in updates:
            cleaned = _clean_text(updates[key], max_len)
            if cleaned:
                cfg[key] = cleaned
            else:
                cfg.pop(key, None)
    return cfg


def build_teaser_payload(raw, bot_name):
    """The ``teaser`` object /api/config ships to the loader.

    ``{botName}`` is substituted server-side so the loader never templates
    strings. Enabled defaults to True — the teaser works with zero setup."""
    cfg = coerce_teaser_config(raw)
    name = (bot_name or "").strip() or "Sapy AI"
    title = cfg.get("title") or DEFAULT_TITLE
    subtext = cfg.get("subtext") or DEFAULT_SUBTEXT
    return {
        "enabled": cfg.get("enabled", True),
        "title": title.replace("{botName}", name)[:TITLE_MAX],
        "subtext": subtext.replace("{botName}", name)[:SUBTEXT_MAX],
        "delay_ms": cfg.get("delay_ms", DEFAULT_DELAY_MS),
    }


def build_teaser_rules(raw, pack_rules, bot_name):
    """The ordered ``teaser.rules`` array /api/config ships to the loader (Phase 2).

    Owner-authored rules stored in ``teaser_config`` win; a bot that hasn't
    authored any falls back to the pack's seeded per-vertical defaults. Every
    rule is sanitized and ``{botName}``-substituted server-side, so the loader
    just runs its pure matcher against them."""
    cfg = coerce_teaser_config(raw)
    rules = cfg.get("rules") or coerce_rules(pack_rules)
    if not rules:
        return []
    name = (bot_name or "").strip() or "Sapy AI"
    out = []
    for r in rules:
        item = {"id": r["id"], "title": r["title"].replace("{botName}", name)[:TITLE_MAX]}
        if r.get("subtext"):
            item["subtext"] = r["subtext"].replace("{botName}", name)[:SUBTEXT_MAX]
        if r.get("match"):
            item["match"] = r["match"]
        if r.get("page"):
            item["page"] = r["page"]
        out.append(item)
    return out


def owner_teaser_view(raw):
    """The editable view for the dashboard Customize page: raw overrides with
    the ``{botName}`` placeholder intact, empty string = "using the default"."""
    cfg = coerce_teaser_config(raw)
    return {
        "enabled": cfg.get("enabled", True),
        "title": cfg.get("title", ""),
        "subtext": cfg.get("subtext", ""),
    }


def normalize_event(event, rule_id):
    """Validate a widget analytics event. Raises ValueError on junk input."""
    if event not in VALID_EVENTS:
        raise ValueError(f"Unknown teaser event '{event}'.")
    if rule_id is None:
        return event, None
    if not isinstance(rule_id, str) or not _RULE_ID_RE.match(rule_id):
        raise ValueError("rule_id must be a short [a-zA-Z0-9_-] identifier.")
    return event, rule_id
