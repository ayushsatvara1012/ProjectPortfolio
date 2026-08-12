"""What may never be published as public FAQ schema (plan §1.4, F2/F3).

The FAQ feed is crawlable by design - the endpoint deliberately does not enforce
``Origin`` - so anything eligible here becomes public content on the merchant's own
site. 12.5% of the historical pool was the bot's own failure text.

Two kinds of rule live here, and the split matters:

- **Tenant-independent**: refusals, internal error strings and widget artifacts are
  *our own* output. Identical for every client and every vertical, so they belong
  in this module.
- **Vertical-specific**: what counts as confidential is a property of the industry,
  never of this module. It arrives as a ``Pack`` - structurally via a tool marked
  ``restricted``, and as fallback vocabulary for turns with no tool trace. No
  ``if vertical == ...`` here or anywhere downstream.

Shared by the FAQ endpoint and scripts/faq_loop_audit.py so the gate and the
measurement of the gate can never disagree.
"""

from __future__ import annotations

import re
from typing import Any, Callable, Iterable, Optional, Sequence

SOURCE_MARKER_RE = re.compile(r"📎\s*source\s*:", re.IGNORECASE)

# Internal error and degrade strings the bot emits when a subsystem is down.
ERROR_STRINGS = (
    "i'm having trouble reaching",
    "i am having trouble reaching",
    "having trouble reaching our product system",
    "something went wrong",
    "please try again",
    "stream interrupted",
)

# True of the widget, meaningless as crawlable SEO text.
UI_ARTIFACTS = (
    "open in a panel",
    "should be open in a panel",
    "in the panel",
    "click the button below",
)

# Deliberately broad. `turn_state = 'ANSWERED'` is the real gate; this catches
# pre-restructure rows whose turn_state is NULL and cannot be trusted.
REFUSAL_STRINGS = (
    "i don't have",
    "i do not have",
    "i couldn't find",
    "i could not find",
    "no details on file",
    "don't have details",
    "not able to find",
    "i'm not able to",
)

# Batch / lot / order / invoice identifiers: one token carrying BOTH a letter and
# a digit, 5+ chars. Requiring a letter is what keeps CAS numbers (67-56-1) and
# plain quantities out; requiring a digit keeps ordinary uppercase words out.
# Vertical-independent: an identifier is identifier-shaped in any industry.
IDENTIFIER_RE = re.compile(
    r"\b(?=[A-Z0-9./-]*[A-Z])(?=[A-Z0-9./-]*[0-9])[A-Z0-9][A-Z0-9./-]{4,}\b"
)


def _has_any(text: str, needles: Iterable[str]) -> bool:
    low = (text or "").lower()
    return any(n in low for n in needles)


def _is_refusal(q: str, a: str) -> bool:
    return _has_any(a, REFUSAL_STRINGS)


def _is_error_string(q: str, a: str) -> bool:
    return _has_any(a, ERROR_STRINGS)


def _is_ui_artifact(q: str, a: str) -> bool:
    return _has_any(a, UI_ARTIFACTS)


def _has_source_marker(q: str, a: str) -> bool:
    return bool(SOURCE_MARKER_RE.search(a or ""))


def _has_identifier(q: str, a: str) -> bool:
    return bool(IDENTIFIER_RE.search(q or "")) or bool(IDENTIFIER_RE.search(a or ""))


# Rules that hold for every tenant and every vertical.
TENANT_INDEPENDENT_EXCLUSIONS: Sequence[tuple[str, Callable[[str, str], bool]]] = (
    ("refusal", _is_refusal),
    ("error_string", _is_error_string),
    ("ui_artifact", _is_ui_artifact),
    ("source_marker", _has_source_marker),
    ("identifier", _has_identifier),
)

# Class names the caller may see, for reporting. Pack-driven classes included.
EXCLUSION_CLASSES = tuple(name for name, _ in TENANT_INDEPENDENT_EXCLUSIONS) + (
    "restricted_tool",
    "restricted_topic",
)


def _vocab_pattern(vocab: Sequence[str]) -> Optional[re.Pattern]:
    """Word-bounded alternation. Substring matching would exclude legitimate copy -
    bare 'batch' kills 'full batch documentation', 'coa' kills 'coating'."""
    terms = [re.escape(v.strip()) for v in vocab if v and v.strip()]
    if not terms:
        return None
    return re.compile(r"\b(?:" + "|".join(terms) + r")\b", re.IGNORECASE)


def _used_restricted_tool(sources: Any, pack: Any) -> bool:
    """True when the turn's tool trace names a tool the pack marks restricted.

    ``sources`` is ``chat_logs.sources`` - a list of ``{"kind": "tool", "label": ...}``
    entries. ``None`` means "not recorded" (pre-migration row), which this cannot
    treat as safe; the vocabulary fallback is what covers those.
    """
    if not sources or pack is None:
        return False
    try:
        restricted = set(pack.restricted_tool_names())
    except AttributeError:
        return False
    if not restricted:
        return False
    for entry in sources:
        if not isinstance(entry, dict):
            continue
        if entry.get("kind") == "tool" and entry.get("label") in restricted:
            return True
    return False


def excluded_by(
    question: str,
    answer: str,
    pack: Any = None,
    sources: Any = None,
) -> list[str]:
    """Every class this pair trips. Empty means publishable.

    ``pack`` is the tenant's ``Pack`` (``None`` for a generic bot - then only the
    tenant-independent rules apply, which is correct: a generic bot has no tools
    and no vertical confidentiality model).
    """
    classes = [
        name for name, predicate in TENANT_INDEPENDENT_EXCLUSIONS
        if predicate(question, answer)
    ]

    if _used_restricted_tool(sources, pack):
        classes.append("restricted_tool")

    vocab = getattr(pack, "restricted_vocab", ()) if pack is not None else ()
    pattern = _vocab_pattern(vocab)
    if pattern and (pattern.search(question or "") or pattern.search(answer or "")):
        classes.append("restricted_topic")

    return classes


def is_publishable(
    question: str,
    answer: str,
    pack: Any = None,
    sources: Any = None,
) -> bool:
    return not excluded_by(question, answer, pack=pack, sources=sources)
