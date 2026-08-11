"""What the visitor has already told us, and never asking for it twice (rule 6).

docs/agent-runtime-restructure-plan.md §1.3 rule 6 / Phase 4. The session store
already persists per-conversation state; what was missing was any structure over it,
so "never ask for something already given in this conversation" was a line in the
prompt that nothing could enforce. This module is that structure: harvest slots from
what the visitor said and what the tools resolved, backfill them into later tool
calls, and flag a question the conversation has already answered.

Pure over dicts - no DB, no model. The caller owns persistence.
"""
from typing import Any, Dict, Iterable, Optional, Tuple

#: Slots a conversation can fill. Deliberately a flat, closed set: an open-ended
#: memory is how a bot starts "remembering" things it was never told.
SLOTS: Tuple[str, ...] = (
    "contact_name",
    "contact_email",
    "contact_phone",
    "company_name",
    "product_name",
    "cas_number",
    "grade",
    "pack_size",
    "quantity",
    "application",
)

#: Which capture key carries which slot, and under what field name. Tool results are
#: the strongest evidence available - the visitor said it and a lookup confirmed it.
_CAPTURE_SOURCES = {
    "quote": {"product": "product_name", "grade": "grade", "pack_size": "pack_size",
              "quantity": "quantity"},
    "spec": {"product": "product_name", "grade": "grade"},
    "sds": {"product": "product_name", "cas_number": "cas_number"},
}

_MAX_SLOT_LEN = 200


def _clean(value: Any) -> Optional[str]:
    if value is None or isinstance(value, bool):
        return None
    text = str(value).strip()
    return text[:_MAX_SLOT_LEN] if text else None


def remember(state: Optional[Dict[str, Any]], **slots: Any) -> Dict[str, Any]:
    """Merge newly-learned slots into the conversation's memory.

    Unknown slot names are ignored and empty values never overwrite a known one -
    a later turn that omits the grade must not erase the grade already given.
    """
    memory = dict((state or {}).get("slots") or {})
    for name, value in slots.items():
        if name not in SLOTS:
            continue
        cleaned = _clean(value)
        if cleaned is not None:
            memory[name] = cleaned
    out = dict(state or {})
    out["slots"] = memory
    return out


def known(state: Optional[Dict[str, Any]]) -> Dict[str, str]:
    """Everything this conversation has established, slot -> value."""
    return dict((state or {}).get("slots") or {})


def has(state: Optional[Dict[str, Any]], slot: str) -> bool:
    return bool(known(state).get(slot))


def missing(state: Optional[Dict[str, Any]], required: Iterable[str]) -> Tuple[str, ...]:
    """Which of ``required`` this conversation still has not been told - the input
    to rule 5 (ask ONE question at a time: ask for ``missing(...)[0]``)."""
    filled = known(state)
    return tuple(slot for slot in required if not filled.get(slot))


def harvest_tool_args(state: Optional[Dict[str, Any]], args: Dict[str, Any]) -> Dict[str, Any]:
    """Learn from what the model passed to a tool: those values came from the visitor."""
    return remember(state, **{k: v for k, v in (args or {}).items() if k in SLOTS})


def harvest_capture(state: Optional[Dict[str, Any]], captured: Dict[str, Any]) -> Dict[str, Any]:
    """Learn from what the tools actually resolved - a confirmed product beats the
    spelling the visitor typed."""
    learned: Dict[str, Any] = {}
    for key, mapping in _CAPTURE_SOURCES.items():
        payload = (captured or {}).get(key)
        if not isinstance(payload, dict):
            continue
        for field, slot in mapping.items():
            if payload.get(field):
                learned[slot] = payload[field]
    contact = ((captured or {}).get("quote") or {}).get("captured_contact")
    if isinstance(contact, dict):
        for field, slot in (("name", "contact_name"), ("email", "contact_email"),
                            ("phone", "contact_phone")):
            if contact.get(field):
                learned[slot] = contact[field]
    return remember(state, **learned)


def backfill(state: Optional[Dict[str, Any]], args: Dict[str, Any]) -> Dict[str, Any]:
    """Fill a tool call's blanks from memory before it runs.

    This is rule 6 where it actually bites: the model re-asks for the grade because
    it dropped it from the tool call, the tool answers ``needs_grade``, and the
    visitor is asked a question they already answered two turns ago.
    Values the model DID supply always win - the visitor may have changed their mind.
    """
    filled = known(state)
    out = dict(args or {})
    for slot in SLOTS:
        if not _clean(out.get(slot)) and filled.get(slot):
            out[slot] = filled[slot]
    return out


def redundant_slots(state: Optional[Dict[str, Any]], asked_for: Iterable[str]) -> Tuple[str, ...]:
    """Slots the reply is asking for that the conversation already knows - a rule 6
    violation the caller can catch before the question reaches the visitor."""
    filled = known(state)
    return tuple(slot for slot in asked_for if filled.get(slot))
