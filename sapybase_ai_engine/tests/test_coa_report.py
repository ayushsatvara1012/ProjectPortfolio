"""COA finder Phase 4 — the owner's certificate-library report (plan §9 Phase 4, H16).

The search works; what the owner cannot otherwise see is which of *their* files it
will never find. Three blind spots, and one of them is load-bearing:

* **H16 — the duplicate report is the safety net for D6.** "Identical filename = same
  document, newest wins" is an assumption about a client who files one COA per batch,
  not a law. A client filing per-customer subfolders with repeated names would lose
  documents silently, so the count has to be measured DURING the walk: after
  ``dedupe`` there is nothing left to count, which is why these figures live on
  ``WalkResult`` and travel through the cache instead of being derived from a listing.
* **Files that never became documents.** A PDF with no servable link or no searchable
  filename was dropped without a trace, which left a short index with no explanation.
* **Filename quality (§11).** A one-token filename is findable only by typing that
  token exactly. Nothing but a rename fixes it, so the panel's job is visibility.
"""
import httpx
import pytest
from fastapi.testclient import TestClient

import main as m
from services import coa_drive
from services.coa_drive import (
    WalkResult,
    build_document,
    decode_payload,
    deserialize_index,
    duplicate_summary,
    encode_index,
    folder_report,
    thin_documents,
    walk_folder,
)
from tests.test_coa_drive import API_KEY, FIXTURES, FOLDER_ID, drive, entry, folder_entry

COMPANY_ID = "11111111-2222-3333-4444-555555555555"
USER = {"id": "user-1", "email": "owner@acme.example.com"}


def docs(*specs):
    """``(name, file_id)`` pairs → documents, PRE-dedupe (the duplicates survive)."""
    out = []
    for name, file_id in specs:
        doc = build_document(entry(name, file_id=file_id))
        assert doc is not None, name
        out.append(doc)
    return out


# ────────────────────────── duplicates (H16) ──────────────────────────

class TestDuplicateSummary:
    def test_counts_copies_dropped_not_names_repeated(self):
        # Two names repeat; three copies will be dropped. The owner's question is
        # "did I lose a document?", which the copy count answers and the name count
        # does not — the client's real folder is 411 names collapsing 457 copies.
        collapsed, samples = duplicate_summary(docs(
            (FIXTURES[0], "a"), (FIXTURES[0], "b"), (FIXTURES[0], "c"),
            (FIXTURES[1], "d"), (FIXTURES[1], "e"),
            (FIXTURES[2], "f"),
        ))
        assert collapsed == 3
        assert dict(samples) == {FIXTURES[0]: 3, FIXTURES[1]: 2}

    def test_a_name_seen_once_is_not_a_duplicate(self):
        collapsed, samples = duplicate_summary(docs((FIXTURES[0], "a"), (FIXTURES[1], "b")))
        assert (collapsed, samples) == (0, ())

    def test_worst_offenders_come_first(self):
        _, samples = duplicate_summary(docs(
            (FIXTURES[0], "a"), (FIXTURES[0], "b"),
            (FIXTURES[1], "c"), (FIXTURES[1], "d"), (FIXTURES[1], "e"),
        ))
        assert [n for n, _ in samples] == [FIXTURES[1], FIXTURES[0]]

    def test_the_sample_list_is_bounded(self, monkeypatch):
        monkeypatch.setattr(coa_drive, "MAX_DUPLICATE_SAMPLES", 3)
        pairs = []
        for i in range(10):
            pairs += [(f"CODE{i}_B{i}_PRODUCT.pdf", f"a{i}"), (f"CODE{i}_B{i}_PRODUCT.pdf", f"b{i}")]
        collapsed, samples = duplicate_summary(docs(*pairs))
        assert collapsed == 10          # every copy is still counted
        assert len(samples) == 3        # only the display list is capped


# ───────────────────── filename quality (§11) ─────────────────────

