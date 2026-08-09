"""Spec finder Phase 1 - the selectivity guard (plan §4.1).

The measured problem this exists for: `SPEC` appears in 1,028 of the client's 1,086
filenames, so a visitor typing the single ordinary word `spec` matches 94% of the
library and would otherwise be handed an arbitrary eight rows of it - customer-named
files included. `LR` matches 219 (20%).

The guard is deliberately NOT a stopword list (that would be a per-client grammar,
which D2 forbids) and deliberately NOT inverse-document-frequency weighting (which
would reorder results that were tuned against a real 1,781-file folder). It only
declines a query that failed to select, and it changes no ranking at all.

The two numbers it must respect, both measured on the real folder:
  * `isopropyl alcohol`, the widest LEGITIMATE product query, matches 41 of 1,086
    (3.8%) and must pass with room to spare.
  * `LR` matches 20.2% and must not.
"""
import pytest

from services.coa_drive import build_document, dedupe
from services.spec_drive import BROAD_GUARD_MIN_LIBRARY, BROAD_MATCH_RATIO, search


def entry(name):
    return {
        "id": f"id-{name}",
        "name": name,
        "mimeType": "application/pdf",
        "modifiedTime": "2026-07-01T09:00:00.000Z",
        "webViewLink": f"https://drive.google.com/file/d/id-{name}/view",
    }


def index(names):
    return dedupe(d for d in (build_document(entry(n)) for n in names) if d)


def realistic_library(size=1000, acetone=20, isopropyl=41):
    """A library shaped like the real folder: every file carries `Spec`, one product
    is unusually well represented, and the rest are distinct products."""
    names = [f"Acetone_G{i}_Spec.pdf" for i in range(acetone)]
    names += [f"Isopropyl alcohol_G{i}_Spec.pdf" for i in range(isopropyl)]
    names += [f"Product{i}_Spec.pdf" for i in range(size - acetone - isopropyl)]
    return index(names)


@pytest.fixture
def library():
    return realistic_library()


# ─────────────────────── the queries the guard is for ───────────────────────

class TestBroadQueriesAreDeclined:
    def test_a_folder_wide_word_does_not_return_a_slice_of_the_library(self, library):
        result = search(library, "spec")
        assert result.status == "too_broad"
        assert result.documents == ()

    def test_the_declined_query_still_reports_how_much_it_matched(self, library):
        # Not shown to the visitor, but the endpoint and the logs need to be able to
        # tell "too broad" from "nothing there" without re-running the search.
        assert search(library, "spec").total_matched == 1000

    def test_a_grade_token_shared_by_a_fifth_of_the_library_is_declined(self):
        # The measured `LR` case: 219 of 1,086 (20.2%).
        library = index(
            [f"Product{i}_LR_Spec.pdf" for i in range(219)]
            + [f"Product{i}_AR_Spec.pdf" for i in range(219, 1086)]
        )
        assert search(library, "LR").status == "too_broad"


# ────────────────── the queries the guard must never touch ──────────────────

class TestLegitimateQueriesPass:
    def test_the_widest_real_product_query_passes(self, library):
        # `isopropyl alcohol` is 41 of 1,000 here - the widest legitimate query
        # measured on the real folder, and it must clear the threshold comfortably.
        result = search(library, "isopropyl alcohol")
        assert result.status == "ok"
        assert result.total_matched == 41

    def test_an_ordinary_product_query_passes(self, library):
        assert search(library, "acetone").status == "ok"

    def test_a_broad_word_plus_a_product_name_narrows_and_passes(self, library):
        # The visitor's own escape route: `spec` alone is declined, `acetone spec`
        # selects. The guard measures the RESULT, so a narrowing second word fixes it
        # without any special-casing of token counts.
        assert search(library, "spec").status == "too_broad"
        assert search(library, "acetone spec").status == "ok"

    def test_a_query_that_matches_nothing_stays_empty_not_too_broad(self, library):
        assert search(library, "zylophonium").status == "empty"


# ───────────────────────────── the small-library floor ─────────────────────────────

class TestSmallLibraryFloor:
    def test_a_small_library_never_trips_the_guard(self):
        # Risk 4. In a folder of twelve documents a real product query legitimately
        # matches most of it, so the guard must not exist there at all - a client
        # with one spec sheet per product would otherwise get "keep typing" for
        # every search they ever ran.
        library = index([f"Product{i}_Spec.pdf" for i in range(12)])
        result = search(library, "spec")
        assert result.status == "ok"
        assert result.total_matched == 12

    def test_the_floor_is_the_library_size_not_the_match_count(self):
        library = index([f"Product{i}_Spec.pdf" for i in range(BROAD_GUARD_MIN_LIBRARY - 1)])
        assert search(library, "spec").status == "ok"

    def test_just_above_the_floor_the_guard_applies(self):
        library = index([f"Product{i}_Spec.pdf" for i in range(BROAD_GUARD_MIN_LIBRARY)])
        assert search(library, "spec").status == "too_broad"


# ──────────────────────────────── the threshold ────────────────────────────────

class TestThreshold:
    def test_the_ratio_boundary_behaves_as_documented(self):
        # Two libraries of 200, differing only in how much of it the query selects:
        # 15% is declined, 10% is served. Pinned so a future change to the constant
        # is a deliberate act rather than a silent drift.
        size = 200
        at_threshold = int(size * BROAD_MATCH_RATIO)
        library = index(
            [f"Alpha{i}_LR_Spec.pdf" for i in range(at_threshold)]
            + [f"Beta{i}_AR_Spec.pdf" for i in range(size - at_threshold)]
        )
        assert search(library, "LR").status == "too_broad"

        below = at_threshold - 5
        library = index(
            [f"Alpha{i}_LR_Spec.pdf" for i in range(below)]
            + [f"Beta{i}_AR_Spec.pdf" for i in range(size - below)]
        )
        assert search(library, "LR").status == "ok"

    def test_the_guard_measures_matches_before_the_cap_not_after(self):
        # The trap: capping to 8 first would make every query look narrow, and the
        # guard would never fire on anything.
        library = index([f"Product{i}_Spec.pdf" for i in range(500)])
        assert search(library, "spec", limit=8).status == "too_broad"
