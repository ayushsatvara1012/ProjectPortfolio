"""COA finder Phase 1 — the Test Connection endpoint (plan §13.4, H2, H11).

Test Connection exists to answer one question the owner cannot answer any other
way: *is my folder actually readable, and is there anything in it?* Its whole
reason for being deferred out of Phase 0 is that a button with no walker behind it
can only fake a success.

So the assertions here are about the two things that make it worth having:

* **H2** — "connected, 0 files" must be a distinct, visible outcome from
  "connected, N files". A Shared Drive folder read without the ``allDrives`` flags
  returns zero files with HTTP 200, and if that renders as a green tick the owner
  ships a bot that says "no certificates on file" forever.
* **H11 / H3** — no folder ID, Drive URL, or API key in any owner-facing message.
"""
import json

import httpx
import pytest
from fastapi.testclient import TestClient

import main as m
from services import coa_drive
from tests.test_coa_drive import API_KEY, FIXTURES, FOLDER_ID, drive, entry, folder_entry

COMPANY_ID = "11111111-2222-3333-4444-555555555555"
USER = {"id": "user-1", "email": "owner@acme.example.com"}


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
# previous call() in the same test had already installed, so the FIRST transport
# would silently win every subsequent call.
_REAL_LOAD_INDEX = coa_drive.load_index


def call(monkeypatch, *, transport=None, overrides=None, row_missing=False, api_key=API_KEY):
    """POST the endpoint with the DB and Drive both faked.

    ``api_key=None`` clears the platform key, which is the deployment that has not
    set ``GOOGLE_DRIVE_API_KEY`` yet.
    """
    row = None if row_missing else (overrides if overrides is not None
                                    else {"coa": {"folder_id": FOLDER_ID}},)
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

        monkeypatch.setattr(coa_drive, "load_index", patched)

    m.app.dependency_overrides[m.get_current_user] = lambda: USER
    try:
        return TestClient(m.app).post(f"/api/companies/{COMPANY_ID}/coa/test-connection")
    finally:
        m.app.dependency_overrides.clear()


class TestSuccess:
    def test_reports_indexed_and_folder_counts(self, monkeypatch):
        tree = {FOLDER_ID: [folder_entry("jan"), folder_entry("jul")],
                "jan": [entry(FIXTURES[0]), entry(FIXTURES[1])],
                "jul": [entry(FIXTURES[2])]}
        resp = call(monkeypatch, transport=drive(tree))
        assert resp.status_code == 200
        body = resp.json()
        assert body["connected"] is True
        assert body["indexed"] == 3
        assert body["folders"] == 3
        assert "3 certificates" in body["message"]

    def test_singular_wording_for_one_certificate(self, monkeypatch):
        resp = call(monkeypatch, transport=drive({FOLDER_ID: [entry(FIXTURES[0])]}))
        body = resp.json()
        assert "1 certificate " in body["message"]
        assert "1 certificates" not in body["message"]

    def test_reports_the_guard_rails_it_hit(self, monkeypatch):
        monkeypatch.setattr(coa_drive, "MAX_FILES", 2)
        tree = {FOLDER_ID: [entry(f"CODE{i}_B{i}_PRODUCT.pdf") for i in range(6)]}
        body = call(monkeypatch, transport=drive(tree)).json()
        assert "files" in body["capped"]


class TestEmptyFolderIsNotSuccess:
    """H2 — the failure mode that looks exactly like an empty folder."""

    def test_zero_files_reads_differently_from_n_files(self, monkeypatch):
        empty = call(monkeypatch, transport=drive({FOLDER_ID: []})).json()
        full = call(monkeypatch, transport=drive({FOLDER_ID: [entry(FIXTURES[0])]})).json()
        assert empty["indexed"] == 0 and empty["files_seen"] == 0
        assert empty["message"] != full["message"]

    def test_the_empty_message_names_the_shared_drive_cause(self, monkeypatch):
        body = call(monkeypatch, transport=drive({FOLDER_ID: []})).json()
        assert "empty" in body["message"].lower()
        assert "shared drive" in body["message"].lower()

    def test_a_folder_of_non_pdfs_says_so_specifically(self, monkeypatch):
        tree = {FOLDER_ID: [entry("notes.txt", mime="text/plain"),
                            entry("book.xlsx", mime="application/vnd.ms-excel")]}
        body = call(monkeypatch, transport=drive(tree)).json()
        assert body["indexed"] == 0
        assert body["files_seen"] == 2
        assert body["ignored_non_pdf"] == 2
        assert "PDF" in body["message"]


