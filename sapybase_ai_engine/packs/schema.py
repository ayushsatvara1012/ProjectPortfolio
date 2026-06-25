"""Vertical-pack schema — the data shape that drives a vertical AI agent.

A "vertical pack" is *config, not a code fork*: one engine serves every industry,
and a pack declares what makes a vertical different — its persona, the tools the
agent may call, the slots each tool collects, the hub cards, and which knowledge
kinds feed it. See docs/chemical-vertical-agent-plan.md §3.

Phase 0 intentionally ships this as a versioned, code-reviewed *file* registry
(packs/*.py), not a DB table. It is promoted to a table only when owners
self-edit packs (Phase 6). These dataclasses are frozen so a pack is an immutable
value — packs are defined once at import time and never mutated at runtime.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import List, Optional, Tuple


@dataclass(frozen=True)
class HubCard:
    """One action card on the pack-driven hub (Phase 3, plan §10).

    A card is a discoverable shortcut to a capability. ``action`` decides what a
    tap does:
      - ``"tool"`` opens an inline slot mini-form (one ``input_label`` field) and,
        on submit, sends ``prompt_template`` with ``{value}`` substituted — which
        drives the agent loop to the card's ``tool``.
      - ``"chat"`` just drops the visitor into the normal chat input (no form).

    Cards are *config*: the widget renders whatever the pack supplies and never
    hardcodes a vertical. A no-pack (``vertical=NULL``) company has no cards, so
    no hub renders — the generic chat is untouched.
    """

    id: str
    label: str
    icon: str                       # Tabler outline icon name, e.g. "file-certificate"
    action: str = "tool"            # "tool" | "chat"
    subtitle: str = ""
    input_label: str = ""           # mini-form placeholder (action="tool")
    prompt_template: str = ""       # message sent on submit; "{value}" is substituted
    input_source: str = ""          # "" = free text; "products" = searchable catalog picker


@dataclass(frozen=True)
class Slot:
    """A single field a tool needs to collect before it can run.

    Example (get_sds): ``Slot("cas_number", required=False)`` — the agent prefers
    the CAS number as the precise key but can fall back to ``product_name``.
    """

    name: str
    required: bool = False
    description: str = ""


@dataclass(frozen=True)
class ToolSpec:
    """Declaration of an agent tool the pack enables.

    Phase 0 only *declares* tools (so the pack shape is real and testable); the
    deterministic logic + function-calling wiring lands in Phase 1+. A declared
    tool with no engine wiring is inert — nothing calls it yet.
    """

    name: str
    description: str
    slots: Tuple[Slot, ...] = ()

    def required_slots(self) -> Tuple[Slot, ...]:
        return tuple(s for s in self.slots if s.required)


@dataclass(frozen=True)
class Pack:
    """A vertical pack — the single source of truth for one industry's agent.

    ``vertical`` is the canonical slug stored in ``companies.vertical`` and is the
    key the registry looks up. Keep every per-vertical decision here; never branch
    on ``if vertical == '...'`` scattered through the engine (plan §3, "the
    discipline").
    """

    vertical: str
    persona_prompt: str
    tools: Tuple[ToolSpec, ...] = ()
    hub_cards: Tuple[HubCard, ...] = ()        # Phase 3 — pack-driven hub UI cards
    knowledge_kinds: Tuple[str, ...] = ()      # what doc kinds feed RAG/tools
    version: int = 1

    def tool_names(self) -> Tuple[str, ...]:
        return tuple(t.name for t in self.tools)

    def get_tool(self, name: str) -> Optional[ToolSpec]:
        for t in self.tools:
            if t.name == name:
                return t
        return None

    def hub_cards_payload(self) -> List[dict]:
        """JSON-serializable card list for the widget config (``/api/config``).

        Empty when the pack defines no cards — the widget then renders no hub and
        opens straight to chat. Card-launching tools are assumed declared in
        ``tools``; cards are authored alongside them in the pack file.
        """
        return [asdict(card) for card in self.hub_cards]


def normalize_vertical(value: object) -> Optional[str]:
    """Canonicalize a raw ``companies.vertical`` value to a registry key.

    Returns a lowercase, trimmed slug, or ``None`` when the value is absent or
    meaningless. ``None`` is the load-bearing "generic bot" signal: a NULL column,
    an empty string, whitespace, or a non-string DB value all collapse to ``None``
    so the engine takes the unchanged, pre-pack path. This never raises — a bad
    DB value must degrade to generic, never 500 a live widget.
    """
    if not isinstance(value, str):
        return None
    slug = value.strip().lower()
    return slug or None
