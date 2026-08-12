"""Deterministic, LLM-free buyer-fact extraction for the qualification loop (Phase 5).

Pure functions — no I/O, no LLM, no external state. The agent's directive asks the
model to weave in AT MOST one natural discovery question; when the visitor answers,
THIS module turns that free-text answer into a stored ``lead_profile['qualification']``
fact WITHOUT a second model call. Owner-facing panels then show a lead's application,
volume, industry, city, and timeline attached to the request.

Design rule (mirrors ``lead_scoring``): **precision over recall.** A wrong fact in an
owner's CRM is worse than a blank — every extractor returns ``None`` unless a clear
cue matched, and it stores the matched span verbatim rather than inferring a canonical
value it can't be sure of. Fuzzy slots (application, city) require an explicit cue
phrase so a passing mention can't be mislabelled as a fact.

Extractors are keyed by the pack's ``qualification_slots`` names (chemical:
application, monthly_volume, industry, delivery_city, timeline) so the pack stays
pure config and the regexes stay unit-testable here.
"""
from __future__ import annotations

import re
from typing import Any, Callable, Dict, Optional

# ── shared helpers ───────────────────────────────────────────────────────────

_MAX_VALUE_LEN = 120        # a captured fact is a short phrase, never a paragraph


def _clean(span: str) -> str:
    """Trim, collapse whitespace, strip trailing punctuation, cap length."""
    s = re.sub(r"\s+", " ", (span or "")).strip()
    s = s.strip(" .,;:!?-–—\"'()")
    return s[:_MAX_VALUE_LEN].strip()


# ── industry ─────────────────────────────────────────────────────────────────
# Keyword → canonical label. High precision: these tokens are industry-specific
# enough that a match is a reliable signal. Longest phrases first so "water
# treatment" wins over a bare "water".
_INDUSTRY_KEYWORDS = (
    ("water treatment", "water treatment"),
    ("effluent", "water treatment"),
    ("personal care", "cosmetics"),
    ("food and beverage", "food & beverage"),
    ("food & beverage", "food & beverage"),
    ("pharmaceutical", "pharmaceutical"),
    ("pharma", "pharmaceutical"),
    ("cosmetic", "cosmetics"),
    ("textile", "textile"),
    ("dyeing", "textile"),
    ("paint", "paints & coatings"),
    ("coating", "paints & coatings"),
    ("agrochemical", "agrochemicals"),
    ("agro", "agrochemicals"),
    ("fertiliser", "agrochemicals"),
    ("fertilizer", "agrochemicals"),
    ("pesticide", "agrochemicals"),
    ("detergent", "detergents"),
    ("soap", "detergents"),
    ("rubber", "rubber"),
    ("polymer", "polymers & plastics"),
    ("plastic", "polymers & plastics"),
    ("construction", "construction"),
    ("electroplating", "electroplating"),
    ("plating", "electroplating"),
    ("battery", "battery"),
    ("adhesive", "adhesives"),
    ("leather", "leather"),
    ("ceramic", "ceramics"),
)


def extract_industry(text: str) -> Optional[str]:
    low = text.lower()
    for kw, canonical in _INDUSTRY_KEYWORDS:
        if kw in low:
            return canonical
    return None


# ── monthly_volume ───────────────────────────────────────────────────────────
# "<number> <unit> per month/pm/monthly". Requires an explicit monthly cadence so
# a bare pack-size ("500 ml") isn't mistaken for demand. Stores the matched span.
_VOL_UNIT = r"(?:kg|kgs|kilo(?:gram)?s?|ton(?:ne)?s?|mt|litre?s?|liter?s?|ltr?s?|l|ml|drum?s?|barrel?s?|bag?s?)"
_MONTHLY_CUE = r"(?:per\s+month|/\s*month|a\s+month|per\s+mnth|every\s+month|monthly|p\.?m\.?\b|/\s*mo\b)"
_VOLUME_RE = re.compile(
    r"(\d[\d,]*(?:\.\d+)?\s*" + _VOL_UNIT + r"s?)\s*"
    r"(?:[a-z\s]{0,12}?)?" + _MONTHLY_CUE,
    re.IGNORECASE,
)


def extract_monthly_volume(text: str) -> Optional[str]:
    m = _VOLUME_RE.search(text)
    if not m:
        return None
    qty = _clean(m.group(1))
    return f"{qty}/month" if qty else None


