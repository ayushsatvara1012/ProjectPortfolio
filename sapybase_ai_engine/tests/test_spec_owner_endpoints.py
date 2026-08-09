"""Spec finder Phase 2 - the owner's Test Connection and library report.

Plan `docs/spec-finder-plan.md` §8, §11.

Same two jobs as the certificate versions:

* **H2** - "connected, 0 files" must be a distinct, visible outcome from "connected,
  N files". A Shared Drive folder read without the ``allDrives`` flags returns zero
  files with HTTP 200, and if that renders as a green tick the owner ships a bot that
  finds nothing forever while nothing looks broken.
* **H11 / H3** - no folder ID, Drive URL, or API key in any owner-facing message.

Plus the one that is new here and is the point of D4: these endpoints must read the
SPEC folder and never the certificate one. A bot with a certificate folder and no
specification folder is not configured for this feature, however much it looks like
it is from the other field.
"""
import httpx
import pytest
from fastapi.testclient import TestClient

import main as m
from services import spec_drive
from tests.test_coa_drive import API_KEY, drive, entry, folder_entry

COMPANY_ID = "11111111-2222-3333-4444-555555555555"
SPEC_FOLDER = "1KCRfrRQ9pLmXt4vB2nHy7WqZs3EdCa6T"
COA_FOLDER = "1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U"
USER = {"id": "user-1", "email": "owner@acme.example.com"}

SHEETS = [
    "Acetone_USP-NF_Spec.pdf",
    "Acetone_LR_Spec.pdf",
    "Xylene_Spec.pdf",
]


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


# Captured once, at import. Reading it inside the helper would re-wrap whatever a
# previous call() in the same test had already installed.
_REAL_LOAD_INDEX = spec_drive.load_index


def call(monkeypatch, *, transport=None, overrides=None, row_missing=False,
         api_key=API_KEY, path="test-connection"):
    """Hit the endpoint with the DB and Drive both faked."""
    row = None if row_missing else (overrides if overrides is not None
                                    else {"spec": {"folder_id": SPEC_FOLDER}},)
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConn(row))
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    monkeypatch.setattr(m, "r", None)          # no Redis: every call walks (H13)
    if api_key is None:
        monkeypatch.delenv("GOOGLE_DRIVE_API_KEY", raising=False)
    else:
        monkeypatch.setenv("GOOGLE_DRIVE_API_KEY", api_key)

    if transport is not None:
        async def patched(company_id, folder_id, **kw):
            async with httpx.AsyncClient(transport=transport) as client:
                return await _REAL_LOAD_INDEX(company_id, folder_id, **{**kw, "client": client})

        monkeypatch.setattr(spec_drive, "load_index", patched)

    m.app.dependency_overrides[m.get_current_user] = lambda: USER
    client = TestClient(m.app)
    url = f"/api/companies/{COMPANY_ID}/spec/{path}"
    try:
        return client.get(url) if path == "report" else client.post(url)
    finally:
        m.app.dependency_overrides.clear()


class TestSuccess:
    def test_reports_indexed_and_folder_counts(self, monkeypatch):
        tree = {SPEC_FOLDER: [folder_entry("food"), entry(SHEETS[0])],
                "food": [entry(SHEETS[1]), entry(SHEETS[2])]}
        resp = call(monkeypatch, transport=drive(tree))
        assert resp.status_code == 200
        body = resp.json()
        assert body["connected"] is True
        assert body["indexed"] == 3
        assert body["folders"] == 2
        assert "3 specification sheets" in body["message"]

    def test_singular_wording_for_one_sheet(self, monkeypatch):
        body = call(monkeypatch, transport=drive({SPEC_FOLDER: [entry(SHEETS[0])]})).json()
        assert "1 specification sheet " in body["message"]
        assert "1 specification sheets" not in body["message"]

    def test_the_message_never_says_certificate(self, monkeypatch):
        # The copy is the owner's only signal about WHICH folder they just tested.
        body = call(monkeypatch, transport=drive({SPEC_FOLDER: [entry(SHEETS[0])]})).json()
        assert "certificate" not in body["message"].lower()

    def test_reports_the_guard_rails_it_hit(self, monkeypatch):
        monkeypatch.setattr("services.coa_drive.MAX_FILES", 2)
        tree = {SPEC_FOLDER: [entry(f"Product{i}_Spec.pdf") for i in range(6)]}
        body = call(monkeypatch, transport=drive(tree)).json()
        assert "files" in body["capped"]


