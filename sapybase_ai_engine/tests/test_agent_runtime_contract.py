"""Slice G: the response contract's four post-conditions.

docs/bot-output-quality-plan.md §2/§9. The prepend cases below are the real turns
from session `4ef9ffa0` (2026-08-10), where the same defect fired five times in
seven minutes after RULE 2 already carried an anti-restate clause - which is why
this is code and not a fifth clause.

The tool-answer positive control is mandatory (§2.4): SDS, COA, quote and spec
replies carry names and identifiers that came from tool output and never appear in
retrieval, so a check 3 validated against chunks alone would break every one of them.
"""
import pytest

from services.agent_runtime import contract

# Session 4ef9ffa0, turn 2. The export denial was the previous reply; the sales
# list underneath it is a real answer.
PRIOR_EXPORT_DENIAL = "I don't have that specific detail on file."

SALES_REPLY = (
    "I don't have that specific detail on file. For sales enquiries you can reach "
    "Pratik Shome at pratik@expresolv.com, or Ida Sebastian on 9974561140."
)

EVIDENCE_SALES = [
    "Sales team: Pratik Shome, Head of Sales, pratik@expresolv.com. "
    "Ida Sebastian, Sales Executive, mobile 9974561140.",
]


class TestLeadingRestatement:
    def test_a_replayed_opener_is_found_even_when_new_content_follows(self):
        # The observed failure is a prepend, not a duplicated message - whole-message
        # similarity scores this as a low match and misses it entirely (§2.4).
        text = PRIOR_EXPORT_DENIAL + " For sales, contact Pratik Shome."
        assert contract.leading_restatement(text, PRIOR_EXPORT_DENIAL) == PRIOR_EXPORT_DENIAL

    def test_a_lightly_paraphrased_replay_still_counts(self):
        prior = "The marketing head is Jasmine Patel, based in Ahmedabad."
        text = "The marketing head is Jasmine Patel, based in Ahmedabad. Anything else?"
        assert contract.leading_restatement(text, prior) is not None

    def test_an_unrelated_opener_is_left_alone(self):
        text = "Acetone is available in AR and LR grades."
        assert contract.leading_restatement(text, PRIOR_EXPORT_DENIAL) is None

    def test_a_short_courtesy_opener_is_not_a_restatement(self):
        # Stripping "Sure." makes the reply abrupt and fixes nothing.
        assert contract.leading_restatement("Sure. Acetone is in stock.", "Sure.") is None

    def test_no_previous_reply_means_nothing_to_replay(self):
        assert contract.leading_restatement(SALES_REPLY, "") is None

    def test_stripping_removes_the_orphaned_connective(self):
        text = "I don't have that on file. However, Pratik Shome handles sales."
        span = contract.leading_restatement(text, "I don't have that on file.")
        assert contract.strip_leading_span(text, span) == "Pratik Shome handles sales."


class TestDenialOpener:
    def test_a_denial_in_front_of_a_real_answer_is_found(self):
        assert contract.denial_opener(SALES_REPLY) == PRIOR_EXPORT_DENIAL

    def test_a_genuine_refusal_is_left_alone(self):
        # Nothing follows it, so the denial IS the answer and must survive.
        text = "I don't have that on file. Let me get someone from the team to help."
        assert contract.denial_opener(text) is None

    def test_an_answer_with_no_denial_is_untouched(self):
        assert contract.denial_opener("Pratik Shome handles sales enquiries.") is None


