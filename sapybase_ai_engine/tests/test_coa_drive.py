"""COA finder Phase 1 — tokenized search and the Drive walker (services/coa_drive.py).

Plan `docs/coa-finder-plan.md` §12. Two things these tests exist to protect:

1. **Convention independence.** The client's fixtures in §3 are test data, not a
   specification. The same search suite runs against a synthetic folder using a
   completely different naming scheme with no configuration change — if that ever
   fails, someone has smuggled a filename grammar back in.
2. **The silent failures.** H2 (Shared-Drive flags) and H7 (`fields=`) do not raise;
   they return an empty folder and null links respectively, which look like "the
   client hasn't uploaded anything yet". They are asserted on the REQUEST, not on a
   mocked response, because a mock cannot reproduce the failure they prevent.
"""
import asyncio
import re

import httpx
import pytest

from services import coa_drive
from services.coa_drive import (
    CoaDriveError,
    build_document,
    dedupe,
    display_name,
    lookup,
    normalize,
    numeric_key,
    tokenize,
    walk_folder,
)

FOLDER_ID = "1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U"
API_KEY = "AIzaTESTKEY0000000000000000000000000000"

# §3 — the client's live folder, read 2026-07-28. Deliberately includes the messy
# ones: an extra underscore, a stray leading space, a doubled space, dotted batches.
FIXTURES = [
    "100MC3_100.26P001_ACETONE USP-NF PH.EUR BP.pdf",
    "100RG_100.26R016_ACETONE RG.pdf",
    "100PU_100.26R016_ACETONE PURE.pdf",
    "100LR_100.26R016_ACETONE LR.pdf",
    "104IP_104.26P004_BENZYL ALCOHOL_IP.pdf",
    "102NF_102.26P001_ BENZALKONIUM CHLORIDE 50%.pdf",
    "101HPLC_101.26R001_ACETONITRILE  HPLC & SPEC.pdf",
    "106IPPCS2_106.26RD001_CHLOROFORM 106IPPCS2.pdf",
    "104MC3P_104.24P008_BENZYL ALCOHOL USP-NF.pdf",
]

# A completely different convention — no underscores, no dotted batch, a B-prefixed
# batch number. Nothing in the module may need to change for this to work.
OTHER_CONVENTION = [
    "ACET-LR-B1042.pdf",
    "ACET-RG-B1042.pdf",
    "BENZ-IP-B0997.pdf",
]


def entry(name, file_id=None, modified="2026-07-01T09:00:00.000Z", mime="application/pdf", link=None):
    fid = file_id or f"id-{name}"
    return {
        "id": fid,
        "name": name,
        "mimeType": mime,
        "modifiedTime": modified,
        "webViewLink": link if link is not None else f"https://drive.google.com/file/d/{fid}/view",
    }


def folder_entry(file_id):
    return {"id": file_id, "name": file_id, "mimeType": coa_drive.FOLDER_MIME,
            "modifiedTime": "2026-07-01T09:00:00.000Z", "webViewLink": ""}


def shortcut_entry(file_id, target_id, target_mime):
    return {
        "id": file_id,
        "name": f"shortcut-{file_id}",
        "mimeType": coa_drive.SHORTCUT_MIME,
        "modifiedTime": "2026-07-01T09:00:00.000Z",
        "webViewLink": f"https://drive.google.com/file/d/{target_id}/view",
        "shortcutDetails": {"targetId": target_id, "targetMimeType": target_mime},
    }


def index(names):
    """Filenames → the deduped document list the search operates on."""
    return dedupe(d for d in (build_document(entry(n)) for n in names) if d)


def names_of(documents):
    return [d.name for d in documents]


def name_of(document):
    """The released certificate's filename, or ``None`` when nothing was released."""
    return document.name if document is not None else None


@pytest.fixture
def library():
    return index(FIXTURES)


# ───────────────────────────── tokenize / normalize ─────────────────────────

