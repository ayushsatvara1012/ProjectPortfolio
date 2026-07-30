"""Endpoint tests for GET /api/config's `features` flags — `sds_picker`
(get-sds-crash-fix-plan Phase 4a) and `coa_picker` (coa-finder-plan Phase 3).

Config-registry driven: true only when the company's pack actually declares
the backing tool — never a hardcoded `if vertical == "chemical"` check.

`coa_picker` adds one condition on top of tool presence: the company's own
Drive folder. get_coa is declared to every chemical bot, so tool presence alone
would open a panel that can only ever say "not set up".
"""
from fastapi.testclient import TestClient
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

import main as m

# get_config is @cache-decorated; the real app initializes FastAPICache with
# Redis in startup_event, which never runs under TestClient. An in-memory
# backend is enough to exercise the endpoint without a real cache service.
FastAPICache.init(InMemoryBackend(), prefix="test-cache")


class _FakeCursor:
    def execute(self, sql, params=None):
        pass

    def fetchall(self):
        return []

    def close(self):
        pass


class _FakeConn:
    def cursor(self):
        return _FakeCursor()


def _company(**over):
    base = {
        "id": "comp-1", "company_name": "Acme", "company_tone": None,
        "theme_color": "#000000", "allowed_origin": "https://acme.example.com",
        "system_prompt": "You are helpful.", "bot_name": "Bot", "logo_url": None,
        "initial_message": "Hi!", "quick_questions": None,
        "logo_shape": "circle", "custom_logo_url": None, "avatar_bg_style": None,
        "tier": "PRO", "role": "OWNER", "webhook_url": None,
        "email": "owner@acme.example.com", "handoff_redirect_url": None,
        "hide_branding": False, "vertical": "chemical", "pack_overrides": None,
        "teaser_config": None,
    }
    base.update(over)
    return base


def _get_config(monkeypatch, *, company=None, api_key="unique-test-key"):
    # Each test uses its own api-key string so /api/config's per-key cache
    # (_config_cache_key_builder) never returns a stale cross-test response.
    company = _company() if company is None else company
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConn())
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.verify_api_key_and_origin] = lambda: company
    try:
        tc = TestClient(m.app)
        return tc.get("/api/config", headers={"x-api-key": api_key})
    finally:
        m.app.dependency_overrides.clear()


COA_FOLDER = "1wsEGabcdefghij_-"


def test_chemical_pack_has_sds_picker_true(monkeypatch):
    resp = _get_config(monkeypatch, company=_company(vertical="chemical"),
                       api_key="key-chemical")
    assert resp.status_code == 200
    assert resp.json()["features"]["sds_picker"] is True


def test_generic_bot_has_sds_picker_false(monkeypatch):
    resp = _get_config(monkeypatch, company=_company(vertical=None),
                       api_key="key-generic")
    assert resp.status_code == 200
    assert resp.json()["features"] == {"sds_picker": False, "coa_picker": False}


def test_coa_picker_true_when_the_bot_has_a_folder(monkeypatch):
    resp = _get_config(
        monkeypatch,
        company=_company(vertical="chemical",
                         pack_overrides={"coa": {"folder_id": COA_FOLDER}}),
        api_key="key-coa-configured")
    assert resp.status_code == 200
    assert resp.json()["features"]["coa_picker"] is True


def test_coa_picker_false_for_a_chemical_bot_with_no_folder(monkeypatch):
    # get_coa IS declared for this bot, so this is the case tool presence alone
    # would get wrong: the card must degrade to its mini-form, not open a panel.
    resp = _get_config(monkeypatch, company=_company(vertical="chemical"),
                       api_key="key-coa-unconfigured")
    assert resp.status_code == 200
    assert resp.json()["features"]["coa_picker"] is False


def test_coa_folder_id_never_reaches_the_widget_config(monkeypatch):
    # §11 — the folder ID is the only thing protecting a link-shared folder. The
    # flag may reveal that a library exists; the identifier must not travel.
    resp = _get_config(
        monkeypatch,
        company=_company(vertical="chemical",
                         pack_overrides={"coa": {"folder_id": COA_FOLDER}}),
        api_key="key-coa-leak")
    assert resp.status_code == 200
    assert COA_FOLDER not in resp.text
