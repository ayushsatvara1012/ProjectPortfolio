"""Spec finder Phase 3 - the widget endpoint (`GET /api/widget/spec`).

Plan `docs/spec-finder-plan.md` §6, §10.3.

This file exists to hold the line that the specification panel is NOT the COA panel.
The certificate endpoint returns one row or none, refuses identically whatever went
wrong, and locks a visitor out after three misses. This one returns a ranked list,
tells `too_broad` apart from `empty` on purpose, and has no throttle at all - and
every one of those differences is a decision (D1), not an omission.

What it shares with COA is the part with no policy in it: the folder ID never reaches
the visitor (H11), a Drive outage is a 503 and never "we have nothing", and a
hand-edited folder ID reads as unconfigured rather than as an error (H1).
"""
import json

import httpx
import pytest
from fastapi.testclient import TestClient
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

import main as m
from services import spec_drive
from tests.test_coa_drive import API_KEY, FOLDER_ID, drive
from tests.test_spec_drive import FIXTURES, entry

FastAPICache.init(InMemoryBackend(), prefix="test-cache-spec-endpoint")

COMPANY_ID = "77777777-8888-9999-aaaa-bbbbbbbbbbbb"

_REAL_LOAD_INDEX = spec_drive.load_index


def company(**over):
    base = {
        "id": COMPANY_ID, "company_name": "Acme", "vertical": "chemical",
        "pack_overrides": {"spec": {"folder_id": FOLDER_ID}},
        "tier": "PRO", "allowed_origin": "https://acme.example.com",
    }
    base.update(over)
    return base


def _patch_drive(monkeypatch, transport):
    """Route every walk through a mock transport, and never reuse a cache entry."""
    monkeypatch.setattr(m, "r", None)
    monkeypatch.setenv("GOOGLE_DRIVE_API_KEY", API_KEY)
    spec_drive.reset_index_memo()
    spec_drive.reset_breakers()
    spec_drive.reset_forced_walk_gate()

    async def patched_load(company_id, folder_id, **kw):
        async with httpx.AsyncClient(transport=transport) as client:
            return await _REAL_LOAD_INDEX(company_id, folder_id, **{**kw, "client": client})

    monkeypatch.setattr(spec_drive, "load_index", patched_load)


def widget_get(monkeypatch, *, names=None, status=200, comp=None, query="acetone"):
    """GET /api/widget/spec with Drive faked and the api-key dependency overridden.

    No `visitor_id` parameter, deliberately: it exists on the COA endpoint only to
    bind the throttle, and there is no throttle here (D1).
    """
    transport = drive({FOLDER_ID: [entry(n) for n in (names or FIXTURES)]}, status=status)
    _patch_drive(monkeypatch, transport)
    m.app.dependency_overrides[m.verify_api_key_and_origin] = lambda: (comp or company())
    try:
        url = "/api/widget/spec" + (f"?q={query}" if query is not None else "")
        return TestClient(m.app).get(url, headers={"x-api-key": "spec-endpoint-key"})
    finally:
        m.app.dependency_overrides.clear()