class TestTokenize:
    def test_the_plan_example(self):
        assert tokenize("100RG_100.26R016_ACETONE RG.pdf") == (
            "100RG", "100", "26R016", "ACETONE", "RG")

    def test_extra_underscore_is_just_another_separator(self):
        assert tokenize("104IP_104.26P004_BENZYL ALCOHOL_IP.pdf") == (
            "104IP", "104", "26P004", "BENZYL", "ALCOHOL", "IP")

    def test_stray_leading_space_produces_no_empty_token(self):
        tokens = tokenize("102NF_102.26P001_ BENZALKONIUM CHLORIDE 50%.pdf")
        assert "" not in tokens
        assert tokens[:3] == ("102NF", "102", "26P001")

    def test_doubled_space_and_ampersand(self):
        # The ampersand is a separator, not a token: "&" is punctuation and was only
        # ever indexable as a match for a query of "&". Every separator is now any run
        # of non-alphanumerics, so there is no per-character exception list to keep.
        assert tokenize("101HPLC_101.26R001_ACETONITRILE  HPLC & SPEC.pdf") == (
            "101HPLC", "101", "26R001", "ACETONITRILE", "HPLC", "SPEC")

    def test_punctuation_is_a_separator_not_part_of_a_token(self):
        # The live bug: a comma is not in the old `[_\-.\s/]` set, so "acetone,"
        # became a token that matches nothing, the strict pass failed, and the
        # fallback returned the whole catalogue.
        assert tokenize("acetone, batch 100.26R016") == (
            "ACETONE", "BATCH", "100", "26R016")
        assert tokenize("BUTAN-1-OL (N-BUTANOL)") == ("BUTAN", "1", "OL", "N", "BUTANOL")
        assert tokenize("GLYCEROL 85%") == ("GLYCEROL", "85")

    def test_a_comma_convention_needs_no_configuration(self):
        # D2 — the separator set must not encode any one client's punctuation taste.
        assert tokenize("ACET,LR,B1042.pdf") == ("ACET", "LR", "B1042")
        assert tokenize("ACET|LR|B1042.pdf") == ("ACET", "LR", "B1042")

    def test_non_latin_filenames_survive_tokenization(self):
        # `[\W_]+` is Unicode-aware; an ASCII-only separator class would reduce these
        # to nothing and make the file permanently unfindable.
        assert tokenize("АЦЕТОН_100.26R016.pdf") == ("АЦЕТОН", "100", "26R016")
        assert tokenize("丙酮-100.pdf") == ("丙酮", "100")

    def test_dotted_pharmacopoeia_reference_splits(self):
        # PH.EUR is a dot like any other — no special case, no exception list.
        assert "PH" in tokenize("100MC3_100.26P001_ACETONE USP-NF PH.EUR BP.pdf")
        assert "EUR" in tokenize("100MC3_100.26P001_ACETONE USP-NF PH.EUR BP.pdf")

    def test_a_foreign_convention_needs_no_configuration(self):
        assert tokenize("ACET-LR-B1042.pdf") == ("ACET", "LR", "B1042")

    def test_extension_token_is_dropped(self):
        assert "PDF" not in tokenize("100RG_100.26R016_ACETONE RG.pdf")

    def test_a_bare_extension_query_still_tokenizes(self):
        # Dropping it unconditionally would turn "pdf" into a zero-token query,
        # which H6 then reads as "match everything".
        assert tokenize("pdf") == ("PDF",)

    @pytest.mark.parametrize("junk", [None, 123, [], {}, "", "   ", "___", "...", "-.-"])
    def test_separator_only_and_garbage_input_yields_no_tokens(self, junk):
        assert tokenize(junk) == ()


class TestNormalize:
    def test_h17_index_and_query_share_one_normalizer(self):
        # If these ever diverge nothing matches, so the shared call is asserted
        # directly rather than inferred from a passing search.
        assert tokenize.__module__ == normalize.__module__
        assert tokenize("ａｃｅｔｏｎｅ") == tokenize("acetone") == ("ACETONE",)

    def test_case_and_whitespace_are_irrelevant(self):
        assert normalize("  acetone  ") == "ACETONE"

    @pytest.mark.parametrize("junk", [None, 123, [], {}])
    def test_never_raises(self, junk):
        assert normalize(junk) == ""


class TestNumericKey:
    def test_strips_leading_zeros_inside_a_run(self):
        assert numeric_key("26R016") == "26R16"

    def test_leaves_a_run_without_leading_zeros_alone(self):
        assert numeric_key("100") == "100"
        assert numeric_key("26R16") == "26R16"

    def test_a_lone_zero_survives(self):
        assert numeric_key("0") == "0"