# ── delivery_city ────────────────────────────────────────────────────────────
# Requires BOTH a location/delivery cue AND a known industrial city, so a passing
# mention ("a Mumbai competitor") can't be logged as the delivery city. The city
# list is deliberately a curated set of major Indian chemical hubs — an unknown
# city yields None (the model keeps asking) rather than a guess.
_KNOWN_CITIES = {
    "mumbai", "navi mumbai", "thane", "vasai", "bhiwandi", "pune", "nagpur",
    "delhi", "new delhi", "gurgaon", "gurugram", "noida", "faridabad",
    "ahmedabad", "surat", "vapi", "ankleshwar", "vadodara", "baroda", "bharuch",
    "rajkot", "dahej", "gandhidham", "jhagadia", "panoli",
    "chennai", "coimbatore", "hyderabad", "bengaluru", "bangalore",
    "kolkata", "haldia", "jaipur", "kanpur", "lucknow", "ludhiana",
    "chandigarh", "indore", "bhopal", "nashik", "aurangabad", "kochi", "cochin",
    "visakhapatnam", "vizag", "hosur", "daman", "silvassa",
}
_CITY_CUE_RE = re.compile(
    r"(?:deliver(?:y|ed)?\s+(?:to|in|at)|ship(?:ping|ped)?\s+to|based\s+(?:in|out\s+of)"
    r"|located\s+(?:in|at)|located\s+near|we(?:'re| are)\s+in|our\s+(?:plant|factory|unit|office)"
    r"\s+(?:is\s+)?(?:in|at|near)|from|in|at|near)\s+([a-z][a-z\s]{1,28})",
    re.IGNORECASE,
)


def extract_delivery_city(text: str) -> Optional[str]:
    for m in _CITY_CUE_RE.finditer(text):
        tail = _clean(m.group(1)).lower()
        # The cued phrase may run past the city ("in surat gujarat") — scan its
        # leading words for a known city, longest (two-word) match first.
        words = tail.split()
        for span in (words[:2], words[:1]):
            cand = " ".join(span)
            if cand in _KNOWN_CITIES:
                return cand.title()
    return None


# ── timeline ─────────────────────────────────────────────────────────────────
# Purchase-urgency cues. Stored as a normalized bucket so panels can sort by it.
_TIMELINE_PATTERNS = (
    (re.compile(r"\b(asap|immediately|right away|urgent(?:ly)?|as soon as possible)\b", re.I), "urgent"),
    (re.compile(r"\b(today|this week|by (?:end of )?(?:this )?week|within (?:a|1|2|3|4|5|6|7) days)\b", re.I), "this week"),
    (re.compile(r"\b(this month|by (?:end of )?(?:this )?month|within (?:a|1|two|three|four|\d+) weeks?)\b", re.I), "this month"),
    (re.compile(r"\b(next month|in (?:a|1|two|three|1-2|2-3|\d+) months?|within (?:a|1|two|three|\d+) months?)\b", re.I), "1-3 months"),
    (re.compile(r"\b(just (?:looking|checking|browsing)|no rush|not urgent|exploring|planning (?:for )?(?:next|later))\b", re.I), "exploring"),
)


def extract_timeline(text: str) -> Optional[str]:
    for rx, bucket in _TIMELINE_PATTERNS:
        if rx.search(text):
            return bucket
    return None


# ── application / intended use ───────────────────────────────────────────────
# Fuzzy free-text: only captured behind an explicit "for/used in …" cue, and the
# span is bounded and cleaned. This is best-effort — a blank is fine (the model
# will ask again); it exists to catch clear answers like "for water treatment".
_APPLICATION_RE = re.compile(
    r"(?:use(?:d|s)?\s+(?:it\s+)?(?:for|in|as)|using\s+(?:it\s+)?(?:for|in|as)"
    r"|application\s+is|intended\s+(?:use|for)|it(?:'s| is)\s+for|need\s+(?:it\s+)?for"
    r"|to\s+(?:make|produce|manufacture|formulate))\s+([a-z0-9][a-z0-9\s/&\-]{2,60})",
    re.IGNORECASE,
)
# Stopwords that mean the cue caught filler, not a real application.
_APPLICATION_STOP = {"it", "you", "us", "me", "them", "this", "that", "sample",
                     "quote", "price", "the same", "our company", "my company"}


