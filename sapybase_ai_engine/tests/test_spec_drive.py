"""Spec finder Phase 1 - the ranked search (services/spec_drive.py).

Plan `docs/spec-finder-plan.md` §4, §11.

The search is a restoration of the COA finder's original `search()` (`c0162cea`),
which was deleted when certificates became confidential. It was tuned against a real
1,781-file folder, so these tests protect the behaviours that tuning bought - most of
all the filler-word fallback, which is the difference between "I have a drum of
acetone, send me the spec" returning three rows and returning the whole catalogue.

Fixtures are shaped like the client's REAL specification folder (plan §0.1), not like
COA's batch convention: product name first, standard or grade next, and a
customer-specific minority. `OTHER_CONVENTION` is the D2 guarantee - the same suite
must pass against a folder that names files completely differently, with no
configuration change anywhere.
"""
import pytest

from services.coa_drive import build_document, dedupe
from services.spec_drive import RESULT_LIMIT, search

# The client's live specification folder, read 2026-08-08. Includes the messy shapes
# the walk actually found: a percentage, a comma in a chemical name, a customer name
# in the trailing segment, and a revision suffix.
FIXTURES = [
    "Acetone_USP-NF_Spec.pdf",
    "Acetone_BP_Spec.pdf",
    "Acetone_LR_Spec.pdf",
    "Acetone_AR_Spec.pdf",
    "Acetone Anhydrous_Spec.pdf",
    "Acetone_CS11_Spec_Lupin pharma.pdf",
    "Isopropyl alcohol_LR_Spec.pdf",
    "Isopropyl alcohol_USP_Spec.pdf",
    "Xylene_Spec.pdf",
    "Hydrogen peroxide_50%_Spec.pdf",
    "N,N Diisopropylethylamine_LR_CS1_Spec.pdf",
    "Toluene_26R016_Spec.pdf",
]

# A completely different naming habit. Nothing in the module may need to change.
OTHER_CONVENTION = [
    "ACET-USP-SPEC.pdf",
    "ACET-LR-SPEC.pdf",
    "XYL-SPEC.pdf",
]


def entry(name, file_id=None, modified="2026-07-01T09:00:00.000Z",
          mime="application/pdf", link=None):
    fid = file_id or f"id-{name}"
    return {
        "id": fid,
        "name": name,
        "mimeType": mime,
        "modifiedTime": modified,
        "webViewLink": link if link is not None else f"https://drive.google.com/file/d/{fid}/view",
    }


def index(names):
    """Filenames -> the deduped document list the search operates on."""
    return dedupe(d for d in (build_document(entry(n)) for n in names) if d)


def names_of(result):
    return [d.name for d in result.documents]


@pytest.fixture
def library():
    return index(FIXTURES)


# ───────────────────────────── the strict pass ─────────────────────────────

class TestStrictPass:
    def test_a_product_name_returns_every_sheet_for_it(self, library):
        result = search(library, "acetone")
        assert result.status == "ok"
        assert result.total_matched == 6
        assert all("Acetone" in n for n in names_of(result))

    def test_a_second_word_narrows_the_list(self, library):
        # This IS the "related searches" step the requirement describes: the visitor
        # types a product, sees the standards it exists in, and narrows.
        assert search(library, "acetone").total_matched == 6
        assert names_of(search(library, "acetone USP")) == ["Acetone_USP-NF_Spec.pdf"]

    def test_a_strict_hit_never_admits_the_fallback(self, library):
        # "acetone AND USP" is not "acetone OR USP": once some file matches every
        # token, files matching only one must not appear alongside it. The fallback
        # exists for the query that matched NOTHING strictly, and only then.
        result = search(library, "acetone USP")
        assert names_of(result) == ["Acetone_USP-NF_Spec.pdf"]
        assert "Isopropyl alcohol_USP_Spec.pdf" not in names_of(result)

    def test_a_multi_word_product_name_works(self, library):
        assert len(search(library, "isopropyl alcohol").documents) == 2

    def test_case_and_spacing_do_not_matter(self, library):
        assert names_of(search(library, "  ACETONE   usp ")) == ["Acetone_USP-NF_Spec.pdf"]

    def test_an_unknown_product_finds_nothing(self, library):
        assert search(library, "nonsense9999").status == "empty"


# ──────────────────────────── the fallback pass ────────────────────────────

class TestFallbackPass:
    def test_conversational_phrasing_degrades_to_the_product_not_the_catalogue(self, library):
        # The failure this exists to prevent: "drum" and "please" fail the strict
        # pass, and a fallback admitting anything matching one token would return
        # every file containing "SPEC" - which is the entire folder.
        result = search(library, "please send me the acetone spec sheet")
        assert result.status == "ok"
        assert all("Acetone" in n for n in names_of(result))

    def test_a_substring_only_hit_cannot_carry_a_result_alone(self, library):
        # "OL" is inside "ISOPROPYL" and "TOLUENE" as a substring. On its own that is
        # too weak to be an answer, because short filler words match half a corpus
        # that way.
        assert search(library, "ol zzzz").status == "empty"

    def test_the_fallback_keeps_only_the_best_matching_tier(self, library):
        # "acetone" matches 6 files; "USP" matches 2. A query with an unmatched word
        # must keep the files that matched BOTH, not everything that matched either.
        result = search(library, "acetone USP quickly")
        assert names_of(result) == ["Acetone_USP-NF_Spec.pdf"]


