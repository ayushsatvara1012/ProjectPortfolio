"""Vertical packs — config-driven AI agent definitions, one per industry.

See docs/chemical-vertical-agent-plan.md. Public surface:
  - load_pack(vertical) -> Optional[Pack]   (the engine's single entry point)
  - normalize_vertical(value) -> Optional[str]
  - known_verticals() -> tuple[str, ...]
  - Pack / ToolSpec / Slot                  (the pack schema)
"""
from packs.registry import known_verticals, load_pack
from packs.schema import Pack, Slot, ToolSpec, normalize_vertical

__all__ = [
    "load_pack",
    "known_verticals",
    "normalize_vertical",
    "Pack",
    "ToolSpec",
    "Slot",
]