class TestThinDocuments:
    def test_a_single_token_filename_is_hard_to_find(self):
        # `129LR.pdf` is real, and is the entire population of this category in the
        # client's folder: no batch, no product name, nothing to narrow with.
        thin = thin_documents(docs(("129LR.pdf", "a"), (FIXTURES[0], "b")))
        assert [d.name for d in thin] == ["129LR.pdf"]

    def test_two_tokens_is_enough_to_be_findable(self):
        assert thin_documents(docs(("ACET-B1042.pdf", "a"))) == []

    def test_a_scan_named_file_is_flagged_even_though_it_indexes(self):
        thin = thin_documents(docs(("scan0012.pdf", "a")))
        assert len(thin) == 1


# ──────────────────────── the walk records it ────────────────────────

class TestWalkDiagnostics:
    @pytest.mark.asyncio
    async def test_the_same_certificate_in_two_month_folders_is_reported(self):
        # F4 — the client's January and July folders both hold `100MC3_100.26P001`.
        # Deduped to one document, but the owner is told one copy was merged.
        tree = {FOLDER_ID: [folder_entry("jan"), folder_entry("jul")],
                "jan": [entry(FIXTURES[0], file_id="jan-1")],
                "jul": [entry(FIXTURES[0], file_id="jul-1")]}
        result = await walk_folder(FOLDER_ID, API_KEY, client=httpx.AsyncClient(transport=drive(tree)))
        assert result.indexed == 1
        assert result.duplicates_collapsed == 1
        assert dict(result.duplicate_samples) == {FIXTURES[0]: 2}

    @pytest.mark.asyncio
    async def test_a_pdf_with_no_link_is_counted_not_vanished(self):
        # H7's failure mode, seen from the owner's side: a file we cannot serve used
        # to disappear from every count, leaving a short index with no explanation.
        tree = {FOLDER_ID: [entry(FIXTURES[0]), entry(FIXTURES[1], link="")]}
        result = await walk_folder(FOLDER_ID, API_KEY, client=httpx.AsyncClient(transport=drive(tree)))
        assert (result.indexed, result.unindexable, result.files_seen) == (1, 1, 2)

    @pytest.mark.asyncio
    async def test_a_pdf_with_no_searchable_name_is_counted(self):
        tree = {FOLDER_ID: [entry("___.pdf")]}
        result = await walk_folder(FOLDER_ID, API_KEY, client=httpx.AsyncClient(transport=drive(tree)))
        assert (result.indexed, result.unindexable) == (0, 1)

    @pytest.mark.asyncio
    async def test_a_non_pdf_is_ignored_not_unindexable(self):
        tree = {FOLDER_ID: [entry("notes.txt", mime="text/plain")]}
        result = await walk_folder(FOLDER_ID, API_KEY, client=httpx.AsyncClient(transport=drive(tree)))
        assert (result.ignored_non_pdf, result.unindexable) == (1, 0)

    @pytest.mark.asyncio
    async def test_the_walk_timestamps_itself(self):
        result = await walk_folder(
            FOLDER_ID, API_KEY, client=httpx.AsyncClient(transport=drive({FOLDER_ID: [entry(FIXTURES[0])]})))
        assert result.walked_at.startswith("20")
        assert "T" in result.walked_at


# ─────────────────────────── the payload ───────────────────────────

