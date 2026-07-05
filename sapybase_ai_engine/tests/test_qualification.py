"""Phase 5 — deterministic qualification-fact extraction (services/qualification.py).

Pure-function tests: no DB, no LLM. The design rule is PRECISION over recall — a
wrong fact is worse than a blank — so the negative cases (don't over-capture) matter
as much as the positive ones.
"""
from services import qualification as q
from packs.chemical import CHEMICAL_PACK

SLOTS = CHEMICAL_PACK.qualification_slot_names()


class TestIndustry:
    def test_maps_keywords_to_canonical(self):
        assert q.extract_industry("we're a pharma company") == "pharmaceutical"
        assert q.extract_industry("used in textile dyeing") == "textile"
        assert q.extract_industry("for our paint plant") == "paints & coatings"
        assert q.extract_industry("effluent treatment plant") == "water treatment"

    def test_longest_phrase_wins(self):
        # "water treatment" must beat a bare token elsewhere.
        assert q.extract_industry("industrial water treatment") == "water treatment"

    def test_no_industry_returns_none(self):
        assert q.extract_industry("hello, I need a quote please") is None


class TestMonthlyVolume:
    def test_captures_qty_with_monthly_cadence(self):
        assert q.extract_monthly_volume("we need 500 kg per month") == "500 kg/month"
        assert q.extract_monthly_volume("about 2 tonnes monthly") == "2 tonnes/month"
        assert q.extract_monthly_volume("roughly 1000 litres a month") == "1000 litres/month"

    def test_requires_monthly_cue(self):
        # A bare pack size is demand-unknown — must NOT be logged as volume.
        assert q.extract_monthly_volume("do you have 500 ml packs?") is None
        assert q.extract_monthly_volume("I want 5 kg") is None

    def test_no_match(self):
        assert q.extract_monthly_volume("just browsing") is None


class TestDeliveryCity:
    def test_requires_cue_and_known_city(self):
        assert q.extract_delivery_city("please deliver to Surat") == "Surat"
        assert q.extract_delivery_city("our factory is in Ankleshwar") == "Ankleshwar"
        assert q.extract_delivery_city("ship to navi mumbai") == "Navi Mumbai"

    def test_passing_mention_without_delivery_intent_is_ok_if_cued(self):
        # "in Mumbai" is a location cue → acceptable capture.
        assert q.extract_delivery_city("we're in Mumbai") == "Mumbai"

    def test_unknown_city_is_not_guessed(self):
        assert q.extract_delivery_city("deliver to Smalltownville") is None

    def test_no_cue_no_capture(self):
        # Bare city token with no cue verb → don't capture (avoid false positives).
        assert q.extract_delivery_city("Mumbai") is None


class TestTimeline:
    def test_urgency_buckets(self):
        assert q.extract_timeline("I need this ASAP") == "urgent"
        assert q.extract_timeline("hoping to buy this week") == "this week"
        assert q.extract_timeline("sometime this month") == "this month"
        assert q.extract_timeline("maybe next month") == "1-3 months"
        assert q.extract_timeline("just exploring for now") == "exploring"

    def test_no_timeline(self):
        assert q.extract_timeline("what grades do you have") is None


class TestApplication:
    def test_captures_behind_cue(self):
        assert q.extract_application("we use it for water treatment") == "water treatment"
        assert q.extract_application("to make soap") == "soap"
        assert q.extract_application("application is metal cleaning") == "metal cleaning"

    def test_ignores_filler_after_cue(self):
        assert q.extract_application("I need it for it") is None
        assert q.extract_application("use it for the same") is None

    def test_no_cue_no_capture(self):
        assert q.extract_application("acetone please") is None


class TestExtractFacts:
    def test_multi_fact_message(self):
        text = ("We're a pharma unit in Ankleshwar, need about 500 kg per month, "
                "used for tablet coating, looking to buy this month.")
        facts = q.extract_facts(text, SLOTS)
        assert facts["industry"] == "pharmaceutical"
        assert facts["delivery_city"] == "Ankleshwar"
        assert facts["monthly_volume"] == "500 kg/month"
        assert facts["timeline"] == "this month"
        assert facts["application"] == "tablet coating"  # "used for tablet coating"

    def test_empty_and_blank(self):
        assert q.extract_facts("", SLOTS) == {}
        assert q.extract_facts("   ", SLOTS) == {}

    def test_unknown_slot_names_skipped(self):
        assert q.extract_facts("pharma", ("industry", "nonexistent")) == {"industry": "pharmaceutical"}

    def test_only_confident_matches_returned(self):
        # A neutral message yields nothing (no key with empty value).
        assert q.extract_facts("hello there", SLOTS) == {}


class TestMergeQualification:
    def test_folds_into_qualification_subkey(self):
        prof = q.merge_qualification({"email": "a@b.com"}, {"industry": "textile"})
        assert prof["email"] == "a@b.com"
        assert prof["qualification"] == {"industry": "textile"}

    def test_non_destructive_accumulates(self):
        prof = q.merge_qualification(
            {"qualification": {"industry": "textile"}}, {"timeline": "urgent"})
        assert prof["qualification"] == {"industry": "textile", "timeline": "urgent"}

    def test_re_answer_overwrites(self):
        prof = q.merge_qualification(
            {"qualification": {"timeline": "exploring"}}, {"timeline": "urgent"})
        assert prof["qualification"]["timeline"] == "urgent"

    def test_empty_facts_is_noop_and_new_dict(self):
        src = {"qualification": {"industry": "textile"}}
        out = q.merge_qualification(src, {})
        assert out == src and out is not src   # copy, not the same object

    def test_none_inputs(self):
        assert q.merge_qualification(None, None) == {}
        assert q.merge_qualification(None, {"industry": "rubber"}) == {
            "qualification": {"industry": "rubber"}}


class TestQualificationBlock:
    def test_empty_for_pack_without_slots(self):
        from packs import Pack
        assert q.qualification_block(Pack(vertical="x", persona_prompt="p"), {}) == ""
        assert q.qualification_block(None, {}) == ""

    def test_lists_unknowns_when_nothing_known(self):
        block = q.qualification_block(CHEMICAL_PACK, {})
        assert "KNOWN buyer facts:" in block
        assert "(none captured yet)" in block
        assert "STILL UNKNOWN:" in block
        # Every slot label appears as an unknown.
        for slot in CHEMICAL_PACK.qualification_slots:
            assert slot.label in block
        # The single-question discipline is stated.
        assert "AT MOST ONE" in block

    def test_splits_known_from_unknown(self):
        profile = {"qualification": {"industry": "pharmaceutical", "timeline": "urgent"}}
        block = q.qualification_block(CHEMICAL_PACK, profile)
        assert "Industry: pharmaceutical" in block
        assert "Purchase timeline: urgent" in block
        # Known facts are not re-listed as unknown.
        unknown_line = block.split("STILL UNKNOWN:")[1]
        assert "Industry" not in unknown_line
        assert "Application" in unknown_line       # still unknown

    def test_all_known_suppresses_questions(self):
        allknown = {"qualification": {
            s.name: "x" for s in CHEMICAL_PACK.qualification_slots}}
        block = q.qualification_block(CHEMICAL_PACK, allknown)
        assert "STILL UNKNOWN" not in block
        assert "do NOT ask further qualification" in block

    def test_never_delays_a_product_answer(self):
        # The guardrail: qualification must not gate answering.
        block = q.qualification_block(CHEMICAL_PACK, {})
        assert "answer first" in block.lower()