class TestUngroundedIdentities:
    def test_a_name_absent_from_this_turns_evidence_is_reported(self):
        # The §2.2 case: the reply named two people neither of whom was retrieved.
        text = "Business development is handled by Chandra Parija and Nirmal Choudhary."
        found = contract.ungrounded_identities(text, EVIDENCE_SALES)
        assert "Chandra Parija" in found
        assert "Nirmal Choudhary" in found

    def test_a_grounded_name_passes(self):
        found = contract.ungrounded_identities(
            "Pratik Shome handles sales.", EVIDENCE_SALES)
        assert found == []

    def test_a_tool_sourced_name_passes_when_the_tool_payload_is_in_evidence(self):
        # MANDATORY positive control (§2.4). The SDS name is in no chunk at all.
        evidence = contract.evidence_from(
            retrieved_docs=[("Expresolv supplies laboratory reagents.", None, None)],
            captured={"sds": {"product": "Methanol", "url": "https://x/sds.pdf",
                              "authored_by": "Rakesh Iyer"}},
        )
        assert contract.ungrounded_identities(
            "The SDS for Methanol is authored by Rakesh Iyer.", evidence) == []

    def test_a_grounded_phone_passes_despite_a_different_country_code(self):
        assert contract.ungrounded_identities(
            "Call +91 99745 61140.", EVIDENCE_SALES) == []

    def test_an_invented_phone_is_reported(self):
        found = contract.ungrounded_identities("Call 9812345678.", EVIDENCE_SALES)
        assert found

    def test_an_invented_email_is_reported(self):
        found = contract.ungrounded_identities(
            "Write to exports@expresolv.com.", EVIDENCE_SALES)
        assert "exports@expresolv.com" in found

    def test_product_and_document_phrases_are_never_read_as_people(self):
        text = ("The Safety Data Sheet and Certificate of Analysis for Acetic Acid "
                "are available.")
        assert contract.ungrounded_identities(text, EVIDENCE_SALES,
                                              extra_vocab=("Acetic Acid",)) == []

    def test_a_job_title_is_never_reported_as_a_person(self):
        # The 2026-08-12 baseline run reported "Managing Director" as an ungrounded
        # person on a real turn - a title has the same capitalised-bigram shape.
        assert contract.ungrounded_identities(
            "The Managing Director signs every export declaration.", EVIDENCE_SALES) == []

    def test_a_title_trailing_a_name_is_stripped_not_reported_whole(self):
        # "Pratik Shome, Head of Sales" is grounded; the title must not make it fail.
        assert contract.ungrounded_identities(
            "Pratik Shome, Sales Manager, handles enquiries.", EVIDENCE_SALES) == []

    def test_an_ungrounded_name_carrying_a_title_is_still_reported(self):
        found = contract.ungrounded_identities(
            "Piyush Satvara, Technical Director, signs it.", EVIDENCE_SALES)
        assert "Piyush Satvara" in found

    def test_no_evidence_reports_nothing(self):
        # An evidence-free turn is the gates' problem, not check 3's - reporting
        # every name here would drown the signal shadow mode is meant to measure.
        assert contract.ungrounded_identities("Pratik Shome handles sales.", []) == []

    def test_a_cas_number_is_not_mistaken_for_a_phone(self):
        assert contract.ungrounded_identities(
            "Methanol, CAS 67-56-1, is in stock.", EVIDENCE_SALES) == []


class TestSurplusQuestions:
    def test_a_licensed_turn_keeps_one_question(self):
        text = "Acetone is in AR and LR. Would you like a quote? Or an SDS?"
        assert contract.surplus_questions(text, licensed=True) == ["Or an SDS?"]

    def test_an_unlicensed_turn_keeps_none(self):
        # Slice J: an informational turn gets no nudge at all.
        text = "Acetone is in AR and LR. Would you like a quote?"
        assert contract.surplus_questions(text, licensed=False) == ["Would you like a quote?"]

    def test_a_statement_only_reply_is_untouched(self):
        assert contract.surplus_questions("Acetone is in AR and LR.", licensed=True) == []


