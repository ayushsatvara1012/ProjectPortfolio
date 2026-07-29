"""COA finder — the folder ID must NEVER reach the widget (plan §11, §12 Security).

A link-shared Drive folder is protected by exactly one thing: nobody knowing its
folder ID. `/api/config` is public to any origin holding the bot's api key, so a
folder ID appearing anywhere in that payload would hand the entire certificate
archive to the internet.

`/api/config` builds a whitelisted `safe_company` dict, so this is a regression
test on that whitelist: it fails the moment someone widens it to pass
`pack_overrides` through wholesale.
"""
import json

from fastapi.testclient import TestClient
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

import main as m

FastAPICache.init(InMemoryBackend(), prefix="test-cache-coa")

FOLDER_ID = "1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U"


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
        "pack_overrides": {"coa": {"folder_id": FOLDER_ID}},
        "teaser_config": None,
    }
    base.update(over)
    return base


def _get_config(monkeypatch, *, company=None, api_key="coa-leak-key"):
    company = _company() if company is None else company
    monkeypatch.setattr(m, "get_db_connection", lambda: _FakeConn())
    monkeypatch.setattr(m, "release_db_connection", lambda c: None)
    m.app.dependency_overrides[m.verify_api_key_and_origin] = lambda: company
    try:
        return TestClient(m.app).get("/api/config", headers={"x-api-key": api_key})
    finally:
        m.app.dependency_overrides.clear()


def test_folder_id_absent_from_config_payload(monkeypatch):
    resp = _get_config(monkeypatch, api_key="coa-leak-key-1")
    assert resp.status_code == 200
    # Serialized check: catches the ID at ANY depth, including a nested
    # pack_overrides echo that a key-by-key assertion would miss.
    assert FOLDER_ID not in json.dumps(resp.json())


def test_no_coa_or_pack_overrides_key_in_config_payload(monkeypatch):
    resp = _get_config(monkeypatch, api_key="coa-leak-key-2")
    body = resp.json()
    assert "coa" not in body
    assert "pack_overrides" not in body


def test_configured_bot_still_serves_config_normally(monkeypatch):
    # The guard must not be "we 500 whenever a COA folder is set".
    resp = _get_config(monkeypatch, api_key="coa-leak-key-3")
    assert resp.status_code == 200
    assert resp.json()["company_name"] == "Acme"
