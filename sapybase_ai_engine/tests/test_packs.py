"""Tests for the vertical-pack layer (chemical-vertical-agent plan, Phase 0).

Pure-Python: the pack registry has no DB or network dependency. These lock the
two Phase 0 guarantees — (1) a vertical resolves to its pack, and (2) any
absent/unknown/malformed vertical safely degrades to None (the generic-bot path,
so existing NULL-vertical customers are never affected).
"""
from packs import Pack, ToolSpec, known_verticals, load_pack, normalize_vertical
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
        # Phase 1 get_sds + Phase 2a get_product_spec + Phase 4a request_quote.
        assert CHEMICAL_PACK.tool_names() == ("get_sds", "get_product_spec", "request_quote")
        for name in ("get_sds", "get_product_spec", "request_quote"):
            assert isinstance(CHEMICAL_PACK.get_tool(name), ToolSpec)

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
        assert card_by_id["sds"].action == "tool" and "get_sds" in live_tools
        assert card_by_id["spec"].action == "tool" and "get_product_spec" in live_tools
        assert card_by_id["quote"].action == "tool" and "request_quote" in live_tools
        assert card_by_id["ask"].action == "chat"  # chat card needs no tool

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