class TestDisplayName:
    def test_splits_on_underscore_only_so_the_batch_stays_whole(self):
        assert display_name("100RG_100.26R016_ACETONE RG.pdf") == "100RG · 100.26R016 · ACETONE RG"

    def test_collapses_doubled_spaces(self):
        assert display_name("101HPLC_101.26R001_ACETONITRILE  HPLC & SPEC.pdf") == (
            "101HPLC · 101.26R001 · ACETONITRILE HPLC & SPEC")

    def test_trims_a_stray_leading_space_in_a_segment(self):
        assert display_name("102NF_102.26P001_ BENZALKONIUM CHLORIDE 50%.pdf") == (
            "102NF · 102.26P001 · BENZALKONIUM CHLORIDE 50%")

    def test_preserves_original_case(self):
        assert display_name("Acet-LR-B1042.pdf") == "Acet-LR-B1042"

    def test_a_name_with_no_separators_is_shown_as_is(self):
        assert display_name("scan0012.pdf") == "scan0012"


# ──────────────────────────────── lookup ────────────────────────────────────
#
# `docs/coa-confidential-access-plan.md` §4. These tests replace the ranked-search
# suite wholesale, and the deletions are the point: every case that used to assert a
# LIST of near misses now asserts nothing at all comes back. A certificate is
# released only when the visitor has identified exactly one.

class TestLookupReleases:
    def test_product_code_plus_batch(self, library):
        assert name_of(lookup(library, "100RG 100.26R016")) == "100RG_100.26R016_ACETONE RG.pdf"

    @pytest.mark.parametrize("typed", [
        "100RG 100.26R016",
        "100RG_100.26R016",
        "100RG/100.26R016",
        "100RG,100.26R016",
        "  100rg   100.26r016  ",
    ])
    def test_separators_and_case_do_not_matter(self, library, typed):
        # The customer is copying off a drum or an invoice; how they punctuate it is
        # not something they should have to get right.
        assert name_of(lookup(library, typed)) == "100RG_100.26R016_ACETONE RG.pdf"

    def test_pasting_the_whole_filename_works(self, library):
        assert name_of(lookup(library, "100RG_100.26R016_ACETONE RG.pdf")) == (
            "100RG_100.26R016_ACETONE RG.pdf")

    def test_numeric_tolerance_survives_the_tightening(self, library):
        # The one tolerance kept: a dropped leading zero is the same identifier
        # written differently, not a near miss.
        assert name_of(lookup(library, "100RG 26R16")) == "100RG_100.26R016_ACETONE RG.pdf"

    def test_uniqueness_is_the_rule_not_the_field_names(self, library):
        # Nothing here knows what a "product code" is (D2). Any two tokens that
        # happen to identify one certificate release it — here a description and a
        # grade. On the client's real 1,781-file folder the same query matches 16 and
        # is refused, which is the rule doing its job in both directions.
        assert name_of(lookup(library, "acetone LR")) == "100LR_100.26R016_ACETONE LR.pdf"

    def test_f4_duplicate_filings_collapse_to_one_release(self):
        # The same certificate filed in two month folders must not read as two
        # matches and refuse itself. Dedupe is load-bearing now, not a tidy-up.
        both = dedupe([
            build_document(entry("100RG_100.26R016_ACETONE RG.pdf", file_id="jan",
                                 modified="2026-01-04T09:00:00.000Z")),
            build_document(entry("100RG_100.26R016_ACETONE RG.pdf", file_id="jul",
                                 modified="2026-07-04T09:00:00.000Z")),
        ])
        assert name_of(lookup(both, "100RG 100.26R016")) == "100RG_100.26R016_ACETONE RG.pdf"


