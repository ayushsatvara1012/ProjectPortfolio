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
      - ``"form"`` opens a structured multi-field intake form (Phase 4b) named by
        ``form_id`` — e.g. the sample request form. Submitting it posts directly to
        a deterministic endpoint (no LLM), so the flow can't loop or time out.
      - ``"sds_picker"`` (get-sds-crash-fix-plan Phase 5, D10) opens the
        deterministic Get-SDS product picker instead of a conversational
        mini-form — the widget fetches the product list itself from
        ``/api/widget/sds-products``. ``input_label``/``prompt_template``/
        ``input_source`` are kept on the card as a fallback: if
        ``features.sds_picker`` is ever false for a company, the widget
        degrades this card to the old ``"tool"`` mini-form behaviour instead
        of breaking.

    Cards are *config*: the widget renders whatever the pack supplies and never
    hardcodes a vertical. A no-pack (``vertical=NULL``) company has no cards, so
    no hub renders — the generic chat is untouched.
    """

    id: str
    label: str
    icon: str                       # Tabler outline icon name, e.g. "file-certificate"
    action: str = "tool"            # "tool" | "chat" | "form" | "sds_picker"
    subtitle: str = ""
    input_label: str = ""           # mini-form placeholder (action="tool")
    prompt_template: str = ""       # message sent on submit; "{value}" is substituted
    input_source: str = ""          # "" = free text; "products" = searchable catalog picker
    form_id: str = ""               # which structured form to open (action="form")
    color: str = ""                 # hex accent for this card's Home tile; "" = default theme color
    disabled: bool = False          # renders dimmed, non-tappable, "Coming soon" badge


@dataclass(frozen=True)
class FormField:
    """One field in a structured intake form (Phase 4b, plan §10).

    Forms are *config*, customizable per client (the "customise section"): a client
    edits this list to mirror the exact fields their current Google Form collects,
    so the resulting spreadsheet columns line up 1:1. ``type`` tells the widget how
    to render it; ``product``/``grade`` are catalog-aware (a searchable product
    picker and a grade dropdown derived from the chosen product).
    """

    name: str                       # submission key, e.g. "contact_email"
    label: str                      # visible label
    type: str = "text"              # text|email|tel|number|textarea|product|grade
    required: bool = False
    placeholder: str = ""


@dataclass(frozen=True)
class CatalogTable:
    """Maps an uploaded sheet to a structured DB table for auto-import.

    When a vertical bot uploads a tabular file, sheets whose columns match
    ``required_columns`` are imported into ``table_name`` (replace-all) instead
    of being embedded as RAG knowledge.

    Real client spreadsheets are dirty, so matching is *forgiving*:
      - ``synonyms`` maps a canonical DB column to the header aliases clients use
        (e.g. ``cas_number`` ← ``CAS #``, ``CAS No``). Header names are normalized
        (lowercase, trimmed, punctuation→``_``) before lookup, and a column's own
        name is always an implicit alias.
      - ``not_null_columns`` are the fields a row MUST have a value for; a row
        missing any is skipped with a reason (never crashes on a NOT-NULL insert).
      - ``boolean_columns`` are parsed from ``TRUE``/``yes``/``Y``/``1`` etc.

    ``column_map`` is the legacy direct ``normalized_header → db_col`` escape hatch;
    ``synonyms`` is the preferred, readable form.

    Fan-out (one wide sheet → several tables):
      - ``grain`` collapses cleaned rows to one row per distinct grain-tuple, for a
        table that sits at a coarser level than the sheet (e.g. ``products`` is
        keyed product+grade while a price sheet is one row per pack). Empty = keep
        every row.
      - ``aggregate_columns`` are, within a grain group, set to the distinct-joined
        (", ") set of the group's values (e.g. ``packaging`` = every pack size for
        that product+grade). Non-grain, non-aggregate columns take the group's
        first non-null value.
      - ``secondary_requires`` gates fan-out: when this table is NOT the most
        specific full match for a sheet, it is imported only if ALL of these
        canonical columns resolved from the sheet (so a price-only sheet with no
        SDS column never touches ``products`` and can't clobber it). Empty = never
        imported as a secondary target (it must be the primary match).

    ``por_flag_from = (price_col, flag_col)`` records a "price on request" signal:
    a row whose ``price_col`` cell reads POR / "on request" sets ``flag_col`` TRUE
    (even when the sheet has no explicit flag column), while a merely blank/missing
    price does not. Lets the agent tell "price on request" apart from "no price on
    file". Empty = no POR inference.
    """

    table_name: str
    required_columns: Tuple[str, ...]
    column_map: dict = field(default_factory=dict)
    boolean_columns: Tuple[str, ...] = ()
    synonyms: dict = field(default_factory=dict)        # db_col -> (alias, ...)
    not_null_columns: Tuple[str, ...] = ()
    grain: Tuple[str, ...] = ()                          # dedup key for a coarse table
    aggregate_columns: Tuple[str, ...] = ()             # distinct-joined within a grain group
    secondary_requires: Tuple[str, ...] = ()            # fan-out gate for a non-primary target
    por_flag_from: Tuple[str, str] = ()                 # (price_col, flag_col): POR price -> flag TRUE


@dataclass(frozen=True)
class TeaserRule:
    """One page-aware teaser line for the launcher bubble (Phase 2, plan §Content).

    A pack ships an ORDERED default rule set so contextual copy works with zero
    owner setup. The loader picks the first rule that matches the visitor's page
    (precedence: explicit ``page`` tag from ``SapybaseConfig.page`` -> URL
    ``match`` -> the always-present default teaser). Rules are pure config; the
    matching runs client-side in the loader, so there is no runtime model cost.

      id       — stable slug for analytics (which rule converted); unique per pack.
      match    — URL path token, first-match-wins, segment-aware substring
                 (``/products`` also fires on ``/en/products``). Empty = page-tag
                 only.
      page     — optional ``SapybaseConfig.page`` value that force-selects this
                 rule regardless of URL (for installs whose URLs hide page type).
      title    — bold line; ``{botName}`` is substituted server-side.
      subtext  — muted second line; optional.
    """

    id: str
    match: str
    title: str
    subtext: str = ""
    page: str = ""


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
class QualificationSlot:
    """One buyer fact the agent should try to learn over a conversation (Phase 5).

    Qualification is *goal-based, not scripted*: the pack declares WHAT is worth
    knowing (application, volume, industry, …) and the engine surfaces the
    still-UNKNOWN slots to the model, which weaves at most one natural discovery
    question into a reply when it fits — it never interrogates and never blocks an
    answer on collecting a fact. The extraction that fills these deterministically
    lives in ``services/qualification.py`` (keyed by ``name``), kept out of this
    frozen value so the regexes stay unit-testable and the pack stays pure config.

      name      — stable key, also the ``lead_profile['qualification']`` sub-key.
      label     — owner-facing display (request panels) + the fact's human name.
      question  — an EXAMPLE discovery question, guidance only; the model phrases
                  its own in context and is told never to ask more than one.
    """

    name: str
    label: str
    question: str = ""


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
    sample_form: Tuple[FormField, ...] = ()    # Phase 4b — structured sample intake form
    knowledge_kinds: Tuple[str, ...] = ()      # what doc kinds feed RAG/tools
    catalog_tables: Tuple[CatalogTable, ...] = ()  # structured tables for auto-import
    qualification_slots: Tuple[QualificationSlot, ...] = ()  # Phase 5 — buyer facts to learn
    teaser_rules: Tuple[TeaserRule, ...] = ()  # Phase 2 — seeded page-aware teaser copy
    version: int = 1

    def tool_names(self) -> Tuple[str, ...]:
        return tuple(t.name for t in self.tools)

    def qualification_slot_names(self) -> Tuple[str, ...]:
        return tuple(s.name for s in self.qualification_slots)

    def get_qualification_slot(self, name: str) -> Optional[QualificationSlot]:
        for s in self.qualification_slots:
            if s.name == name:
                return s
        return None

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

    def sample_form_payload(self) -> List[dict]:
        """JSON-serializable field list for the widget config (``/api/config``).

        Empty when the pack defines no form. The widget renders these fields in
        order; the submit endpoint validates the same list server-side."""
        return [asdict(f) for f in self.sample_form]

    def required_form_fields(self) -> Tuple[str, ...]:
        """Names of the form fields that must be present on submit (server-side
        validation source of truth — the widget mirrors this)."""
        return tuple(f.name for f in self.sample_form if f.required)

    def teaser_rules_payload(self) -> List[dict]:
        """JSON-serializable seeded teaser rules for the widget config.

        Empty when the pack defines none — the loader then shows only the always-
        present default teaser. Sanitized + ``{botName}``-substituted downstream
        in ``services/teaser.py`` before it reaches the loader."""
        return [asdict(rule) for rule in self.teaser_rules]


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