class TestFolderReport:
    def test_reports_every_counter_the_panel_renders(self):
        result = WalkResult(
            documents=tuple(docs((FIXTURES[0], "a"), ("129LR.pdf", "b"))),
            folders_visited=3, files_seen=9, ignored_non_pdf=2, capped=(),
            unindexable=1, duplicates_collapsed=4,
            duplicate_samples=((FIXTURES[0], 3),), walked_at="2026-07-29T10:00:00+00:00")
        report = folder_report(result)
        assert report["indexed"] == 2
        assert report["folders"] == 3
        assert report["files_seen"] == 9
        assert report["ignored_non_pdf"] == 2
        assert report["unindexable"] == 1
        assert report["duplicates_collapsed"] == 4
        assert report["duplicate_samples"] == [{"name": FIXTURES[0], "copies": 3}]
        assert report["hard_to_find"] == 1
        assert report["walked_at"] == "2026-07-29T10:00:00+00:00"

    def test_hard_to_find_samples_are_the_cleaned_up_filename(self):
        result = WalkResult(documents=tuple(docs(("129LR.pdf", "a"))), folders_visited=1,
                            files_seen=1, ignored_non_pdf=0, capped=())
        assert folder_report(result)["hard_to_find_samples"] == ["129LR"]

    def test_the_sample_list_is_bounded_but_the_count_is_not(self, monkeypatch):
        monkeypatch.setattr(coa_drive, "MAX_THIN_SAMPLES", 2)
        thin = tuple(docs(*[(f"CODE{i}.pdf", f"a{i}") for i in range(7)]))
        report = folder_report(WalkResult(documents=thin, folders_visited=1, files_seen=7,
                                         ignored_non_pdf=0, capped=()))
        assert report["hard_to_find"] == 7
        assert len(report["hard_to_find_samples"]) == 2

    def test_an_unwalked_folder_reports_no_timestamp_rather_than_an_empty_string(self):
        report = folder_report(WalkResult(documents=(), folders_visited=0, files_seen=0,
                                          ignored_non_pdf=0, capped=()))
        assert report["walked_at"] is None


# ──────────────────────── through the cache ────────────────────────

class TestDiagnosticsSurviveTheCache:
    """The counters describe a walk, so a cached listing has to carry them: derived
    from ``documents`` they would all read zero, which is a silent wrong answer."""

    def test_round_trip(self):
        original = WalkResult(
            documents=tuple(docs((FIXTURES[0], "a"), ("129LR.pdf", "b"))),
            folders_visited=8, files_seen=2240, ignored_non_pdf=2, capped=("files",),
            unindexable=5, duplicates_collapsed=457,
            duplicate_samples=((FIXTURES[0], 2), (FIXTURES[1], 3)),
            walked_at="2026-07-29T10:00:00+00:00")
        restored = deserialize_index(decode_payload(encode_index(original)))
        assert restored.unindexable == 5
        assert restored.duplicates_collapsed == 457
        assert dict(restored.duplicate_samples) == {FIXTURES[0]: 2, FIXTURES[1]: 3}
        assert restored.walked_at == "2026-07-29T10:00:00+00:00"
        assert restored.capped == ("files",)

    def test_a_previous_version_entry_is_a_miss_not_a_zeroed_report(self):
        # A v1 entry has no diagnostics at all, and reading it would tell an owner
        # with 457 duplicate copies that they have none.
        v1 = '{"v":1,"folders_visited":8,"files_seen":2240,"ignored_non_pdf":0,"capped":[],"files":[]}'
        assert deserialize_index(v1) is None

    def test_junk_in_the_duplicate_samples_is_dropped_not_raised(self):
        raw = ('{"v":2,"folders_visited":1,"files_seen":1,"ignored_non_pdf":0,"capped":[],'
               '"duplicate_samples":[["ok.pdf",2],["bad"],null,["once",1]],"files":[]}')
        restored = deserialize_index(raw)
        assert restored.duplicate_samples == (("ok.pdf", 2),)


# ─────────────────────────── the endpoint ───────────────────────────

class _FakeCursor:
    def __init__(self, row):
        self._row = row

    def execute(self, sql, params=None):
        pass

    def fetchone(self):
        return self._row

    def close(self):
        pass


class _FakeConn:
    def __init__(self, row):
        self._row = row

    def cursor(self):
        return _FakeCursor(self._row)

    def close(self):
        pass


_REAL_LOAD_INDEX = coa_drive.load_index