class TestLookupRefuses:
    def test_batch_alone_when_it_spans_grades(self, library):
        # F1 — three grades share this batch, so the batch alone does not identify a
        # certificate. This is the case the client accepted: that customer is now
        # sent to support rather than shown three options.
        assert lookup(library, "100.26R016") is None

    def test_a_product_name_alone(self, library):
        assert lookup(library, "acetone") is None

    def test_a_description_matching_several_certificates(self, library):
        # Two BENZYL ALCOHOL certificates exist, so the pair identifies neither.
        assert lookup(library, "BENZYL ALCOHOL") is None

    def test_a_single_token_even_when_it_is_unique(self, library):
        # `100RG` identifies exactly one file, and is still refused: the two-token
        # floor is checked before uniqueness, which is what keeps a lucky one-word
        # guess from releasing anything.
        assert lookup(library, "100RG") is None

    def test_prefix_matching_is_gone(self, library):
        # `ACET` used to reach ACETONE. It is not a token, so it now reaches nothing.
        assert lookup(library, "ACET 100.26R016") is None

    def test_substring_matching_is_gone(self, library):
        # `R016` sits inside `26R016` and used to return all three grades.
        assert lookup(library, "R016 100RG") is None

    def test_a_typo_no_longer_degrades_into_suggestions(self, library):
        # The fallback pass is deleted. A misspelling is a refusal, not a shortlist —
        # a shortlist is a list of the client's certificates.
        assert lookup(library, "acetnoe 100.26R016") is None

    def test_conversational_phrasing_is_refused(self, library):
        # REVERSAL of the §7.1 behaviour, and deliberate. Filler words are not tokens
        # in the filename, so prose passed straight through matches nothing. This is
        # the matcher's job and it stays this way; Phase D moved the extraction to the
        # model instead — `get_coa`'s description now requires the identifiers alone,
        # asserted in test_coa_endpoint.TestGetCoaToolContract.
        for phrasing in [
            "acetone, batch 100.26R016",
            "I have a drum of acetone batch 100.26R016",
            "COA for batch 100.26R016",
        ]:
            assert lookup(library, phrasing) is None, f"{phrasing!r} must not release"

    def test_filler_alone(self, library):
        for query in ["batch", "certificate please", "can you send me the COA"]:
            assert lookup(library, query) is None, f"{query!r} carries no identifier"

    def test_two_matches_are_never_resolved_by_a_tie_break(self):
        # There is no ranking any more, so nothing may quietly pick the newest of an
        # ambiguous pair. Two DIFFERENT certificates sharing the queried tokens must
        # release neither — dedupe cannot collapse them, their names differ.
        pair = dedupe([
            build_document(entry("100RG_100.26R016_ACETONE RG.pdf",
                                 modified="2026-01-04T09:00:00.000Z")),
            build_document(entry("100RG_100.26R016_ACETONE RG GRADE II.pdf",
                                 modified="2026-07-04T09:00:00.000Z")),
        ])
        assert len(pair) == 2
        assert lookup(pair, "100RG 100.26R016") is None


class TestLookupConstraints:
    @pytest.mark.parametrize("query", ["___", "...", "", "   ", "-.-", None, 123])
    def test_h6_empty_token_list_releases_nothing(self, library, query):
        # "every query token must match" is vacuously true for zero tokens, so this
        # is the check that stops a separator-only query matching the whole folder.
        assert lookup(library, query) is None

    def test_the_floor_counts_tokens_not_characters(self, library):
        # `___` is three characters and no tokens, which is why the old character
        # floor could not close H6 on its own.
        assert coa_drive._matches(library, "___") == []
        assert coa_drive._matches(library, "100RG") == []

    def test_ambiguous_and_absent_are_indistinguishable(self, library):
        # C3 — the caller gets None either way, so nothing downstream is able to vary
        # its message by how many certificates matched. That sameness IS the control:
        # "16 matched" tells someone probing that acetone exists and they are close.
        assert lookup(library, "100.26R016") is None    # three matched
        assert lookup(library, "ZZZZ QQQQ") is None     # none matched


class TestConventionIndependence:
    """§12 — the same behaviour against a folder that shares no naming convention
    with the client's. Zero configuration changes hands."""

    @pytest.fixture
    def library(self):
        return index(OTHER_CONVENTION)

    def test_code_plus_grade_releases(self, library):
        assert name_of(lookup(library, "ACET LR")) == "ACET-LR-B1042.pdf"

    def test_code_plus_batch_spanning_grades_is_refused(self, library):
        assert lookup(library, "ACET B1042") is None

    def test_all_three_parts_release(self, library):
        assert name_of(lookup(library, "ACET LR B1042")) == "ACET-LR-B1042.pdf"

    def test_numeric_tolerance_still_applies(self, library):
        assert name_of(lookup(library, "BENZ B997")) == "BENZ-IP-B0997.pdf"

    def test_h6_still_holds(self, library):
        assert lookup(library, "___") is None