# ─────────────────────────── tokenizer behaviours ───────────────────────────

class TestTokenizerBehaviours:
    def test_leading_zeros_inside_a_numeric_run_are_normalized(self, library):
        # `26R16` and `26R016` are one identifier written two ways.
        assert names_of(search(library, "toluene 26R16")) == ["Toluene_26R016_Spec.pdf"]

    def test_pasting_a_whole_filename_works(self, library):
        # The extension must not survive as a token that nothing matches.
        assert names_of(search(library, "Acetone_USP-NF_Spec.pdf")) == ["Acetone_USP-NF_Spec.pdf"]

    def test_punctuation_in_a_chemical_name_is_just_a_separator(self, library):
        result = search(library, "N,N Diisopropylethylamine")
        assert names_of(result) == ["N,N Diisopropylethylamine_LR_CS1_Spec.pdf"]

    def test_a_percentage_is_searchable(self, library):
        assert names_of(search(library, "hydrogen peroxide 50")) == [
            "Hydrogen peroxide_50%_Spec.pdf"]

    def test_a_different_naming_convention_needs_no_configuration(self):
        # D2. If this ever fails, somebody has smuggled a filename grammar back in.
        library = index(OTHER_CONVENTION)
        assert len(search(library, "acet").documents) == 2
        assert names_of(search(library, "xyl")) == ["XYL-SPEC.pdf"]

    def test_a_non_latin_filename_is_indexable_and_findable(self):
        # §15 - the tokenizer is Unicode-aware, and an ASCII-only class would
        # tokenize this to nothing and make the file unfindable.
        library = index(["Ацетон_ЛР_Spec.pdf", "Acetone_LR_Spec.pdf"])
        assert names_of(search(library, "Ацетон")) == ["Ацетон_ЛР_Spec.pdf"]


# ──────────────────────────── queries with no answer ────────────────────────────

class TestUnanswerableQueries:
    @pytest.mark.parametrize("query", ["", "   ", None, "___", "...", "a", 42])
    def test_a_query_that_cannot_narrow_anything_is_too_short(self, library, query):
        # H6 - "every query token must match" is VACUOUSLY TRUE for zero tokens, so
        # an unguarded "___" would return the entire folder. `too_short` and not
        # `empty`, because the panel must say "keep typing" rather than "we have
        # nothing".
        result = search(library, query)
        assert result.status == "too_short"
        assert result.documents == ()

    def test_empty_and_too_short_are_distinguishable(self, library):
        # The opposite of COA's C3, and correct here: one means type more, the other
        # means we do not stock it. Collapsing them gives one of the two visitors the
        # wrong instruction.
        assert search(library, "zylophonium").status == "empty"
        assert search(library, "z").status == "too_short"

    def test_an_empty_library_answers_empty_not_an_error(self):
        assert search([], "acetone").status == "empty"


# ──────────────────────────── ordering and the cap ────────────────────────────

class TestOrderingAndCap:
    def test_more_tokens_matched_ranks_higher(self, library):
        assert names_of(search(library, "acetone LR"))[0] == "Acetone_LR_Spec.pdf"

    def test_an_exact_token_beats_a_prefix_token(self):
        library = index(["Acetone_Spec.pdf", "Acetonitrile_Spec.pdf"])
        assert names_of(search(library, "acetone"))[0] == "Acetone_Spec.pdf"

    def test_the_newer_revision_ranks_above_the_older_one(self):
        library = dedupe([
            build_document(entry("Acetone_LR_Spec_v2.pdf", modified="2025-01-01T00:00:00.000Z")),
            build_document(entry("Acetone_LR_Spec_v3.pdf", modified="2026-08-01T00:00:00.000Z")),
        ])
        assert names_of(search(library, "acetone LR spec"))[0] == "Acetone_LR_Spec_v3.pdf"

    def test_an_identical_filename_collapses_to_the_newest(self):
        library = dedupe([
            build_document(entry("Acetone_LR_Spec.pdf", file_id="old",
                                 modified="2025-01-01T00:00:00.000Z")),
            build_document(entry("Acetone_LR_Spec.pdf", file_id="new",
                                 modified="2026-08-01T00:00:00.000Z")),
        ])
        result = search(library, "acetone LR")
        assert len(result.documents) == 1
        assert result.documents[0].file_id == "new"

    def test_a_missing_timestamp_never_raises(self):
        # H9 - comparing two absent timestamps is a TypeError, so a null is skipped
        # rather than compared.
        library = dedupe([
            build_document(entry("Acetone_LR_Spec.pdf", file_id="a", modified="")),
            build_document(entry("Acetone_AR_Spec.pdf", file_id="b", modified="")),
        ])
        assert len(search(library, "acetone").documents) == 2

    def test_the_list_is_capped_and_says_so(self):
        library = index([f"Acetone_G{i}_Spec.pdf" for i in range(20)])
        result = search(library, "acetone")
        assert len(result.documents) == RESULT_LIMIT
        assert result.total_matched == 20
        assert result.truncated is True

    def test_an_uncapped_result_is_not_marked_truncated(self, library):
        result = search(library, "isopropyl")
        assert result.truncated is False

    def test_the_cap_is_overridable_per_call(self, library):
        assert len(search(library, "acetone", limit=2).documents) == 2

    def test_ordering_is_stable_across_identical_calls(self, library):
        assert names_of(search(library, "acetone")) == names_of(search(library, "acetone"))
