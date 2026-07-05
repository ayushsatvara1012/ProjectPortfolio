"""Vertical packs — config-driven AI agent definitions, one per industry.

See docs/chemical-vertical-agent-plan.md. Public surface:
  - load_pack(vertical) -> Optional[Pack]   (the engine's single entry point)
  - normalize_vertical(value) -> Optional[str]
  - known_verticals() -> tuple[str, ...]
  - Pack / ToolSpec / Slot                  (the pack schema)
"""
from packs.registry import known_verticals, load_pack
from packs.schema import Pack, QualificationSlot, Slot, ToolSpec, normalize_vertical
from packs.overrides import (
    coerce_overrides,
    effective_required_fields,
    effective_sample_form,
    effective_sample_sink,
    sanitize_overrides,
    sanitize_visitor_fields,
)

__all__ = [
    "load_pack",
    "known_verticals",
    "normalize_vertical",
    "Pack",
    "ToolSpec",
    "Slot",
    "QualificationSlot",
    # Phase 5 — per-company override merge (pack_defaults | company_overrides)
    "coerce_overrides",
    "sanitize_overrides",
    "effective_sample_form",
    "effective_required_fields",
    "effective_sample_sink",
    "sanitize_visitor_fields",
]
