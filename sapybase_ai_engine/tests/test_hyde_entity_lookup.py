"""
§13.1 (docs/agent-conversation-gaps-plan.md): a directory/entity lookup must
bypass HyDE and embed the raw question, since HyDE's invented paragraph is
what made "who is looking export" surface a different (and once fabricated)
contact on every ask.
"""
import main


class TestEntityLookupDetector:
    def test_who_is_questions_bypass_hyde(self):
        assert main._is_entity_lookup_query("who is looking export")
        assert main._is_entity_lookup_query("Who is south marketing?")
        assert main._is_entity_lookup_query("who's responsible for exports")
        assert main._is_entity_lookup_query("who manages the Gujarat territory")

    def test_contact_and_role_phrasings_bypass_hyde(self):
        assert main._is_entity_lookup_query("contact person for south sales")
        assert main._is_entity_lookup_query("point of contact for export inquiries")
        assert main._is_entity_lookup_query("who is in charge of quality control")
        assert main._is_entity_lookup_query("who is responsible for export?")
        assert main._is_entity_lookup_query("sales team in Gujarat")
        assert main._is_entity_lookup_query("manager for business development")
        assert main._is_entity_lookup_query("whom to contact for a sample")

    def test_prose_questions_do_not_bypass_hyde(self):
        assert not main._is_entity_lookup_query("what is the price of Hexane LR")
        assert not main._is_entity_lookup_query("what is the flash point of acetone")
        assert not main._is_entity_lookup_query("do you ship to Gujarat")
        assert not main._is_entity_lookup_query("what packaging sizes are available")
        assert not main._is_entity_lookup_query("tell me about your company history")

    def test_empty_and_none_are_safe(self):
        assert not main._is_entity_lookup_query("")
        assert not main._is_entity_lookup_query(None)
