"""Spec finder - the folder ID must NEVER reach the widget (plan §12 H11).

A deliberate duplicate of `test_config_coa_folder_leak.py` rather than a
parameterization of it: §9.2 forbids touching any `test_coa_*.py` file, and that
suite is the tripwire proving this work left the confidential library alone.

The specification folder is public by decision (D1, §3.1), so what leaks here is not
a confidentiality breach the way a certificate archive would be - it is the folder ID
of a link-shared folder, which is a Drive-wide handle to every file in it, past the
widget's rate limits and past whatever the panel would have shown. H11 is a connector
property, not a confidentiality policy, which is exactly why it carries over (§12).

`/api/config` builds a whitelisted `safe_company` dict, so this is a regression test
on that whitelist: it fails the moment someone widens it to pass `pack_overrides`
through wholesale, and it must fail for BOTH folders.
"""
import json

from fastapi.testclient import TestClient
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

import main as m

FastAPICache.init(InMemoryBackend(), prefix="test-cache-spec-leak")

SPEC_FOLDER_ID = "1KCRfrRQ7xKq2NpR4vTzB9cYdLmH0aQfJ"
COA_FOLDER_ID = "1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U"


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
        "hide_branding": False, "vertical": "chemical",
        "pack_overrides": {"spec": {"folder_id": SPEC_FOLDER_ID},
                           "coa": {"folder_id": COA_FOLDER_ID}},
        "teaser_config": None,
    }
    base.update(over)
    return base


def _get_config(monkeypatch, *, company=None, api_key="spec-leak-key"):
    company = _company() if company is None else company
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConn())
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.verify_api_key_and_origin] = lambda: company
    try:
        return TestClient(m.app).get("/api/config", headers={"x-api-key": api_key})
    finally:
        m.app.dependency_overrides.clear()


def test_neither_folder_id_appears_in_the_config_payload(monkeypatch):
    resp = _get_config(monkeypatch, api_key="spec-leak-key-1")
    assert resp.status_code == 200
    # Serialized: catches the ID at ANY depth, including a nested pack_overrides
    # echo that a key-by-key assertion would miss.
    body = json.dumps(resp.json())
    assert SPEC_FOLDER_ID not in body
    assert COA_FOLDER_ID not in body


def test_no_spec_or_pack_overrides_key_in_the_config_payload(monkeypatch):
    body = _get_config(monkeypatch, api_key="spec-leak-key-2").json()
    assert "spec" not in body
    assert "pack_overrides" not in body


def test_the_flag_travels_and_the_identifier_does_not(monkeypatch):
    # The distinction the panel needs: the widget must learn that a library exists,
    # and must not learn where it is.
    body = _get_config(monkeypatch, api_key="spec-leak-key-3").json()
    assert body["features"]["spec_picker"] is True
    assert SPEC_FOLDER_ID not in json.dumps(body)


def test_a_configured_bot_still_serves_config_normally(monkeypatch):
    # The guard must not be "we 500 whenever a spec folder is set".
    resp = _get_config(monkeypatch, api_key="spec-leak-key-4")
    assert resp.status_code == 200
    assert resp.json()["company_name"] == "Acme"