# ──────────────────────────── documents / dedupe ────────────────────────────

class TestBuildDocument:
    def test_a_file_with_no_link_is_never_indexed(self):
        # Mirrors the SDS picker rule: nothing broken is ever offered.
        assert build_document(entry("100RG_x.pdf", link="")) is None
        assert build_document({"id": "x", "name": "a.pdf"}) is None

    def test_a_file_with_no_usable_tokens_is_dropped(self):
        # Would otherwise be indexed under a bogus "PDF" token and returned for a
        # query of "pdf" — the extension is never a token on the index side.
        assert build_document(entry("___.pdf")) is None
        assert build_document(entry("...pdf")) is None

    def test_a_poorly_named_file_is_still_indexed(self):
        # Unfindable in practice, but that is Phase 4's report to make visible, not
        # a reason to silently drop the client's document.
        doc = build_document(entry("scan0012.pdf"))
        assert doc is not None and doc.tokens == ("SCAN0012",)

    def test_h10_filename_is_capped_on_ingest(self):
        doc = build_document(entry("A" * 900 + "_100.26R016.pdf"))
        assert len(doc.name) == coa_drive.MAX_NAME_LEN

    def test_h8_download_targets_the_direct_download_form(self):
        doc = build_document(entry("100RG_100.26R016_ACETONE RG.pdf", file_id="abc123"))
        assert doc.download_url == "https://drive.google.com/uc?export=download&id=abc123"
        assert "webViewLink" not in doc.download_url
        assert doc.download_url != doc.web_view_link

    @pytest.mark.parametrize("junk", [None, "", 123, [], {}])
    def test_never_raises_on_a_malformed_entry(self, junk):
        assert build_document(junk) is None


class TestDedupe:
    NAME = "100MC3_100.26P001_ACETONE USP-NF PH.EUR BP.pdf"

    def test_the_same_filename_in_two_month_folders_collapses_to_the_newest(self):
        # F4 — the client's January and July folders both hold this certificate.
        docs = [
            build_document(entry(self.NAME, file_id="jan", modified="2026-01-05T10:00:00.000Z")),
            build_document(entry(self.NAME, file_id="jul", modified="2026-07-05T10:00:00.000Z")),
        ]
        out = dedupe(docs)
        assert len(out) == 1 and out[0].file_id == "jul"

    def test_equal_timestamps_tiebreak_on_file_id_deterministically(self):
        docs = [
            build_document(entry(self.NAME, file_id="bbb", modified="2026-07-05T10:00:00.000Z")),
            build_document(entry(self.NAME, file_id="aaa", modified="2026-07-05T10:00:00.000Z")),
        ]
        assert dedupe(docs)[0].file_id == "aaa"
        assert dedupe(list(reversed(docs)))[0].file_id == "aaa"

    def test_h9_a_null_timestamp_never_raises_and_always_loses(self):
        docs = [
            build_document(entry(self.NAME, file_id="dated", modified="2026-01-05T10:00:00.000Z")),
            build_document(entry(self.NAME, file_id="undated", modified="")),
        ]
        assert dedupe(docs)[0].file_id == "dated"
        assert dedupe(list(reversed(docs)))[0].file_id == "dated"

    def test_h9_two_null_timestamps_are_never_compared(self):
        docs = [
            build_document(entry(self.NAME, file_id="b", modified="")),
            build_document(entry(self.NAME, file_id="a", modified="")),
        ]
        out = dedupe(docs)          # would TypeError if None were compared to None
        assert len(out) == 1

    def test_distinct_filenames_are_kept(self, library):
        assert len(library) == len(FIXTURES)

    def test_duplicate_report_sees_what_dedupe_collapsed(self):
        docs = [
            build_document(entry(self.NAME, file_id="jan")),
            build_document(entry(self.NAME, file_id="jul")),
            build_document(entry("100RG_100.26R016_ACETONE RG.pdf")),
        ]
        assert coa_drive.duplicate_names(docs) == {self.NAME: 2}


# ───────────────────────────────── the walk ─────────────────────────────────

