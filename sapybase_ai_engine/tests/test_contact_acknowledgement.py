"""Slice K + QF10: the acknowledgment must be bound to a real capture.

docs/bot-output-quality-plan.md §6, §11 phase 3. Session 5c7ec4f6 (2026-08-09):
the visitor typed `my mobile no 1231231233`, the bot replied "I've noted your
mobile number, 1231231233. The Expresolv team will follow up with you." and
`agent_requests` had zero rows for that period.

`extract_phone` was RIGHT to reject that number - it fails the leading-digit rule.
The defect is what the bot says when extraction declines, so nothing here loosens
the extractor; the tests below assert its precision is unchanged.
"""
import pytest

from services import qualification
from services.agent_runtime import contact


CLAIM = ("I've noted your mobile number, 1231231233. "
         "The Expresolv team will follow up with you.")


class TestCaptureClaims:
    def test_the_real_incident_sentence_is_detected(self):
        assert contact.capture_claims(CLAIM)[0].startswith("I've noted your mobile")

    def test_a_non_contact_note_is_not_a_capture_claim(self):
        # "Noted" about anything else must survive - this is the false positive
        # that would make the repair fire on ordinary replies.
        text = "I've noted your preference for AR grade. We stock it in 2.5L packs."
        assert contact.capture_claims(text) == []

    def test_a_plain_answer_carries_no_claim(self):
        assert contact.capture_claims("Acetone is available in AR and LR grades.") == []

    def test_the_pass_it_on_phrasing_counts(self):
        assert contact.capture_claims("I'll pass your number to the team.")


class TestBindAcknowledgement:
    def test_a_successful_capture_is_left_alone(self):
        # The path that already worked: the claim is true, so it is not touched.
        text, finding = contact.bind_acknowledgement(CLAIM, captured=True, cue=True)
        assert text == CLAIM
        assert finding is None

    def test_an_unreadable_number_is_never_claimed_as_noted(self):
        text, finding = contact.bind_acknowledgement(CLAIM, captured=False, cue=True)
        assert "noted your mobile" not in text
        assert "have not saved it" in text
        assert finding

    def test_the_rest_of_the_reply_survives_the_repair(self):
        text, _ = contact.bind_acknowledgement(
            "Acetone is in stock. I've noted your number. Anything else?",
            captured=False, cue=True)
        assert "Acetone is in stock." in text
        assert "Anything else?" in text
        assert "noted your number" not in text

    def test_with_no_cue_the_false_claim_is_dropped_not_replaced(self):
        # Nothing was offered, so asking them to repeat a number they never gave
        # would be its own kind of nonsense.
        text, finding = contact.bind_acknowledgement(
            "Acetone is in stock. I've noted your number.", captured=False, cue=False)
        assert "noted your number" not in text
        assert "send it again" not in text
        assert "Acetone is in stock." in text
        assert finding

    def test_a_reply_that_is_only_a_false_claim_never_becomes_empty(self):
        text, finding = contact.bind_acknowledgement(CLAIM, captured=False, cue=True)
        assert text.strip()
        assert finding

    def test_a_clean_reply_is_untouched_either_way(self):
        clean = "Acetone is available in AR and LR grades."
        for captured in (True, False):
            text, finding = contact.bind_acknowledgement(clean, captured=captured, cue=True)
            assert text == clean
            assert finding is None


class TestContactCue:
    def test_the_real_incident_message_carries_a_cue(self):
        assert qualification.has_contact_cue("my mobile no 1231231233")

    def test_whatsapp_counts(self):
        assert qualification.has_contact_cue("whatsapp me on 9876543210")

    def test_an_ordinary_question_does_not(self):
        assert not qualification.has_contact_cue("do you have acetone in stock?")


class TestExtractorPrecisionUnchanged:
    """§6 is explicit: the fix is what the bot SAYS, not what the extractor accepts."""

    def test_the_incident_number_is_still_rejected(self):
        assert qualification.extract_phone("my mobile no 1231231233") is None

    def test_a_real_indian_mobile_is_still_accepted(self):
        assert qualification.extract_phone("my mobile no 9974561140") == "9974561140"

    def test_a_cas_number_is_still_not_a_phone(self):
        assert qualification.extract_phone("acetone CAS 67-64-1 please") is None


class TestQf10Ordering:
    def test_capture_runs_after_settle(self):
        """QF10: the capture used to fire before the turn's outcome existed."""
        import inspect

        from services.agent_runtime import pipeline

        src = inspect.getsource(pipeline.run_agent_turn)
        assert src.index("compose_mod.settle(") < src.index("_capture_volunteered_contact(")

    def test_a_failed_turn_marks_the_owner_note(self):
        # The lead is still captured - suppressing it would lose a real enquiry at
        # exactly the moment a human is needed. What changes is that the owner's
        # alert says the bot could not answer.
        import inspect

        from services.agent_runtime import pipeline

        src = inspect.getsource(pipeline._capture_volunteered_contact)
        assert "bot could not answer this turn" in src
        assert "TurnState.SYSTEM_ERROR" in src
