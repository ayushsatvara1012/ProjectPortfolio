"""Tests for the vertical-pack layer (chemical-vertical-agent plan, Phase 0).

Pure-Python: the pack registry has no DB or network dependency. These lock the
two Phase 0 guarantees — (1) a vertical resolves to its pack, and (2) any
absent/unknown/malformed vertical safely degrades to None (the generic-bot path,
so existing NULL-vertical customers are never affected).
"""
from packs import (
    Pack,
    QualificationSlot,
    ToolSpec,
    known_verticals,
    load_pack,
    normalize_vertical,
)
from packs.chemical import CHEMICAL_PACK, CHEMICAL_VERTICAL


class TestNormalizeVertical:
    def test_trims_and_lowercases(self):
        assert normalize_vertical("  Chemical ") == "chemical"
        assert normalize_vertical("CHEMICAL") == "chemical"

    def test_blank_becomes_none(self):
        # NULL column, empty string, and whitespace all mean "generic bot".
        assert normalize_vertical(None) is None
        assert normalize_vertical("") is None
        assert normalize_vertical("   ") is None

    def test_non_string_becomes_none(self):
        # A non-string DB value must degrade to None, never raise.
        assert normalize_vertical(123) is None
        assert normalize_vertical(object()) is None


class TestLoadPack:
    def test_chemical_resolves(self):
        pack = load_pack("chemical")
        assert isinstance(pack, Pack)
        assert pack is CHEMICAL_PACK
        assert pack.vertical == "chemical"

    def test_case_and_whitespace_insensitive(self):
        assert load_pack("  CHEMICAL ") is CHEMICAL_PACK

    def test_none_and_blank_are_generic(self):
        # The load-bearing invariant: generic customers get None (no pack, no tools).
        assert load_pack(None) is None
        assert load_pack("") is None
        assert load_pack("   ") is None

    def test_unknown_vertical_is_generic(self):
        # A typo or an unshipped vertical must fall back to generic, not raise.
        assert load_pack("chemcal") is None
        assert load_pack("plumbing") is None

    def test_non_string_is_generic(self):
        assert load_pack(123) is None
        assert load_pack(object()) is None

    def test_known_verticals_includes_chemical(self):
        assert "chemical" in known_verticals()


class TestChemicalPack:
    def test_persona_bakes_in_safety_guardrail(self):
        # The non-negotiable guardrail must be present in the persona text.
        prompt = CHEMICAL_PACK.persona_prompt.lower()
        assert "sds" in prompt or "safety data sheet" in prompt
        assert "never" in prompt  # the forbiddance of model-generated safety info

    def test_declares_tools(self):
        # Phase 1 get_sds + Phase 2a get_product_spec + Phase 4a request_quote
        # + Phase 4b request_sample + COA finder Phase 2 get_coa.
        assert CHEMICAL_PACK.tool_names() == (
            "get_sds", "get_coa", "get_product_spec", "request_quote", "request_sample")
        for name in ("get_sds", "get_coa", "get_product_spec", "request_quote", "request_sample"):
            assert isinstance(CHEMICAL_PACK.get_tool(name), ToolSpec)

    def test_coa_tool_takes_the_visitors_words_verbatim(self):
        # COA finder D2 — there is no code/batch/grade split here on purpose. The
        # whole design rests on NOT deciding which token means what, so a slot per
        # field would reintroduce the filename grammar the plan rejects.
        tool = CHEMICAL_PACK.get_tool("get_coa")
        assert {s.name for s in tool.slots} == {"query"}
        assert tool.slots[0].required is True

    def test_coa_tool_is_distinguished_from_sds_and_spec(self):
        # A COA reports one batch's tested values; conflating it with the safety
        # sheet would route a hazard question at a certificate.
        description = CHEMICAL_PACK.get_tool("get_coa").description
        assert "get_sds" in description and "get_product_spec" in description

    def test_sample_tool_is_a_form_launcher(self):
        # Phase 4b form: request_sample only carries prefill hints — collection is
        # the structured form, not conversational slots.
        tool = CHEMICAL_PACK.get_tool("request_sample")
        slot_names = {s.name for s in tool.slots}
        assert slot_names == {"product_name", "cas_number", "grade"}