def drive(tree, requests=None, status=200, pages=None):
    """A mock Drive. ``tree`` maps folder ID → the entries directly inside it."""

    def handler(request):
        if requests is not None:
            requests.append(request)
        if status != 200:
            return httpx.Response(status, json={"error": {"message": "nope"}})
        q = request.url.params.get("q", "")
        match = re.match(r"'([^']+)' in parents", q)
        folder_id = match.group(1) if match else ""
        if pages is not None:
            return pages(request, folder_id)
        return httpx.Response(200, json={"files": tree.get(folder_id, [])})

    return httpx.MockTransport(handler)


async def run_walk(transport, folder_id=FOLDER_ID):
    async with httpx.AsyncClient(transport=transport) as client:
        return await walk_folder(folder_id, API_KEY, client=client)


class TestWalkRequestShape:
    """H2 and H7 fail SILENTLY — a Shared Drive returns zero files with HTTP 200,
    and a missing `fields` returns null links. Both are asserted on the request."""

    @pytest.mark.asyncio
    async def test_h2_both_all_drives_flags_are_sent_on_every_request(self):
        requests = []
        tree = {FOLDER_ID: [folder_entry("sub"), entry(FIXTURES[0])], "sub": [entry(FIXTURES[1])]}
        await run_walk(drive(tree, requests))
        assert requests
        for req in requests:
            assert req.url.params.get("supportsAllDrives") == "true"
            assert req.url.params.get("includeItemsFromAllDrives") == "true"

    @pytest.mark.asyncio
    async def test_h7_fields_asks_for_the_web_view_link(self):
        requests = []
        await run_walk(drive({FOLDER_ID: [entry(FIXTURES[0])]}, requests))
        fields = requests[0].url.params.get("fields")
        assert fields, "without an explicit fields= every webViewLink comes back null"
        for wanted in ("webViewLink", "modifiedTime", "shortcutDetails", "nextPageToken"):
            assert wanted in fields

    @pytest.mark.asyncio
    async def test_trashed_files_are_excluded_at_query_time(self):
        requests = []
        await run_walk(drive({FOLDER_ID: []}, requests))
        assert "trashed = false" in requests[0].url.params.get("q")

    @pytest.mark.asyncio
    async def test_the_folder_id_is_the_only_thing_interpolated(self):
        requests = []
        await run_walk(drive({FOLDER_ID: []}, requests))
        assert requests[0].url.params.get("q") == f"'{FOLDER_ID}' in parents and trashed = false"
        assert requests[0].url.host == "www.googleapis.com"


class TestWalkTraversal:
    @pytest.mark.asyncio
    async def test_indexes_pdfs_across_nested_folders(self):
        tree = {
            FOLDER_ID: [folder_entry("jan"), folder_entry("jul")],
            "jan": [entry(FIXTURES[0]), entry(FIXTURES[1])],
            "jul": [folder_entry("deep"), entry(FIXTURES[2])],
            "deep": [entry(FIXTURES[3])],
        }
        result = await run_walk(drive(tree))
        assert result.indexed == 4
        assert result.folders_visited == 4

    @pytest.mark.asyncio
    async def test_a_batch_year_that_disagrees_with_its_folder_is_irrelevant(self):
        # F3 — the folder path is never read for meaning.
        tree = {FOLDER_ID: [folder_entry("2026-01")], "2026-01": [entry(FIXTURES[8])]}
        result = await run_walk(drive(tree))
        assert name_of(lookup(list(result.documents), "104.24P008")) == FIXTURES[8]

    @pytest.mark.asyncio
    async def test_non_pdf_files_are_ignored_and_counted(self):
        tree = {FOLDER_ID: [
            entry(FIXTURES[0]),
            entry("notes.txt", mime="text/plain"),
            entry("sheet.xlsx", mime="application/vnd.ms-excel"),
        ]}
        result = await run_walk(drive(tree))
        assert result.indexed == 1
        assert result.ignored_non_pdf == 2
        assert result.files_seen == 3

    @pytest.mark.asyncio
    async def test_h2_an_empty_folder_is_distinguishable_from_a_full_one(self):
        empty = await run_walk(drive({FOLDER_ID: []}))
        full = await run_walk(drive({FOLDER_ID: [entry(FIXTURES[0])]}))
        assert (empty.indexed, empty.files_seen) == (0, 0)
        assert (full.indexed, full.files_seen) == (1, 1)

    @pytest.mark.asyncio
    async def test_a_shortcut_to_a_file_is_resolved_to_its_target(self):
        tree = {FOLDER_ID: [shortcut_entry("sc1", "real-id", "application/pdf")]}
        result = await run_walk(drive(tree))
        assert result.indexed == 1
        assert result.documents[0].file_id == "real-id"

    @pytest.mark.asyncio
    async def test_a_shortcut_to_a_folder_is_descended_into(self):
        tree = {
            FOLDER_ID: [shortcut_entry("sc1", "jan", coa_drive.FOLDER_MIME)],
            "jan": [entry(FIXTURES[0])],
        }
        assert (await run_walk(drive(tree))).indexed == 1

    @pytest.mark.asyncio
    async def test_an_unresolvable_shortcut_is_skipped_not_guessed(self):
        broken = {"id": "sc", "name": "x", "mimeType": coa_drive.SHORTCUT_MIME,
                  "webViewLink": "https://drive.google.com/x"}
        result = await run_walk(drive({FOLDER_ID: [broken, entry(FIXTURES[0])]}))
        assert result.indexed == 1

    @pytest.mark.asyncio
    async def test_duplicates_across_folders_collapse_in_the_walk_result(self):
        tree = {
            FOLDER_ID: [folder_entry("jan"), folder_entry("jul")],
            "jan": [entry(FIXTURES[0], file_id="jan-copy", modified="2026-01-05T10:00:00.000Z")],
            "jul": [entry(FIXTURES[0], file_id="jul-copy", modified="2026-07-05T10:00:00.000Z")],
        }
        result = await run_walk(drive(tree))
        assert result.indexed == 1
        assert result.documents[0].file_id == "jul-copy"