class TestRankedResults:
    def test_a_product_name_returns_every_sheet_for_it(self, monkeypatch):
        body = widget_get(monkeypatch, query="acetone").json()
        assert body["status"] == "ok"
        assert body["configured"] is True
        assert len(body["results"]) == 6

    def test_a_second_word_narrows_the_list(self, monkeypatch):
        # The "related searches" step the requirement describes (§1). If this ever
        # stops narrowing, the panel becomes a list nobody can get through.
        wide = widget_get(monkeypatch, query="acetone").json()
        narrow = widget_get(monkeypatch, query="acetone USP").json()
        assert len(narrow["results"]) < len(wide["results"])
        assert narrow["status"] == "ok"

    def test_a_row_carries_a_cleaned_display_and_both_links(self, monkeypatch):
        row = widget_get(monkeypatch, query="xylene").json()["results"][0]
        assert row["display"] == "Xylene · Spec"
        assert ".pdf" not in row["display"]
        assert row["view_url"].startswith("https://drive.google.com/")
        # H8 - Download must not target the HTML viewer page, which would save an
        # HTML blob under a .pdf name.
        assert row["download_url"] == f"https://drive.google.com/uc?export=download&id={row['id']}"

    def test_the_download_extension_follows_the_source_file(self, monkeypatch):
        # §15 - this client's folder is 100% PDF, but `is_pdf` accepts several
        # extensions and a browsable library may hold a .docx. Saving that under a
        # .pdf name hands the customer a file their reader refuses, which is H8's
        # corrupt download from the other direction. The widget cannot infer it:
        # `display` has the extension stripped and the URL carries an ID, not a name.
        body = widget_get(monkeypatch, names=["Toluene_Spec.docx"], query="toluene").json()
        assert body["results"][0]["ext"] == "docx"
        assert widget_get(monkeypatch, query="xylene").json()["results"][0]["ext"] == "pdf"

    def test_the_list_is_capped_and_says_how_many_matched(self, monkeypatch):
        # R3 - `total_matched` is what lets the panel say "showing 8 of 12" and tell
        # the visitor that typing more will narrow it. A hint, not a state.
        names = [f"Acetone_{i}_Spec.pdf" for i in range(12)]
        body = widget_get(monkeypatch, names=names, query="acetone").json()
        assert len(body["results"]) == spec_drive.RESULT_LIMIT
        assert body["total_matched"] == 12

    def test_visitors_see_filenames_by_design(self, monkeypatch):
        # The exact opposite of the COA rule, and it is the feature: a browsable list
        # is filenames. H10 binds the MODEL's observation (Phase 4), never this.
        displays = [r["display"] for r in widget_get(monkeypatch, query="acetone").json()["results"]]
        assert any("USP" in d for d in displays)


class TestTheFourStatuses:
    """`status` is what the panel renders, never `len(results)`."""

    def test_a_specific_query_we_have_nothing_for_is_empty(self, monkeypatch):
        body = widget_get(monkeypatch, query="nonsense9999").json()
        assert body["status"] == "empty"
        assert body["results"] == []

    def test_a_query_that_fails_to_select_is_too_broad(self, monkeypatch):
        # §4.1 measured on the real folder: `spec` matches 1,027 of 1,086. Above the
        # guard's library floor, a token that matches most of the library returns no
        # rows and asks for more typing instead of an arbitrary eight.
        names = [f"Product{i}_LR_Spec.pdf" for i in range(spec_drive.BROAD_GUARD_MIN_LIBRARY + 20)]
        body = widget_get(monkeypatch, names=names, query="spec").json()
        assert body["status"] == "too_broad"
        assert body["results"] == []

    def test_too_broad_and_empty_are_distinguishable(self, monkeypatch):
        # Deliberately the opposite of COA's C3. A visitor who typed too little must
        # be told to type more; one who named a product we do not stock must be told
        # we have nothing. Collapsing them gives both the wrong instruction.
        names = [f"Product{i}_LR_Spec.pdf" for i in range(spec_drive.BROAD_GUARD_MIN_LIBRARY + 20)]
        broad = widget_get(monkeypatch, names=names, query="spec").json()
        empty = widget_get(monkeypatch, names=names, query="nonsense9999").json()
        assert broad["status"] != empty["status"]

    @pytest.mark.parametrize("query", ["", "a", "___", "...", None])
    def test_a_query_too_small_to_search_is_too_short(self, monkeypatch, query):
        # H6 - "every query token must match" is vacuously true for zero tokens, so
        # `___` would otherwise return the whole folder. R1: the panel renders this
        # as its prompt state, so the visitor sees one instruction, not two.
        body = widget_get(monkeypatch, query=query).json()
        assert body["status"] == "too_short"
        assert body["results"] == []