def extract_application(text: str) -> Optional[str]:
    m = _APPLICATION_RE.search(text)
    if not m:
        return None
    val = _clean(m.group(1))
    if not val or val.lower() in _APPLICATION_STOP or len(val) < 3:
        return None
    return val


# ── contact (phone / email) ──────────────────────────────────────────────────
# Identity, not a buyer fact — deliberately NOT in `_EXTRACTORS` below. That
# registry holds `lead_profile['qualification']` facts keyed by the pack's
# qualification_slots; contact details already have a home in `lead_profile`'s
# own name/email/phone, owned by `sales_funnel.build_lead_profile`. Mixing the
# two would put an identity into the qualification sub-dict, where the owner
# panel renders it as a fact chip instead of a contact.
#
# A chemical bot's chat is full of digit strings that are NOT phone numbers:
# CAS numbers (7758-11-4), batch/lot codes (100.26R016), HSN/GST codes,
# invoice/order numbers, pack sizes, prices. Same precision-over-recall
# discipline as the rest of this module — a missed phone just means the
# visitor gets asked again by the model; a false positive mails the owner a
# fake lead.

_DIGIT_CUE_REJECT = re.compile(
    r"\b(cas|batch|lot|hsn|gst|gstin|invoice|inv|order|po)\b", re.IGNORECASE)
_PHONE_CONTACT_CUE = re.compile(
    r"\b(mob(?:ile)?|phone|contact|whatsapp|call\s+me\s+on|reach\s+me\s+(?:at|on))\b",
    re.IGNORECASE)

# Strict Indian mobile shape: optional +91 / 0 prefix, then a clean 10-digit
# run starting 6-9 — not embedded in a longer digit run and not immediately
# touching a CAS/batch-style separator (-, ., /), so it can't be a slice of a
# longer identifier.
_PHONE_STRICT_RE = re.compile(
    r"(?<![\d\-./])(?:\+?91[\s-]?|0)?([6-9]\d{9})(?![\d\-./])")
# Relaxed shape, used ONLY right after an explicit contact cue: still a clean
# 10-digit run starting 6-9 (never a slice of a longer digit run), but
# tolerant of surrounding punctuation the strict pass would reject.
_PHONE_RELAXED_RE = re.compile(r"(?<!\d)([6-9]\d{9})(?!\d)")
_CONTACT_CONTEXT_WINDOW = 40


def extract_phone(text: str) -> Optional[str]:
    """An Indian mobile number in free text, high precision, or ``None``.

    Two passes: a strict shape match anywhere in the text, then — only if that
    found nothing — a relaxed match right after an explicit cue phrase
    ("mob", "call me on", ...). Either pass is dropped if a CAS/batch/HSN/GST/
    invoice/order cue appears within 40 characters, since that context means
    the digits are an identifier, not a phone number.
    """
    text = text or ""
    if not text.strip():
        return None

    for m in _PHONE_STRICT_RE.finditer(text):
        lo, hi = max(0, m.start() - _CONTACT_CONTEXT_WINDOW), m.end() + _CONTACT_CONTEXT_WINDOW
        if _DIGIT_CUE_REJECT.search(text[lo:hi]):
            continue
        return m.group(1)

    for cue in _PHONE_CONTACT_CUE.finditer(text):
        tail = text[cue.end():cue.end() + _CONTACT_CONTEXT_WINDOW]
        rm = _PHONE_RELAXED_RE.search(tail)
        if not rm:
            continue
        lo = cue.start() - _CONTACT_CONTEXT_WINDOW
        hi = cue.end() + rm.end() + _CONTACT_CONTEXT_WINDOW
        if _DIGIT_CUE_REJECT.search(text[max(0, lo):hi]):
            continue
        return rm.group(1)

    return None


# Search-then-verify: isolate a candidate substring, trim trailing sentence
# punctuation, then hold it to the SAME strict full-match shape
# the quote tool's `_EMAIL_SHAPE` applies to a model-supplied address (defined
# locally rather than imported, keeping this module's zero-dependency,
# pure-function discipline).
_EMAIL_SEARCH_RE = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
_EMAIL_SHAPE_RE = re.compile(r"\A[^@\s]+@[^@\s]+\.[^@\s]+\Z")


def extract_email(text: str) -> Optional[str]:
    """A well-shaped email address found in free text, or ``None``."""
    text = text or ""
    if not text.strip():
        return None
    m = _EMAIL_SEARCH_RE.search(text)
    if not m:
        return None
    candidate = m.group(0).strip(".,;:!?)>\"'")
    return candidate if _EMAIL_SHAPE_RE.match(candidate) else None