class TestWalkGuardRails:
    @pytest.mark.asyncio
    async def test_h4_a_shortcut_cycle_terminates_and_lists_each_folder_once(self):
        # A shortcut pointing back at an ancestor is the documented Drive way to
        # build a cycle; without a visited-set this never returns.
        requests = []
        tree = {
            FOLDER_ID: [folder_entry("a")],
            "a": [folder_entry("b"), shortcut_entry("loop", FOLDER_ID, coa_drive.FOLDER_MIME)],
            "b": [shortcut_entry("loop2", "a", coa_drive.FOLDER_MIME), entry(FIXTURES[0])],
        }
        result = await asyncio.wait_for(run_walk(drive(tree, requests)), timeout=10)
        assert result.folders_visited == 3
        listed = [re.match(r"'([^']+)'", r.url.params.get("q")).group(1) for r in requests]
        assert sorted(listed) == sorted(set(listed)), "each folder must be listed exactly once"

    @pytest.mark.asyncio
    async def test_depth_cap_stops_descent_and_reports_itself(self, monkeypatch):
        monkeypatch.setattr(coa_drive, "MAX_DEPTH", 2)
        tree = {FOLDER_ID: [folder_entry("d1")], "d1": [folder_entry("d2")],
                "d2": [folder_entry("d3")], "d3": [folder_entry("d4")],
                "d4": [entry(FIXTURES[0])]}
        result = await run_walk(drive(tree))
        assert "depth" in result.capped
        assert result.indexed == 0

    @pytest.mark.asyncio
    async def test_folder_cap_serves_what_it_has(self, monkeypatch):
        monkeypatch.setattr(coa_drive, "MAX_FOLDERS", 3)
        tree = {FOLDER_ID: [folder_entry(f"f{i}") for i in range(10)]}
        for i in range(10):
            tree[f"f{i}"] = [entry(f"CODE{i}_BATCH{i}_PRODUCT.pdf")]
        result = await run_walk(drive(tree))
        assert "folders" in result.capped
        assert result.folders_visited <= 3

    @pytest.mark.asyncio
    async def test_file_cap_serves_what_it_has(self, monkeypatch):
        monkeypatch.setattr(coa_drive, "MAX_FILES", 3)
        tree = {FOLDER_ID: [entry(f"CODE{i}_BATCH{i}_PRODUCT.pdf") for i in range(10)]}
        result = await run_walk(drive(tree))
        assert "files" in result.capped
        assert result.indexed == 3

    @pytest.mark.asyncio
    async def test_h14_a_repeating_page_token_terminates(self):
        requests = []

        def pages(request, folder_id):
            return httpx.Response(200, json={"files": [entry(FIXTURES[0])], "nextPageToken": "SAME"})

        result = await asyncio.wait_for(
            run_walk(drive({}, requests, pages=pages)), timeout=10)
        assert len(requests) <= coa_drive.MAX_PAGES_PER_FOLDER
        assert result.indexed == 1

    @pytest.mark.asyncio
    async def test_h14_an_endless_rotating_page_token_stops_at_the_page_cap(self):
        requests = []
        counter = {"n": 0}

        def pages(request, folder_id):
            counter["n"] += 1
            return httpx.Response(200, json={
                "files": [entry(f"CODE{counter['n']}_B{counter['n']}_PRODUCT.pdf")],
                "nextPageToken": f"page-{counter['n']}",
            })

        await asyncio.wait_for(run_walk(drive({}, requests, pages=pages)), timeout=10)
        assert len(requests) == coa_drive.MAX_PAGES_PER_FOLDER

    @pytest.mark.asyncio
    async def test_pagination_accumulates_across_pages(self):
        def pages(request, folder_id):
            token = request.url.params.get("pageToken", "")
            if not token:
                return httpx.Response(200, json={"files": [entry(FIXTURES[0])], "nextPageToken": "p2"})
            return httpx.Response(200, json={"files": [entry(FIXTURES[1])]})

        result = await run_walk(drive({}, pages=pages))
        assert result.indexed == 2