class TestConfiguration:
    def test_a_non_chemical_bot_404s(self, monkeypatch):
        assert widget_get(monkeypatch, comp=company(vertical=None)).status_code == 404

    def test_a_generic_bot_404s_even_with_a_folder_configured(self, monkeypatch):
        resp = widget_get(monkeypatch, comp=company(vertical=""))
        assert resp.status_code == 404

    def test_an_unconfigured_bot_reports_configured_false_not_an_error(self, monkeypatch):
        body = widget_get(monkeypatch, comp=company(pack_overrides={})).json()
        assert body == {"status": "unconfigured", "results": [], "total_matched": 0,
                        "configured": False}

    def test_a_coa_folder_alone_does_not_configure_the_spec_panel(self, monkeypatch):
        # The two folders are independent fields by requirement (D4). A bot with
        # certificates configured and no specifications must not serve certificates
        # from the specification panel.
        comp = company(pack_overrides={"coa": {"folder_id": FOLDER_ID}})
        assert widget_get(monkeypatch, comp=comp).json()["configured"] is False

    @pytest.mark.parametrize("hostile", ["x' or '1'='1", "short", "a&b", "has space"])
    def test_a_hand_edited_hostile_folder_id_reads_as_unconfigured(self, monkeypatch, hostile):
        # H1's read-time gate on the visitor path: `effective_spec_config` revalidates
        # on read, so a row edited around the API resolves to "" and Drive is never
        # called - reported as "feature off", not as an error.
        resp = widget_get(monkeypatch, comp=company(pack_overrides={"spec": {"folder_id": hostile}}))
        assert resp.status_code == 200
        assert resp.json()["configured"] is False


class TestOutage:
    def test_a_drive_outage_is_a_503(self, monkeypatch):
        resp = widget_get(monkeypatch, status=403)
        assert resp.status_code == 503
        assert resp.json()["detail"]["code"] == "SPEC_UNAVAILABLE"

    def test_an_outage_is_never_phrased_as_having_nothing(self, monkeypatch):
        # H15's half that applies here: "we have no specification for that" would be a
        # lie about the catalogue when the truth is that Drive is unreachable.
        message = widget_get(monkeypatch, status=403).json()["detail"]["message"].lower()
        assert "try again" in message
        assert "no specification" not in message and "not found" not in message


class TestNoThrottle:
    """D1 - none of the confidentiality machinery is carried over."""

    def test_repeated_misses_never_lock_the_panel(self, monkeypatch):
        # Three misses lock the COA panel for fifteen minutes. Here a miss is a typo,
        # and a visitor correcting their own spelling must not be shut out.
        for _ in range(6):
            resp = widget_get(monkeypatch, query="nonsense9999")
            assert resp.status_code == 200
            assert resp.json()["status"] == "empty"

    def test_the_endpoint_takes_no_visitor_id(self, monkeypatch):
        # Nothing binds to it, so accepting one would be collecting an identifier the
        # feature has no use for.
        import inspect as _inspect
        assert "visitor_id" not in _inspect.signature(m.search_spec).parameters


class TestLeaks:
    """H11 - the folder ID is the only thing protecting a link-shared folder."""

    def test_success_body_carries_no_folder_id_or_key(self, monkeypatch):
        body = json.dumps(widget_get(monkeypatch).json())
        assert FOLDER_ID not in body
        assert API_KEY not in body
        assert "key=" not in body

    @pytest.mark.parametrize("status", [403, 404, 500])
    def test_error_bodies_carry_no_folder_id_or_key(self, monkeypatch, status):
        body = json.dumps(widget_get(monkeypatch, status=status).json())
        assert FOLDER_ID not in body and API_KEY not in body
        assert "googleapis" not in body


class TestOneResolver:
    def test_the_endpoint_calls_the_shared_resolver(self, monkeypatch):
        # Phase 4 attaches the chat path to the same `spec_drive.resolve`, so the
        # panel and the conversation can never disagree about what a name finds.
        import inspect as _inspect
        assert "spec_drive.resolve" in _inspect.getsource(m.search_spec)

    def test_the_endpoint_shares_nothing_with_the_certificate_path(self, monkeypatch):
        source = __import__("inspect").getsource(m.search_spec)
        assert "coa_drive" not in source
        assert "coa_throttle" not in source