def get(monkeypatch, *, transport=None, overrides=None, row_missing=False, times=1):
    """GET the report endpoint with the DB and Drive both faked."""
    row = None if row_missing else (overrides if overrides is not None
                                    else {"coa": {"folder_id": FOLDER_ID}},)
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConn(row))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m, "r", None)          # no Redis: only the memo caches (H13)
    monkeypatch.setenv("GOOGLE_DRIVE_API_KEY", API_KEY)

    if transport is not None:
        async def patched(company_id, folder_id, **kw):
            async with httpx.AsyncClient(transport=transport) as client:
                return await _REAL_LOAD_INDEX(company_id, folder_id, **{**kw, "client": client})

        monkeypatch.setattr(coa_drive, "load_index", patched)

    m.app.dependency_overrides[m.get_current_user] = lambda: USER
    try:
        client = TestClient(m.app)
        responses = [client.get(f"/api/companies/{COMPANY_ID}/coa/report") for _ in range(times)]
        return responses[0] if times == 1 else responses
    finally:
        m.app.dependency_overrides.clear()


class TestReportEndpoint:
    def test_reports_the_library(self, monkeypatch):
        tree = {FOLDER_ID: [folder_entry("jan"), folder_entry("jul")],
                "jan": [entry(FIXTURES[0], file_id="jan-1"), entry("129LR.pdf")],
                "jul": [entry(FIXTURES[0], file_id="jul-1"), entry("notes.txt", mime="text/plain")]}
        body = get(monkeypatch, transport=drive(tree)).json()
        assert body["status"] == "ok"
        assert body["indexed"] == 2
        assert body["folders"] == 3
        assert body["duplicates_collapsed"] == 1
        assert body["hard_to_find"] == 1
        assert body["ignored_non_pdf"] == 1
        assert body["walked_at"]

    def test_is_cache_first_so_opening_the_page_does_not_re_walk(self, monkeypatch):
        # Unlike Test Connection, which forces. Rendering a settings panel must not
        # spend a Drive walk per page view.
        calls = []
        transport = drive({FOLDER_ID: [entry(FIXTURES[0])]}, requests=calls)
        first, second = get(monkeypatch, transport=transport, times=2)
        assert first.status_code == second.status_code == 200
        assert first.json()["from_cache"] is False
        assert second.json()["from_cache"] is True
        assert len(calls) == 1

    def test_an_unconfigured_bot_is_told_to_save_a_link_first(self, monkeypatch):
        resp = get(monkeypatch, overrides=({},))
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "NO_COA_FOLDER"

    def test_another_owners_bot_is_a_404(self, monkeypatch):
        assert get(monkeypatch, row_missing=True).status_code == 404

    def test_drive_refusing_is_not_an_empty_library(self, monkeypatch):
        # H15 — `userRateLimitExceeded` and a revoked share both land on 403, and
        # neither means "you have no certificates".
        def refuse(request):
            return httpx.Response(403, json={"error": {"message": "rateLimitExceeded"}})

        resp = get(monkeypatch, transport=httpx.MockTransport(refuse))
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert detail["code"] == "COA_UNREACHABLE"
        assert "Anyone with the link" in detail["message"]

    def test_owner_facing_errors_name_no_folder_id_key_or_url(self, monkeypatch):
        # H11 + H3 — the folder ID is the only thing protecting a link-shared folder,
        # and the API key travels in the request URL.
        def refuse(request):
            return httpx.Response(403, json={"error": {"message": f"denied {FOLDER_ID} key={API_KEY}"}})

        body = get(monkeypatch, transport=httpx.MockTransport(refuse)).text
        assert FOLDER_ID not in body
        assert API_KEY not in body
        assert "key=" not in body
        assert "googleapis" not in body

    def test_a_healthy_folder_reports_nothing_to_fix(self, monkeypatch):
        body = get(monkeypatch, transport=drive({FOLDER_ID: [entry(n) for n in FIXTURES]})).json()
        assert body["indexed"] == len(FIXTURES)
        assert body["unindexable"] == 0
        assert body["duplicates_collapsed"] == 0
        assert body["hard_to_find"] == 0
        assert body["capped"] == []