class TestFailures:
    def test_an_unconfigured_bot_is_told_to_save_a_link_first(self, monkeypatch):
        resp = call(monkeypatch, overrides=({},))
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "NO_COA_FOLDER"

    def test_a_bot_the_user_does_not_own_404s(self, monkeypatch):
        assert call(monkeypatch, row_missing=True).status_code == 404

    @pytest.mark.parametrize("status,expected", [(403, 400), (404, 400), (500, 503)])
    def test_drive_errors_map_to_owner_actionable_responses(self, monkeypatch, status, expected):
        resp = call(monkeypatch, transport=drive({}, status=status))
        assert resp.status_code == expected
        assert resp.json()["detail"]["code"] == "COA_UNREACHABLE"

    def test_h15_a_403_is_never_reported_as_an_empty_folder(self, monkeypatch):
        # `userRateLimitExceeded` and a revoked share both land on 403; neither
        # means "there are no certificates".
        body = call(monkeypatch, transport=drive({}, status=403)).json()
        message = body["detail"]["message"]
        assert "empty" not in message.lower()
        assert "anyone with the link" in message.lower()

    def test_a_missing_platform_key_is_a_503_not_a_500(self, monkeypatch):
        resp = call(monkeypatch, transport=drive({FOLDER_ID: []}), api_key=None)
        assert resp.status_code == 503
        assert "support" in resp.json()["detail"]["message"].lower()

    def test_a_hand_edited_hostile_folder_id_never_reaches_drive(self, monkeypatch):
        # H1 read-time gate: Phase 0 blocks this on save, but a row edited around
        # the API must not reach the Drive query either.
        requests = []
        resp = call(monkeypatch,
                    overrides=({"coa": {"folder_id": "abc' or '1'='1"}},),
                    transport=drive({}, requests))
        assert resp.status_code == 400
        assert requests == []


class TestNothingLeaks:
    """H11 / H3 — the folder ID is the one secret protecting a link-shared folder."""

    @pytest.mark.parametrize("status", [403, 404, 500])
    def test_error_bodies_carry_no_folder_id_key_or_url(self, monkeypatch, status):
        body = json.dumps(call(monkeypatch, transport=drive({}, status=status)).json())
        assert FOLDER_ID not in body
        assert API_KEY not in body
        assert "googleapis" not in body
        assert "key=" not in body

    def test_the_success_body_carries_no_folder_id_or_key(self, monkeypatch):
        body = json.dumps(call(monkeypatch, transport=drive({FOLDER_ID: [entry(FIXTURES[0])]})).json())
        assert FOLDER_ID not in body
        assert API_KEY not in body

    def test_no_filenames_are_returned(self, monkeypatch):
        # Test Connection reports counts. Filenames are the panel's job, and
        # keeping them out here is the same discipline H10 imposes on `get_coa`.
        body = json.dumps(call(monkeypatch, transport=drive({FOLDER_ID: [entry(FIXTURES[0])]})).json())
        assert "ACETONE" not in body.upper()


class TestAlwaysFresh:
    def test_it_forces_a_walk_rather_than_answering_from_cache(self, monkeypatch):
        # A Test Connection served from a 10-minute cache would tell the owner the
        # folder is fine after they had already broken the sharing setting.
        seen = {}
        real_load = coa_drive.load_index

        async def spy(company_id, folder_id, **kw):
            seen.update(kw)
            async with httpx.AsyncClient(transport=drive({FOLDER_ID: []})) as client:
                return await real_load(company_id, folder_id, **{**kw, "client": client})

        monkeypatch.setattr(coa_drive, "load_index", spy)
        call(monkeypatch)
        assert seen.get("force") is True