class TestEmptyFolderIsNotSuccess:
    """H2 - the failure mode that looks exactly like an empty folder."""

    def test_zero_files_reads_differently_from_n_files(self, monkeypatch):
        empty = call(monkeypatch, transport=drive({SPEC_FOLDER: []})).json()
        full = call(monkeypatch, transport=drive({SPEC_FOLDER: [entry(SHEETS[0])]})).json()
        assert empty["indexed"] == 0 and empty["files_seen"] == 0
        assert empty["message"] != full["message"]

    def test_the_empty_message_names_the_shared_drive_cause(self, monkeypatch):
        body = call(monkeypatch, transport=drive({SPEC_FOLDER: []})).json()
        assert "empty" in body["message"].lower()
        assert "shared drive" in body["message"].lower()

    def test_a_folder_of_non_pdfs_says_so_specifically(self, monkeypatch):
        tree = {SPEC_FOLDER: [entry("notes.txt", mime="text/plain"),
                              entry("book.xlsx", mime="application/vnd.ms-excel")]}
        body = call(monkeypatch, transport=drive(tree)).json()
        assert body["indexed"] == 0 and body["files_seen"] == 2
        assert "pdf" in body["message"].lower()


class TestItReadsTheRightFolder:
    """D4 - the two folders are separate settings, and this is where that is proved."""

    def test_a_bot_with_only_a_certificate_folder_is_not_configured(self, monkeypatch):
        resp = call(monkeypatch, overrides={"coa": {"folder_id": COA_FOLDER}})
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "NO_SPEC_FOLDER"

    def test_a_bot_with_no_overrides_at_all_is_not_configured(self, monkeypatch):
        resp = call(monkeypatch, overrides={})
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "NO_SPEC_FOLDER"

    def test_it_walks_the_spec_folder_and_not_the_certificate_one(self, monkeypatch):
        requests = []
        overrides = {"coa": {"folder_id": COA_FOLDER}, "spec": {"folder_id": SPEC_FOLDER}}
        call(monkeypatch, overrides=overrides,
             transport=drive({SPEC_FOLDER: [entry(SHEETS[0])]}, requests=requests))
        queried = " ".join(str(req.url) for req in requests)
        assert SPEC_FOLDER in queried
        assert COA_FOLDER not in queried

    def test_a_hand_edited_folder_id_never_reaches_drive(self, monkeypatch):
        # H1 on the read path.
        resp = call(monkeypatch, overrides={"spec": {"folder_id": "1abc' or '1'='1"}})
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "NO_SPEC_FOLDER"

    def test_another_owners_bot_is_a_404(self, monkeypatch):
        resp = call(monkeypatch, row_missing=True)
        assert resp.status_code == 404


class TestFailuresNameNothing:
    """H11 / H3 - the folder ID is the only secret protecting a link-shared folder."""

    def test_an_unreachable_folder_reports_without_the_id(self, monkeypatch):
        resp = call(monkeypatch, transport=drive({}, status=403))
        assert resp.status_code in (400, 403, 503)
        body = resp.json()["detail"]
        assert SPEC_FOLDER not in body["message"]
        assert "googleapis" not in body["message"]
        assert API_KEY not in body["message"]

    def test_a_missing_platform_key_is_reported_as_our_problem(self, monkeypatch):
        resp = call(monkeypatch, api_key=None, transport=drive({SPEC_FOLDER: []}))
        assert resp.status_code >= 400
        assert API_KEY not in resp.text

    def test_the_error_code_says_which_library_failed(self, monkeypatch):
        # An owner with two folders must not be sent to check the wrong one.
        resp = call(monkeypatch, transport=drive({}, status=403))
        assert resp.json()["detail"]["code"] == "SPEC_UNREACHABLE"


class TestReport:
    def test_it_returns_the_library_health_figures(self, monkeypatch):
        tree = {SPEC_FOLDER: [entry(n) for n in SHEETS]}
        body = call(monkeypatch, transport=drive(tree), path="report").json()
        assert body["status"] == "ok"
        assert body["indexed"] == 3
        assert body["hard_to_find"] == 0
        assert "duplicate_samples" in body

    def test_it_carries_no_failed_lookup_counter(self, monkeypatch):
        # That counter is the confidential library's tripwire. A public browsable
        # search has nothing to guess at, and reporting one here would invite the
        # owner to read normal typos as an attack.
        body = call(monkeypatch, transport=drive({SPEC_FOLDER: [entry(SHEETS[0])]}),
                    path="report").json()
        assert "failed_lookups" not in body

    def test_an_unconfigured_bot_reports_nothing(self, monkeypatch):
        resp = call(monkeypatch, overrides={}, path="report")
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "NO_SPEC_FOLDER"

    def test_the_report_never_leaks_the_folder_id(self, monkeypatch):
        tree = {SPEC_FOLDER: [entry(n) for n in SHEETS]}
        resp = call(monkeypatch, transport=drive(tree), path="report")
        assert SPEC_FOLDER not in resp.text
