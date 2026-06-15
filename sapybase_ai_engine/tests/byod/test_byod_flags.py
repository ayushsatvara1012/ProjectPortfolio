"""Phase 0.2 gate: byo_database is dark by default; canary wiring resolves.

These tests need no database and run everywhere. The broader Phase 0.2 exit
criterion — "Flag OFF → full existing regression suite green (zero behavior
change)" — is satisfied by the rest of the suite passing unchanged, since
nothing in the engine consumes this module yet.
"""
from __future__ import annotations

import byod_flags
from byod_flags import (
    BYO_DATABASE_FEATURE_KEY,
    byo_database_active,
    byo_database_globally_enabled,
    canary_company_ids,
    is_canary_tenant,
)

CANARY = "00000000-0000-4000-8000-000000000001"
OTHER = "11111111-1111-4111-8111-111111111111"


def _clear(monkeypatch):
    monkeypatch.delenv("BYOD_ENABLED", raising=False)
    monkeypatch.delenv("BYOD_CANARY_COMPANY_IDS", raising=False)


def test_feature_key_constant():
    assert BYO_DATABASE_FEATURE_KEY == "byo_database"


def test_dark_by_default(monkeypatch):
    """No env set → off for everyone (the core dark-by-default guarantee)."""
    _clear(monkeypatch)
    assert byo_database_globally_enabled() is False
    assert canary_company_ids() == frozenset()
    assert byo_database_active(CANARY) is False
    assert byo_database_active(OTHER) is False


def test_global_on_but_no_canary_is_off(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("BYOD_ENABLED", "true")
    assert byo_database_globally_enabled() is True
    assert byo_database_active(CANARY) is False  # not in allowlist


def test_canary_listed_but_global_off_is_off(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("BYOD_CANARY_COMPANY_IDS", CANARY)
    assert is_canary_tenant(CANARY) is True
    assert byo_database_active(CANARY) is False  # kill switch still off


def test_active_requires_both_gates(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("BYOD_ENABLED", "1")
    monkeypatch.setenv("BYOD_CANARY_COMPANY_IDS", CANARY)
    assert byo_database_active(CANARY) is True
    assert byo_database_active(OTHER) is False


def test_canary_list_parsing(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("BYOD_CANARY_COMPANY_IDS", f" {CANARY} , ,{OTHER},")
    assert canary_company_ids() == frozenset({CANARY, OTHER})


def test_none_and_empty_company_id_are_off(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("BYOD_ENABLED", "true")
    monkeypatch.setenv("BYOD_CANARY_COMPANY_IDS", CANARY)
    assert byo_database_active(None) is False
    assert byo_database_active("") is False
    assert is_canary_tenant(None) is False


def test_env_bool_truthy_variants(monkeypatch):
    _clear(monkeypatch)
    for val in ("1", "true", "TRUE", "Yes", "on", " on "):
        monkeypatch.setenv("BYOD_ENABLED", val)
        assert byod_flags.byo_database_globally_enabled() is True, val
    for val in ("0", "false", "no", "off", "", "maybe"):
        monkeypatch.setenv("BYOD_ENABLED", val)
        assert byod_flags.byo_database_globally_enabled() is False, val