class TestCheck:
    def test_shadow_mode_never_changes_the_visitors_text(self):
        report = contract.check(SALES_REPLY, prior_reply=PRIOR_EXPORT_DENIAL,
                                evidence=EVIDENCE_SALES, shadow=True)
        assert report.text == SALES_REPLY
        assert report.findings

    def test_enforcing_mode_repairs_the_prepend(self):
        report = contract.check(SALES_REPLY, prior_reply=PRIOR_EXPORT_DENIAL,
                                evidence=EVIDENCE_SALES, shadow=False)
        assert not report.text.startswith("I don't have")
        assert "Pratik Shome" in report.text

    def test_a_clean_reply_produces_no_findings(self):
        report = contract.check("Pratik Shome handles sales enquiries.",
                                prior_reply="Acetone is in stock.",
                                evidence=EVIDENCE_SALES, shadow=False)
        assert report.findings == []
        assert report.summary() == "clean"

    def test_only_the_grounding_check_asks_for_a_re_invoke(self):
        repairable = contract.check(SALES_REPLY, prior_reply=PRIOR_EXPORT_DENIAL,
                                    evidence=EVIDENCE_SALES, shadow=False)
        assert not repairable.needs_reinvoke

        invented = contract.check("Nirmal Choudhary heads business development.",
                                  evidence=EVIDENCE_SALES, shadow=False)
        assert invented.needs_reinvoke

    def test_a_name_only_present_in_the_replayed_span_is_not_reported_as_invented(self):
        # Grounding runs against the repaired text, so removing the replay removes
        # the claim with it rather than escalating it to a re-invoke.
        prior = "Nirmal Choudhary is the CMD."
        text = "Nirmal Choudhary is the CMD. Acetone is available in AR and LR grades."
        report = contract.check(text, prior_reply=prior, evidence=EVIDENCE_SALES,
                                shadow=False)
        assert not report.needs_reinvoke

    def test_a_reply_that_is_entirely_a_replay_is_reported_but_not_emptied(self):
        report = contract.check(PRIOR_EXPORT_DENIAL, prior_reply=PRIOR_EXPORT_DENIAL,
                                evidence=EVIDENCE_SALES, shadow=False)
        assert report.text == PRIOR_EXPORT_DENIAL
        assert any(not f.repaired and f.check == "restatement" for f in report.findings)


class TestShadowWiring:
    def test_the_shadow_pass_never_edits_the_settled_reply(self):
        from services.agent_runtime import pipeline
        from services.agent_runtime.states import TurnState
        from services.agent_runtime.turn import TurnResult

        turn = TurnResult(state=TurnState.ANSWERED, text=SALES_REPLY,
                          sources=[{"kind": "kb", "label": "x"}])
        inputs = pipeline.TurnInputs(
            company={"id": "c1"}, message="whom to contact for sales?",
            prior_messages=[{"role": "assistant", "content": PRIOR_EXPORT_DENIAL}],
            retrieved_text=EVIDENCE_SALES,
        )
        pipeline._review_contract(inputs, turn, {})
        assert turn.text == SALES_REPLY

    def test_the_last_assistant_message_is_what_check_one_compares_against(self):
        from services.agent_runtime import pipeline

        prior = [
            {"role": "assistant", "content": "older reply"},
            {"role": "user", "content": "and sales?"},
            {"role": "assistant", "content": PRIOR_EXPORT_DENIAL},
        ]
        assert pipeline._prior_assistant_text(prior) == PRIOR_EXPORT_DENIAL

    def test_a_broken_review_never_takes_down_the_turn(self):
        from services.agent_runtime import pipeline
        from services.agent_runtime.states import TurnState
        from services.agent_runtime.turn import TurnResult

        turn = TurnResult(state=TurnState.ANSWERED, text="fine",
                          sources=[{"kind": "kb", "label": "x"}])
        inputs = pipeline.TurnInputs(company={"id": "c1"}, message="hi",
                                     prior_messages=object())  # not iterable
        pipeline._review_contract(inputs, turn, {})
        assert turn.text == "fine"


class TestEvidenceFrom:
    def test_both_halves_are_included(self):
        evidence = contract.evidence_from(
            retrieved_docs=[("chunk text", "https://x", "id-1")],
            captured={"quote": {"product": "Acetone", "price": "1200"}},
        )
        joined = " ".join(evidence)
        assert "chunk text" in joined
        assert "Acetone" in joined

    def test_empty_inputs_give_empty_evidence(self):
        assert contract.evidence_from() == []