def extract_contact(text: str) -> Dict[str, str]:
    """Phone and/or email found in free text. Either key is independently
    optional; returns ``{}`` when neither is found. Identity, not a
    qualification fact — see the section header above for why this stays out
    of ``_EXTRACTORS``."""
    out: Dict[str, str] = {}
    phone = extract_phone(text)
    if phone:
        out["phone"] = phone
    email = extract_email(text)
    if email:
        out["email"] = email
    return out


# ── registry + public API ────────────────────────────────────────────────────

_EXTRACTORS: Dict[str, Callable[[str], Optional[str]]] = {
    "application": extract_application,
    "monthly_volume": extract_monthly_volume,
    "industry": extract_industry,
    "delivery_city": extract_delivery_city,
    "timeline": extract_timeline,
}


def extract_facts(text: str, slot_names) -> Dict[str, str]:
    """Run the extractor for each requested slot; return only confident matches.

    ``slot_names`` is the pack's ``qualification_slot_names()`` — a slot with no
    registered extractor is simply skipped (never raises). Never returns empty
    strings; a missing fact is an absent key.
    """
    text = text or ""
    if not text.strip():
        return {}
    out: Dict[str, str] = {}
    for name in slot_names or ():
        fn = _EXTRACTORS.get(name)
        if fn is None:
            continue
        try:
            val = fn(text)
        except Exception:
            val = None            # a bad regex must never break turn persistence
        if val:
            out[name] = val
    return out


def qualification_block(pack, lead_profile: Optional[Dict[str, Any]]) -> str:
    """The dynamic system block that makes qualification goal-based, not scripted.

    Lists the buyer facts already KNOWN (from ``lead_profile['qualification']``) and
    those still UNKNOWN, then tells the model to weave in AT MOST one natural
    discovery question when it fits — never interrogate, never block an answer on it.
    The model chooses which/when (that's the intelligence); prices/SDS still come
    only from tools.

    Returns "" when the pack declares no qualification slots (generic bots, and any
    non-chemical pack) so the caller can append unconditionally.
    """
    slots = getattr(pack, "qualification_slots", ()) or ()
    if not slots:
        return ""

    known = dict((lead_profile or {}).get("qualification") or {})
    known_lines, unknown_labels = [], []
    for s in slots:
        val = known.get(s.name)
        if val:
            known_lines.append(f"  - {s.label}: {val}")
        else:
            unknown_labels.append(f"{s.label} (e.g. \"{s.question}\")" if s.question else s.label)

    known_txt = "\n".join(known_lines) if known_lines else "  (none captured yet)"
    header = (
        "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "LEAD QUALIFICATION — LEARN THE BUYER (goal, not a script)\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "KNOWN buyer facts:\n" + known_txt + "\n"
    )
    if unknown_labels:
        body = (
            "STILL UNKNOWN: " + "; ".join(unknown_labels) + "\n"
            "Weave AT MOST ONE natural discovery question for a still-unknown fact "
            "into your reply, and only when it fits the conversation. NEVER "
            "interrogate, never stack multiple questions, and NEVER withhold or "
            "delay a product/price/SDS answer to collect a fact — answer first, ask "
            "second, and do NOT ask at all when this turn had no real answer to "
            "give (a tool returned nothing useful, or you're declining/escalating) "
            "— a discovery question right after a non-answer reads as evasive, not "
            "helpful. If the visitor ignores the question, do not repeat it. Do "
            "not ask about a fact already listed as known."
        )
    else:
        body = (
            "You already know the key facts above — do NOT ask further qualification "
            "questions; just help the buyer move forward."
        )
    return header + body


def merge_qualification(
    profile: Optional[Dict[str, Any]],
    facts: Optional[Dict[str, str]],
) -> Dict[str, Any]:
    """Fold newly-extracted facts into ``lead_profile['qualification']``.

    Non-destructive like ``build_lead_profile``: a later turn without a fact never
    clears one learned earlier; a re-answer overwrites with the fresh value. Returns
    a NEW profile dict (does not mutate the input). No-op when ``facts`` is empty.
    """
    profile = dict(profile or {})
    facts = {k: v for k, v in (facts or {}).items() if v}
    if not facts:
        return profile
    existing = dict(profile.get("qualification") or {})
    existing.update(facts)
    profile["qualification"] = existing
    return profile
