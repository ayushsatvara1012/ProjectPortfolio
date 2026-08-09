"""Spec finder Phase 3 - `GET /api/config`'s `features.spec_picker` flag.

Plan `docs/spec-finder-plan.md` §10.3 R5, D3.

Two conditions, and the second is the one that matters: `get_product_spec` is
declared to every chemical bot, so tool presence alone would open a panel for a
company that has saved no folder - a panel that could only ever say "not set up".
With the flag false the card degrades to its mini-form and the visitor gets the
catalog answer `get_product_spec` has always given. That is the zero-regression
contract (D3), and it is why no existing bot changes behaviour on deploy.

The flag hangs off `get_product_spec` rather than a tool of its own because D8
declares none - R5 records that the flag name and the tool name deliberately differ.
"""
from fastapi.testclient import TestClient
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

import main as m

FastAPICache.init(InMemoryBackend(), prefix="test-cache-spec-feature")

SPEC_FOLDER = "1KCRfrRQabcdefghij_-"
COA_FOLDER = "1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U"


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


def _get_config(monkeypatch, *, company=None, api_key="spec-feature-key"):
    # A distinct api key per test: /api/config caches per key, so a shared one would
    # answer a later test from an earlier company's payload.
    company = _company() if company is None else company
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConn())
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.verify_api_key_and_origin] = lambda: company
    try:
        return TestClient(m.app).get("/api/config", headers={"x-api-key": api_key})
    finally:
        m.app.dependency_overrides.clear()


def test_true_for_a_chemical_bot_with_a_spec_folder(monkeypatch):
    resp = _get_config(
        monkeypatch,
        company=_company(pack_overrides={"spec": {"folder_id": SPEC_FOLDER}}),
        api_key="spec-feature-configured")
    assert resp.status_code == 200
    assert resp.json()["features"]["spec_picker"] is True


def test_false_for_a_chemical_bot_with_no_folder(monkeypatch):
    # The case tool presence alone gets wrong, and the D3 fallback that keeps every
    # existing bot on its current behaviour.
    resp = _get_config(monkeypatch, api_key="spec-feature-unconfigured")
    assert resp.json()["features"]["spec_picker"] is False


def test_a_coa_folder_does_not_enable_the_spec_panel(monkeypatch):
    # Two independent folders (D4). A bot that configured certificates and never
    # configured specifications must not get a specification panel.
    resp = _get_config(
        monkeypatch,
        company=_company(pack_overrides={"coa": {"folder_id": COA_FOLDER}}),
        api_key="spec-feature-coa-only")
    assert resp.json()["features"]["spec_picker"] is False
    assert resp.json()["features"]["coa_picker"] is True


def test_the_two_flags_are_independent(monkeypatch):
    resp = _get_config(
        monkeypatch,
        company=_company(pack_overrides={"spec": {"folder_id": SPEC_FOLDER}}),
        api_key="spec-feature-spec-only")
    features = resp.json()["features"]
    assert features["spec_picker"] is True
    assert features["coa_picker"] is False


def test_false_for_a_generic_bot_with_a_folder_saved(monkeypatch):
    # No pack means no `get_product_spec`, so there is nothing for a panel to search
    # even if a folder somehow reached the row.
    resp = _get_config(
        monkeypatch,
        company=_company(vertical=None,
                         pack_overrides={"spec": {"folder_id": SPEC_FOLDER}}),
        api_key="spec-feature-generic")
    assert resp.json()["features"]["spec_picker"] is False


def test_a_hostile_folder_id_does_not_enable_the_panel(monkeypatch):
    # H1 on read: a row edited around the API resolves to "" through
    # `effective_spec_config`, so the flag is false and the panel never opens.
    resp = _get_config(
        monkeypatch,
        company=_company(pack_overrides={"spec": {"folder_id": "x' or '1'='1"}}),
        api_key="spec-feature-hostile")
    assert resp.json()["features"]["spec_picker"] is False


def test_the_spec_hub_card_is_hidden_until_a_folder_is_saved(monkeypatch):
    # An unconfigured picker card used to still render and silently degrade to
    # the old mini-form — indistinguishable from the real feature to a visitor.
    # It must not appear in `hub_cards` at all until the owner finishes setup.
    resp = _get_config(monkeypatch, api_key="spec-feature-hub-hidden")
    ids = [c["id"] for c in resp.json()["hub_cards"]]
    assert "spec" not in ids


def test_the_spec_hub_card_appears_once_a_folder_is_saved(monkeypatch):
    resp = _get_config(
        monkeypatch,
        company=_company(pack_overrides={"spec": {"folder_id": SPEC_FOLDER}}),
        api_key="spec-feature-hub-shown")
    ids = [c["id"] for c in resp.json()["hub_cards"]]
    assert "spec" in ids