class TestWalkFailures:
    @pytest.mark.asyncio
    async def test_h1_an_invalid_folder_id_never_reaches_drive(self):
        requests = []
        for hostile in ["abc' or '1'='1", "short", "", "has space", "a&b"]:
            with pytest.raises(CoaDriveError) as excinfo:
                await run_walk(drive({}, requests), folder_id=hostile)
            assert excinfo.value.reason == "invalid_folder"
        assert requests == [], "a rejected folder ID must not produce a Drive call"

    @pytest.mark.asyncio
    async def test_a_missing_api_key_is_a_clean_refusal(self, monkeypatch):
        monkeypatch.delenv("GOOGLE_DRIVE_API_KEY", raising=False)
        async with httpx.AsyncClient(transport=drive({})) as client:
            with pytest.raises(CoaDriveError) as excinfo:
                await walk_folder(FOLDER_ID, "", client=client)
        assert excinfo.value.reason == "not_configured"

    @pytest.mark.asyncio
    async def test_h15_a_403_is_not_reported_as_not_found(self):
        with pytest.raises(CoaDriveError) as excinfo:
            await run_walk(drive({}, status=403))
        assert excinfo.value.reason == "forbidden"

    @pytest.mark.asyncio
    async def test_a_404_is_a_missing_folder(self):
        with pytest.raises(CoaDriveError) as excinfo:
            await run_walk(drive({}, status=404))
        assert excinfo.value.reason == "not_found"

    @pytest.mark.asyncio
    async def test_a_transport_failure_degrades_rather_than_500ing(self):
        def boom(request):
            raise httpx.ConnectError("drive is down", request=request)

        with pytest.raises(CoaDriveError) as excinfo:
            await run_walk(httpx.MockTransport(boom))
        assert excinfo.value.reason == "unreachable"

    @pytest.mark.asyncio
    async def test_h3_the_error_carries_no_key_folder_id_or_url(self):
        # The key rides in the URL, so `str(httpx_error)` contains it. One careless
        # `return str(e)` would hand the platform-wide key to a widget.
        for status in (403, 404, 500):
            with pytest.raises(CoaDriveError) as excinfo:
                await run_walk(drive({}, status=status))
            text = str(excinfo.value)
            assert API_KEY not in text
            assert FOLDER_ID not in text
            assert "key=" not in text
            assert "googleapis" not in text


class TestScrub:
    def test_h3_redacts_the_key_from_anything_logged(self):
        url = f"https://www.googleapis.com/drive/v3/files?q=x&key={API_KEY}&pageSize=1000"
        out = coa_drive.scrub(url)
        assert API_KEY not in out
        assert "key=[redacted]" in out
        assert "pageSize=1000" in out

    def test_survives_a_key_at_the_end_of_the_string(self):
        assert API_KEY not in coa_drive.scrub(f"GET https://x/y?key={API_KEY}")

    def test_leaves_unrelated_text_alone(self):
        assert coa_drive.scrub("plain message") == "plain message"
