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

from packs.schema import FormField, HubCard, Pack, Slot, ToolSpec

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

request_quote = ToolSpec(
    name="request_quote",
    description=(
        "Get a PRICE / quotation for a product. Pricing is per pack and needs the "
        "product, the grade, and the pack size; the tool says what to ask for if "
        "any is missing. NEVER state a price yourself — quote only what this tool "
        "returns. Some packs are price-on-request: collect the visitor's name and "
        "email so the team can follow up. Not for safety questions (use get_sds)."
    ),
    slots=(
        Slot("product_name", required=False,
             description="Product name (or use the CAS number)."),
        Slot("cas_number", required=False,
             description="CAS registry number — the precise product key."),
        Slot("grade", required=False,
             description="Grade/purity, e.g. LR, AR, HPLC. Required to price."),
        Slot("pack_size", required=False,
             description="Pack size, e.g. '500 ml', '2.5 Ltr'. Required to price."),
        Slot("quantity", required=False,
             description="Number of packs the visitor wants (defaults to 1)."),
        Slot("contact_name", required=False,
             description="Visitor's name (for price-on-request follow-up)."),
        Slot("contact_email", required=False,
             description="Visitor's email (for price-on-request follow-up)."),
        Slot("contact_phone", required=False,
             description="Visitor's phone (optional, for follow-up)."),
    ),
)

request_sample = ToolSpec(
    name="request_sample",
    description=(
        "Open the free-SAMPLE request form for the visitor. Call this whenever they "
        "want a product sample; it shows a short form they fill in (the team then "
        "ships and follows up). Pass the product name/CAS and grade if they "
        "mentioned them, so the form opens prefilled. Do NOT collect the fields "
        "yourself. Not for pricing (use request_quote) or safety (use get_sds)."
    ),
    slots=(
        Slot("product_name", required=False,
             description="Product name the visitor mentioned (prefills the form)."),
        Slot("cas_number", required=False,
             description="CAS registry number, if mentioned (prefills the form)."),
        Slot("grade", required=False,
             description="Grade/purity, if mentioned, e.g. LR, AR, HPLC (prefills)."),
    ),
)

# Phase 3 hub cards — only capabilities backed by a LIVE tool get a card. Stock
# (check_availability) and Quote land here once Phase 2b/4 ship; the widget shows
# whatever this tuple contains, so the hub grows by editing config, not the UI.
_HUB_CARDS = (
    HubCard(
        id="sds",
        label="Request SDS",
        subtitle="Get the official safety sheet",
        icon="file-certificate",
        action="tool",
        input_label="Search products…",
        prompt_template="I need the Safety Data Sheet for {value}.",
        input_source="products",
    ),
    HubCard(
        id="spec",
        label="Product specs",
        subtitle="Grade & packaging",
        icon="flask",
        action="tool",
        input_label="Search products…",
        prompt_template="What grade and packaging is available for {value}?",
        input_source="products",
    ),
    HubCard(
        id="quote",
        label="Get a quote",
        subtitle="Price for a product",
        icon="receipt",
        action="tool",
        input_label="Search products…",
        prompt_template="I'd like a price quote for {value}.",
        input_source="products",
    ),
    HubCard(
        id="sample",
        label="Request a sample",
        subtitle="Try before you buy",
        icon="package",
        action="form",          # opens the structured sample form, not slot-filling
        form_id="sample",
    ),
    HubCard(
        id="ask",
        label="Ask a question",
        subtitle="Chat with the assistant",
        icon="message-circle",
        action="chat",
    ),
)

# Phase 4b — the structured sample-request form. Fields are CONFIG (the customise
# section edits this list per client to mirror their current Google Form so the
# resulting spreadsheet columns line up). `product`/`grade` are catalog-aware.
_SAMPLE_FORM = (
    FormField("product", "Product", type="product", required=True,
              placeholder="Search products…"),
    FormField("grade", "Grade", type="grade", required=True,
              placeholder="Select a grade"),
    FormField("quantity", "Quantity (units)", type="number", required=True,
              placeholder="e.g. 1"),
    FormField("contact_name", "Full name", type="text", required=True),
    FormField("company", "Company name", type="text", required=True),
    FormField("contact_email", "Work email", type="email", required=True),
    FormField("contact_phone", "Phone", type="tel", required=False),
    FormField("address", "Shipping address", type="textarea", required=True,
              placeholder="Where should we ship the sample?"),
    FormField("application", "Application / intended use", type="textarea",
              required=False),
    FormField("notes", "Additional notes", type="textarea", required=False),
)

CHEMICAL_PACK = Pack(
    vertical=CHEMICAL_VERTICAL,
    persona_prompt=_PERSONA_PROMPT,
    tools=(get_sds, get_product_spec, request_quote, request_sample),
    hub_cards=_HUB_CARDS,
    sample_form=_SAMPLE_FORM,
    knowledge_kinds=("catalog", "sds"),
    version=1,
)
