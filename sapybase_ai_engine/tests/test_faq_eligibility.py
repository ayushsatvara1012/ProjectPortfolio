"""Publication gate for the crawlable FAQ feed (plan §1.4, F2/F3).

Fixtures are the real rows named in the plan §1.3 - these were actually published
as public SEO content on a client's site, so each one is a regression, not a
hypothetical.

The vertical-specific half is asserted through a *synthetic* pack as well as the
chemical one, so a second vertical is protected by construction rather than by
someone remembering to add its words.
"""

import pytest

from packs.chemical import CHEMICAL_PACK
from packs.schema import Pack, ToolSpec
from services.faq_eligibility import excluded_by, is_publishable


# ── Tenant-independent rules (our own output, same for every client) ─────────


def test_the_lagged_refusal_that_was_published():
    q = "Whom to contact for sales ?"
    a = "I don't have details on file for who specifically handles export business."
    assert "refusal" in excluded_by(q, a)
    assert not is_publishable(q, a)


def test_the_internal_error_string_that_was_published():
    q = "Methanol (Methyl alcohol) (CAS: 67-56-1)"
    a = "I'm having trouble reaching our product system right now"
    assert "error_string" in excluded_by(q, a)


def test_source_marker_is_never_published():
    q = "What grades of acetone do you stock?"
    a = "We stock technical and LR grades in 20L and 200L packs.\n📎 Source: catalogue.pdf"
    assert "source_marker" in excluded_by(q, a)


def test_a_legitimate_pair_is_publishable():
    q = "What packaging is available for acetone?"
    a = (
        "Acetone is available in 20 litre carboys and 200 litre drums. "
        "Both are supplied with tamper-evident seals and full batch documentation on request."
    )
    assert is_publishable(q, a, pack=CHEMICAL_PACK)
    assert excluded_by(q, a, pack=CHEMICAL_PACK) == []


def test_identifier_rule_needs_both_a_letter_and_a_digit():
    assert "identifier" in excluded_by("coa for 101LR", "x")
    assert "identifier" in excluded_by("order 101.26R007", "x")
    assert "identifier" not in excluded_by("CAS 67-56-1", "x")
    assert "identifier" not in excluded_by("We stock 200L drums", "x")


def test_identifier_rule_does_not_fire_on_ordinary_prose():
    q = "Do you deliver to Gujarat?"
    a = "Yes, we deliver across Gujarat with a typical lead time of 3 to 5 working days."
    assert "identifier" not in excluded_by(q, a)


def test_empty_and_none_inputs_are_safe():
    assert excluded_by("", "") == []
    assert is_publishable(None, None) is True


# ── Vertical-specific rules arrive from the pack, never from this module ─────


def test_the_coa_row_that_leaked_a_batch_identifier():
    q = "can i get the coa for 101LR 101.26R007"
    a = "I have retrieved the Certificate of Analysis. It should be open in a panel for you."
    classes = excluded_by(q, a, pack=CHEMICAL_PACK)
    assert "restricted_topic" in classes
    assert "ui_artifact" in classes
    assert "identifier" in classes


def test_restricted_tool_trace_excludes_regardless_of_wording():
    # The structural signal: nothing in this text is restricted-looking, but the
    # turn used get_coa, so it can never be republished.
    q = "what were the results for my last shipment"
    a = "Those results are available in the document I have opened for you now."
    sources = [{"kind": "tool", "label": "get_coa", "detail": None, "url": None}]
    assert "restricted_tool" in excluded_by(q, a, pack=CHEMICAL_PACK, sources=sources)


def test_unrestricted_tool_trace_does_not_exclude():
    sources = [{"kind": "tool", "label": "get_sds", "detail": "Acetone", "url": "u"}]
    assert "restricted_tool" not in excluded_by("sds for acetone", "Here it is.",
                                                pack=CHEMICAL_PACK, sources=sources)


def test_chemical_vocabulary_is_word_bounded():
    # "coating" and "batch documentation" are ordinary product copy.
    assert "restricted_topic" not in excluded_by(
        "Do you supply coating solvents?", "Yes, we supply coating-grade solvents.",
        pack=CHEMICAL_PACK)
    assert "restricted_topic" not in excluded_by(
        "Packaging?", "Drums ship with full batch documentation.", pack=CHEMICAL_PACK)
    assert "restricted_topic" in excluded_by(
        "Send batch no 1123", "Here is the certificate of analysis.", pack=CHEMICAL_PACK)


def test_no_pack_means_only_tenant_independent_rules_apply():
    # A generic bot has no tools and no vertical confidentiality model. COA words
    # in a generic tenant's content are just words.
    q = "what is a certificate of analysis"
    a = "A certificate of analysis is a document a supplier issues for a production run."
    assert excluded_by(q, a, pack=None) == []


def test_a_second_vertical_is_protected_by_the_same_machinery():
    # Nothing about this pack exists in the codebase; it proves the gate is driven
    # by pack config rather than by chemical vocabulary baked into the service.
    medical = Pack(
        vertical="medical",
        persona_prompt="x",
        tools=(ToolSpec(name="get_patient_record", description="d", restricted=True),),
        restricted_vocab=("discharge summary", "patient id"),
    )
    tool_sources = [{"kind": "tool", "label": "get_patient_record"}]
    assert "restricted_tool" in excluded_by("anything", "anything",
                                            pack=medical, sources=tool_sources)
    assert "restricted_topic" in excluded_by("send the discharge summary", "ok",
                                             pack=medical)
    # And chemical words mean nothing to it.
    assert excluded_by("certificate of analysis?", "Sure.", pack=medical) == []


def test_chemical_pack_declares_get_coa_restricted():
    assert "get_coa" in CHEMICAL_PACK.restricted_tool_names()
    assert "get_sds" not in CHEMICAL_PACK.restricted_tool_names()


def test_packs_with_nothing_restricted_are_valid():
    plain = Pack(vertical="plain", persona_prompt="x",
                 tools=(ToolSpec(name="t", description="d"),))
    assert plain.restricted_tool_names() == ()
    assert plain.restricted_vocab == ()
    assert excluded_by("q", "a", pack=plain, sources=[{"kind": "tool", "label": "t"}]) == []
