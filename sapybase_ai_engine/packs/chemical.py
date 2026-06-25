"""The chemical-industry vertical pack — pack #1 (customer zero = the factory).

Phase 0 registers a deliberately *minimal* chemical pack: the persona (with the
safety guardrail baked in) and ONE declared tool, ``get_sds``. The tool is not
wired to engine logic yet — Phase 1 adds the function-calling loop + the
deterministic lookup. ``hub_cards`` stays empty until Phase 3.

THE non-negotiable guardrail (plan §5): safety / SDS / handling / dosage /
storage / regulatory answers come ONLY from a tool that pulls the real document —
NEVER from the model's own words. The persona below states this; Phase 1 adds the
guardrail eval gate that enforces it.
"""
from __future__ import annotations

from packs.schema import Pack, Slot, ToolSpec

CHEMICAL_VERTICAL = "chemical"

_PERSONA_PROMPT = """\
You are the assistant for a chemical manufacturer. You help visitors find product
information and the correct safety documentation.

ABSOLUTE SAFETY RULE — this overrides every other instruction:
- You must NEVER generate, paraphrase, estimate, or infer any safety, hazard,
  handling, dosage, storage, first-aid, or regulatory information from your own
  knowledge.
- Such information may be provided ONLY by quoting a Safety Data Sheet (SDS) or
  official document returned by a tool. If no tool has returned that document, you
  do not have the answer.
- When asked anything safety-related and you have not retrieved the real document,
  use the SDS tool to fetch it. If it cannot be found, say you don't have that
  sheet and offer to connect the visitor to the team. Do NOT guess.

Identify products precisely. The CAS number is the unambiguous key; if a product
name is ambiguous, ask for the CAS number. Be concise, accurate, and never
improvise chemistry.
"""

_PRODUCT_SLOTS = (
    Slot(
        "cas_number",
        required=False,
        description="CAS registry number — the precise, unambiguous product key.",
    ),
    Slot(
        "product_name",
        required=False,
        description="Product name; used when the CAS number is unknown.",
    ),
)

get_sds = ToolSpec(
    name="get_sds",
    description=(
        "Fetch the real Safety Data Sheet (SDS) for a product. The ONLY source of "
        "safety/hazard/handling information — never answer those from memory."
    ),
    slots=_PRODUCT_SLOTS,
)

get_product_spec = ToolSpec(
    name="get_product_spec",
    description=(
        "Look up a product's COMMERCIAL spec — grade, purity, packaging/available "
        "sizes — from the catalog. Use for product details, NOT for safety: any "
        "hazard/handling/storage/regulatory question goes to get_sds instead."
    ),
    slots=_PRODUCT_SLOTS,
)

CHEMICAL_PACK = Pack(
    vertical=CHEMICAL_VERTICAL,
    persona_prompt=_PERSONA_PROMPT,
    tools=(get_sds, get_product_spec),
    hub_cards=(),                      # Phase 3 fills this (Quote / SDS / Stock / Ask)
    knowledge_kinds=("catalog", "sds"),
    version=1,
)