class TestQualificationSlots:
    """Phase 5 — qualification slots are declared as pack config, not code."""

    def test_chemical_declares_the_five_slots(self):
        assert CHEMICAL_PACK.qualification_slot_names() == (
            "application", "monthly_volume", "industry", "delivery_city", "timeline")

    def test_every_slot_has_a_label_and_example_question(self):
        for slot in CHEMICAL_PACK.qualification_slots:
            assert isinstance(slot, QualificationSlot)
            assert slot.label.strip()
            assert slot.question.strip()

    def test_get_qualification_slot_by_name(self):
        slot = CHEMICAL_PACK.get_qualification_slot("monthly_volume")
        assert slot is not None and slot.label == "Monthly volume"
        assert CHEMICAL_PACK.get_qualification_slot("nope") is None

    def test_generic_pack_has_no_qualification_slots(self):
        # A pack that declares none must degrade cleanly (empty tuple, no None).
        empty = Pack(vertical="x", persona_prompt="p")
        assert empty.qualification_slots == ()
        assert empty.qualification_slot_names() == ()
        assert empty.get_qualification_slot("application") is None

    def test_sample_form_fields_and_required(self):
        names = [f["name"] for f in CHEMICAL_PACK.sample_form_payload()]
        # Catalog-aware product+grade, plus the contact/shipping intake set.
        assert {"product", "grade", "quantity", "contact_name", "company",
                "contact_email", "address"} <= set(names)
        required = set(CHEMICAL_PACK.required_form_fields())
        assert {"product", "grade", "contact_email", "address"} <= required
        # Optional fields are not required.
        assert "notes" not in required and "application" not in required
        # The product/grade fields are catalog-aware types.
        by_name = {f["name"]: f for f in CHEMICAL_PACK.sample_form_payload()}
        assert by_name["product"]["type"] == "product"
        assert by_name["grade"]["type"] == "grade"

    def test_quote_tool_collects_pricing_slots(self):
        tool = CHEMICAL_PACK.get_tool("request_quote")
        slot_names = {s.name for s in tool.slots}
        assert {"product_name", "cas_number", "grade", "pack_size", "quantity"} <= slot_names
        # Pricing collects contact for the price-on-request follow-up path.
        assert "contact_email" in slot_names

    def test_product_tool_slots_cover_cas_and_name(self):
        for name in ("get_sds", "get_product_spec"):
            tool = CHEMICAL_PACK.get_tool(name)
            slot_names = {s.name for s in tool.slots}
            assert {"cas_number", "product_name"} <= slot_names

    def test_hub_cards_present_and_only_for_live_tools(self):
        # Phase 3: cards are declared; every "tool" card must map to a tool the
        # pack actually enables (no card for an unbuilt capability).
        cards = CHEMICAL_PACK.hub_cards
        assert len(cards) >= 1
        ids = {c.id for c in cards}
        assert {"sds", "spec", "ask"} <= ids
        live_tools = set(CHEMICAL_PACK.tool_names())
        card_by_id = {c.id: c for c in cards}
        # D10: "sds" is repointed to the deterministic picker, but keeps its
        # tool-card fields as the fallback if features.sds_picker is ever false.
        assert card_by_id["sds"].action == "sds_picker" and "get_sds" in live_tools
        assert card_by_id["sds"].input_source == "products"
        assert card_by_id["spec"].action == "tool" and "get_product_spec" in live_tools
        assert card_by_id["quote"].action == "tool" and "request_quote" in live_tools
        # Phase 4b: sample is a FORM card (opens the structured form), not slot-filling.
        assert card_by_id["sample"].action == "form" and card_by_id["sample"].form_id == "sample"
        assert "request_sample" in live_tools
        assert card_by_id["ask"].action == "chat"  # chat card needs no tool
        # coa-finder-plan Phase 3: the COA card is live (no longer "Coming soon")
        # and points at the certificate panel, keeping the mini-form fields as the
        # fallback for a bot with no Drive folder (features.coa_picker false).
        assert card_by_id["coa"].action == "coa_picker" and "get_coa" in live_tools
        assert not card_by_id["coa"].disabled
        assert card_by_id["coa"].prompt_template and card_by_id["coa"].input_label
        # D4 — COA is isolated from the catalog, so the fallback field is free text.
        assert card_by_id["coa"].input_source == ""

    def test_hub_cards_payload_is_json_serializable(self):
        import json
        payload = CHEMICAL_PACK.hub_cards_payload()
        assert isinstance(payload, list) and payload
        # Round-trips through JSON (this is what /api/config ships to the widget).
        json.dumps(payload)
        first = payload[0]
        assert {"id", "label", "icon", "action"} <= set(first)
        # A tool card carries a {value} template the widget fills from the form.
        sds = next(c for c in payload if c["id"] == "sds")
        assert "{value}" in sds["prompt_template"]

    def test_config_glue_pack_vs_generic(self):
        # Mirrors get_config: vertical -> pack -> hub_cards, else []. A generic
        # (NULL/blank/unknown) company gets no cards, so the widget shows no hub.
        def hub_cards_for(vertical):
            pack = load_pack(vertical)
            return pack.hub_cards_payload() if pack else []

        assert hub_cards_for("chemical")          # chemical ships cards
        for generic in (None, "", "  ", "plumbing", 123):
            assert hub_cards_for(generic) == []   # everyone else: no hub

    def test_knowledge_kinds(self):
        assert set(CHEMICAL_PACK.knowledge_kinds) == {"catalog", "sds"}

    def test_vertical_slug_constant_matches(self):
        assert CHEMICAL_VERTICAL == CHEMICAL_PACK.vertical == "chemical"

    def test_pack_is_immutable(self):
        # Frozen dataclass: packs are values, never mutated at runtime.
        import dataclasses
        try:
            CHEMICAL_PACK.vertical = "other"  # type: ignore[misc]
            assert False, "expected FrozenInstanceError"
        except dataclasses.FrozenInstanceError:
            pass
