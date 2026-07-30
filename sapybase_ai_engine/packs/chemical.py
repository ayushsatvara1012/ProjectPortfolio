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

from packs.schema import (
    CatalogTable,
    FormField,
    HubCard,
    Pack,
    QualificationSlot,
    Slot,
    TeaserRule,
    ToolSpec,
)

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
    Slot(
        "grade",
        required=False,
        description=(
            "Product grade (e.g. LR, AR, HPLC, Battery). Many products share one "
            "name/CAS across several grades with DIFFERENT sheets — pass the grade "
            "the visitor specified to fetch the exact one. For several grades, call "
            "the tool once per grade."
        ),
    ),
)

_SDS_SLOTS = (
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
    Slot(
        "grade",
        required=False,
        description=(
            "IGNORED — an SDS is per PRODUCT, not per grade, so grade never "
            "changes which sheet is returned. Kept only for backward "
            "compatibility with older calls; never ask the visitor for a "
            "grade before calling get_sds."
        ),
    ),
)

get_sds = ToolSpec(
    name="get_sds",
    description=(
        "Fetch the real Safety Data Sheet (SDS) for a product. The ONLY source of "
        "safety/hazard/handling information — never answer those from memory. An "
        "SDS is per PRODUCT, not per grade — never pass or ask for a grade."
    ),
    slots=_SDS_SLOTS,
)

