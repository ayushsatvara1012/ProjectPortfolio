"""main._publishable_faq_rows - the gate between chat_logs and public FAQ schema
(bot-output-quality plan §1.4, F2/F3).

Everything this rejects was, at some point, published as crawlable SEO content on
a real client's site.
"""

import main
from packs.chemical import CHEMICAL_PACK
from packs.schema import Pack, ToolSpec


def _cand(question, answer, ask_count=1, all_sources=None):
    return (question, answer, ask_count, all_sources)


GOOD_Q = "What packaging is available for acetone?"
GOOD_A = (
    "Acetone is available in 20 litre carboys and 200 litre drums, both supplied "
    "with tamper-evident seals and documentation on request."
)


def test_a_legitimate_pair_survives_and_is_reshaped_for_dedupe():
    out = main._publishable_faq_rows([_cand(GOOD_Q, GOOD_A, 7)], CHEMICAL_PACK)
    assert out == [(GOOD_Q, GOOD_A, 7)]


def test_output_feeds_dedupe_ranked_qa_unchanged():
    rows = main._publishable_faq_rows([_cand(GOOD_Q, GOOD_A, 7)], CHEMICAL_PACK)
    assert main._dedupe_ranked_qa(rows, limit=10) == [
        {"question": GOOD_Q, "answer": GOOD_A, "ask_count": 7}
    ]


def test_refusal_is_rejected():
    a = "I don't have details on file for who specifically handles export business."
    assert main._publishable_faq_rows([_cand("Whom to contact for sales ?", a)], None) == []


def test_internal_error_string_is_rejected():
    a = "I'm having trouble reaching our product system right now - let me connect you."
    assert main._publishable_faq_rows([_cand("Do you have xylene?", a)], None) == []


def test_source_marker_is_rejected():
    a = GOOD_A + "\n📎 Source: internal-price-list.pdf"
    assert main._publishable_faq_rows([_cand(GOOD_Q, a)], None) == []


def test_restricted_tool_anywhere_in_the_group_rejects_it():
    # Two turns grouped under one question; only the second used get_coa.
    grouped = [
        [{"kind": "kb", "label": "https://x.com/catalog", "rank": 1}],
        [{"kind": "tool", "label": "get_coa", "detail": None}],
    ]
    out = main._publishable_faq_rows(
        [_cand("what are the tested values", GOOD_A, 2, grouped)], CHEMICAL_PACK
    )
    assert out == []


def test_unrestricted_tool_trace_survives():
    grouped = [[{"kind": "tool", "label": "get_sds", "detail": "Acetone"}]]
    out = main._publishable_faq_rows([_cand(GOOD_Q, GOOD_A, 3, grouped)], CHEMICAL_PACK)
    assert len(out) == 1


def test_missing_or_null_sources_does_not_crash():
    assert len(main._publishable_faq_rows([_cand(GOOD_Q, GOOD_A, 1, None)], CHEMICAL_PACK)) == 1
    assert len(main._publishable_faq_rows([(GOOD_Q, GOOD_A, 1)], CHEMICAL_PACK)) == 1


def test_generic_bot_with_no_pack_still_gets_the_universal_rules():
    a = "I couldn't find that in my knowledge base."
    assert main._publishable_faq_rows([_cand("q", a)], None) == []
    assert len(main._publishable_faq_rows([_cand(GOOD_Q, GOOD_A)], None)) == 1


def test_gate_is_pack_driven_for_any_vertical():
    legal = Pack(
        vertical="legal",
        persona_prompt="x",
        tools=(ToolSpec(name="get_case_file", description="d", restricted=True),),
        restricted_vocab=("settlement amount",),
    )
    by_tool = [[{"kind": "tool", "label": "get_case_file"}]]
    assert main._publishable_faq_rows([_cand("q", GOOD_A, 1, by_tool)], legal) == []
    assert main._publishable_faq_rows(
        [_cand("what was the settlement amount", GOOD_A)], legal) == []
    # Chemical vocabulary means nothing to a legal pack.
    assert len(main._publishable_faq_rows(
        [_cand("do you handle certificate of analysis disputes", GOOD_A)], legal)) == 1


def test_ordering_is_preserved_so_ask_count_ranking_survives():
    cands = [
        _cand("q1 " + GOOD_Q, GOOD_A, 9),
        _cand("q2 rejected", "I don't have that on file, sorry about it here.", 8),
        _cand("q3 " + GOOD_Q, GOOD_A, 7),
    ]
    out = main._publishable_faq_rows(cands, CHEMICAL_PACK)
    assert [r[2] for r in out] == [9, 7]
