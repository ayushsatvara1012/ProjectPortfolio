"""Untrusted text on its way into a prompt (audit C1 / QF13's sibling QF7).

docs/bot-output-quality-plan.md §11 phase 5. The current visitor message was
already wrapped in `<user_query>` delimiters, but nothing enforced the two things
that make a delimiter mean anything:

  * the content could contain the closing tag and end the block early;
  * conversation history arrived from the CLIENT, with an arbitrary `role` string,
    and anything that was not exactly `'user'` was turned into an assistant
    message - so a caller could author the assistant's side of the conversation.

Both are fixed here rather than at the call site so the current message, the
client-sent history and the server-side session store all get the same treatment.
This is §7.1's layer 3: RULE 1 tells the model to treat visitor text as data, and
this makes it structurally true.
"""
from __future__ import annotations

import re
from typing import Any, Iterable, List, Optional, Tuple

#: What the client may claim a history entry is, mapped to what it becomes.
#: The widget sends `bot`; the server-side session store writes `assistant`. Both
#: are the same thing to the model, and both are named explicitly - an allowlist
#: that has to guess is not an allowlist.
_ROLE_ALIASES = {
    "user": "user",
    "human": "user",
    "assistant": "assistant",
    "bot": "assistant",
    "ai": "assistant",
}

#: Tags the prompt itself uses as structure. If untrusted text may contain them
#: verbatim, the delimiter is decoration rather than a boundary.
_RESERVED_TAGS = ("user_query", "prior_session_context", "system", "instructions",
                  "instruction", "tool_result", "tool_call")

_RESERVED_TAG_RE = re.compile(
    r"</?\s*(?:" + "|".join(_RESERVED_TAGS) + r")\s*/?>", re.IGNORECASE)

#: Control characters carry no meaning in a chat message and are a classic way to
#: smuggle structure past a naive filter. Tab and newline are legitimate.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

#: Defensive cap. `ChatMessage.content` is already bounded at 4000 by Pydantic;
#: this bounds anything that did not come through that model.
MAX_HISTORY_CHARS = 4000

#: How many prior turns may reach the model from an untrusted source.
MAX_HISTORY_ITEMS = 8


def normalise_role(role: Any) -> Optional[str]:
    """``'user'``/``'assistant'`` for a recognised role, else ``None``.

    ``None`` means DROP the message, not "treat it as assistant". The old
    behaviour - `if role == 'user' ... else assistant` - handed anyone who could
    post an arbitrary role string the ability to write the assistant's lines.
    """
    if not isinstance(role, str):
        return None
    return _ROLE_ALIASES.get(role.strip().lower())


def sanitize_untrusted(text: Any, *, limit: int = MAX_HISTORY_CHARS) -> str:
    """Text that can be placed inside a delimited block without escaping it."""
    if not isinstance(text, str):
        return ""
    cleaned = _CONTROL_CHARS_RE.sub("", text)
    # Defanged rather than deleted: the model should still see that something
    # tag-shaped was said, because silently vanishing text reads as a bug when a
    # visitor legitimately pastes markup.
    cleaned = _RESERVED_TAG_RE.sub(lambda m: m.group(0).replace("<", "&lt;").replace(">", "&gt;"),
                                   cleaned)
    return cleaned[:limit].strip()


def delimit(text: Any, tag: str = "user_query") -> str:
    """Wrap untrusted text in a block it cannot break out of."""
    return f"<{tag}>\n{sanitize_untrusted(text)}\n</{tag}>"


def safe_history(items: Iterable[Any], *,
                 limit: int = MAX_HISTORY_ITEMS) -> List[Tuple[str, str]]:
    """``(role, content)`` pairs fit to become prompt messages.

    Accepts dicts (the session store) or objects with ``.role``/``.content``
    (the Pydantic request model). Entries with an unrecognised role or empty
    content are dropped, not coerced.
    """
    out: List[Tuple[str, str]] = []
    for item in list(items or [])[-limit:]:
        if isinstance(item, dict):
            raw_role, raw_content = item.get("role"), item.get("content")
        else:
            raw_role, raw_content = getattr(item, "role", None), getattr(item, "content", None)
        role = normalise_role(raw_role)
        if role is None:
            continue
        content = sanitize_untrusted(raw_content)
        if not content:
            continue
        out.append((role, content))
    return out