get_coa = ToolSpec(
    name="get_coa",
    description=(
        "Look up a Certificate of Analysis (COA) for a specific BATCH the visitor "
        "already has — they read the code off a drum, label or invoice. Pass whatever "
        "they typed, verbatim, as `query`: a product code, a batch number, a product "
        "name, or several together. Do not reformat it, do not guess a batch, and do "
        "not ask which part is the code. Returns a status and a COUNT only — the "
        "certificates appear in a panel the visitor picks from, so never list "
        "filenames, never state a result, and never paste a link. A COA reports one "
        "batch's tested values: it is NOT a safety sheet (use get_sds) and NOT a "
        "product spec (use get_product_spec)."
    ),
    slots=(
        Slot("query", required=True,
             description="What the visitor typed — product code, batch number, or product name."),
    ),
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
        # get-sds-crash-fix-plan D10: repointed from the conversational "tool"
        # mini-form to the deterministic picker. input_label/prompt_template/
        # input_source stay set as the fallback the widget uses if
        # features.sds_picker is ever false for this company.
        action="sds_picker",
        input_label="Search products…",
        prompt_template="I need the Safety Data Sheet for {value}.",
        input_source="products",
        color="#F59E0B",  # amber — safety / hazard document
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
        color="#14B8A6",  # teal — science / lab
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
        color="#6366F1",  # indigo — commerce / trust
    ),
    HubCard(
        id="sample",
        label="Request a sample",
        subtitle="Try before you buy",
        icon="package",
        action="form",          # opens the structured sample form, not slot-filling
        form_id="sample",
        color="#8B5CF6",  # violet — physical product
    ),
    HubCard(
        id="ask",
        label="Ask a question",
        subtitle="Chat with the assistant",
        icon="message-circle",
        action="chat",
        color="#0EA5E9",  # sky — conversation
    ),
    HubCard(
        id="coa",
        label="Request COA",
        subtitle="Certificate of Analysis",
        icon="certificate",
        # coa-finder-plan Phase 3 — the certificate search panel. input_label /
        # prompt_template are the fallback the widget uses when
        # features.coa_picker is false (no Drive folder configured): the message
        # reaches get_coa, which answers not_configured and offers a handoff.
        # No input_source: D4 keeps COA isolated from the catalog, so the field
        # is free text (a batch number is not a product name).
        action="coa_picker",
        input_label="Product code or batch number",
        prompt_template="I need the Certificate of Analysis for {value}.",
        color="#10B981",  # emerald — certified / quality
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

# Phase 5 — qualification slots: the buyer facts the agent tries to learn over a
# chat so a lead reaches the owner already qualified. CONFIG, not code — the
# deterministic extractor (services/qualification.py) is keyed by these names, and
# the directive surfaces whichever are still UNKNOWN so the model can weave in AT
# MOST one natural discovery question. Order = rough priority to ask.
_QUALIFICATION_SLOTS = (
    QualificationSlot(
        "application", "Application / intended use",
        "What will you be using it for?",
    ),
    QualificationSlot(
        "monthly_volume", "Monthly volume",
        "Roughly how much do you need per month?",
    ),
    QualificationSlot(
        "industry", "Industry",
        "What industry are you in?",
    ),
    QualificationSlot(
        "delivery_city", "Delivery city",
        "Which city should we deliver to?",
    ),
    QualificationSlot(
        "timeline", "Purchase timeline",
        "When are you looking to buy?",
    ),
)

_CATALOG_TABLES = (
    CatalogTable(
        table_name="products",
        required_columns=("name", "cas_number"),
        not_null_columns=("name",),
        # Coarser than product_skus (product+grade, not per-pack). A combined
        # price+SDS sheet fans out here only when it carries an SDS column
        # (secondary_requires), collapsed to one row per product+grade with all
        # pack sizes gathered into `packaging`.
        grain=("name", "cas_number", "grade"),
        aggregate_columns=("packaging",),
        secondary_requires=("sds_ref",),
        synonyms={
            "name": ("product", "product_name", "chemical", "chemical_name",
                     "item", "item_name", "material"),
            "cas_number": ("cas", "cas_no", "cas_number", "cas_#", "cas_num",
                           "casno", "cas_registry", "cas_rn"),
            "grade": ("grade", "purity", "spec", "specification"),
            "packaging": ("packaging", "pack", "pack_size", "packing",
                          "available_sizes", "sizes", "pack_sizes"),
            "sds_ref": ("sds_ref", "sds", "sds_url", "sds_link", "msds",
                        "msds_url", "safety_data_sheet", "datasheet_url"),
        },
    ),
    CatalogTable(
        table_name="product_skus",
        required_columns=("product_name", "cas_number", "grade", "pack_size", "list_price"),
        boolean_columns=("is_por",),
        not_null_columns=("product_name",),
        # A "POR" in the price column means price-on-request, not a missing price:
        # flag it so the agent routes to a human quote instead of treating it as
        # "no price on file".
        por_flag_from=("list_price", "is_por"),
        synonyms={
            "product_name": ("product", "product_name", "name", "chemical",
                             "chemical_name", "item", "material"),
            "cas_number": ("cas", "cas_no", "cas_number", "cas_#", "casno",
                           "cas_registry", "cas_rn"),
            "grade": ("grade", "purity", "spec", "specification"),
            "pack_code": ("pack_code", "sku", "sku_code", "code", "item_code"),
            "pack_size": ("pack_size", "size", "pack", "packing", "packaging"),
            "pack_size_norm": ("pack_size_norm", "size_norm", "normalized_size"),
            "list_price": ("list_price", "price", "rate", "mrp", "unit_price",
                           "cost", "amount", "selling_price"),
            "gst_rate": ("gst_rate", "gst", "gst_%", "tax", "tax_rate", "gst_percent"),
            "hsn_code": ("hsn_code", "hsn", "hsn_sac", "hsn_no"),
            "is_por": ("is_por", "por", "price_on_request", "on_request"),
            "currency": ("currency", "curr", "ccy"),
        },
    ),
)

# Phase 2 — seeded, page-aware teaser copy. Ordered: first URL match wins, so
# the most specific / highest-intent pages come first. Owner-editable later
# (Phase 3); until then these give a chemical bot contextual copy with zero setup.
_TEASER_RULES = (
    TeaserRule(
        id="pricing",
        match="/pricing",
        page="pricing",
        title="Want the best price?",
        subtext="Tell me your quantity and grade — I'll check for you.",
    ),
    TeaserRule(
        id="products",
        match="/products",
        page="products",
        title="Looking for a product?",
        subtext="Ask me for grades, pack sizes, SDS or a quote.",
    ),
    TeaserRule(
        id="contact",
        match="/contact",
        page="contact",
        title="Prefer to talk?",
        subtext="I can take your details right here.",
    ),
)

CHEMICAL_PACK = Pack(
    vertical=CHEMICAL_VERTICAL,
    persona_prompt=_PERSONA_PROMPT,
    tools=(get_sds, get_coa, get_product_spec, request_quote, request_sample),
    hub_cards=_HUB_CARDS,
    sample_form=_SAMPLE_FORM,
    knowledge_kinds=("catalog", "sds"),
    catalog_tables=_CATALOG_TABLES,
    qualification_slots=_QUALIFICATION_SLOTS,
    teaser_rules=_TEASER_RULES,
    version=1,
)
