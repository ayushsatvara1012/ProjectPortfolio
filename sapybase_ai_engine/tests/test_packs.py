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

    def test_declares_get_sds_only(self):
        # Phase 0 ships exactly one declared tool.
        assert CHEMICAL_PACK.tool_names() == ("get_sds",)
        tool = CHEMICAL_PACK.get_tool("get_sds")
        assert isinstance(tool, ToolSpec)

    def test_get_sds_slots_cover_cas_and_name(self):
        tool = CHEMICAL_PACK.get_tool("get_sds")
        slot_names = {s.name for s in tool.slots}
        assert {"cas_number", "product_name"} <= slot_names

    def test_hub_cards_empty_until_phase3(self):
        assert CHEMICAL_PACK.hub_cards == ()

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
