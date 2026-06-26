"""Phase 5 (customise) — per-company pack overrides merge (pure).

These guard the single source of truth that the widget config, the sample-request
submit endpoint, and the dashboard editor all read through. The dangerous bugs are
all "a bad override leaks or breaks the live form", so we hammer the degradation
paths: garbage stored values must collapse to the pack default, never raise.
"""
import json

import pytest

from packs import (
    coerce_overrides,
    sanitize_overrides,
    effective_sample_form,
    effective_required_fields,
    effective_sample_sink,
    load_pack,
)
from packs.overrides import (
    sanitize_form_fields,
    sanitize_sample_sink,
    ALLOWED_FIELD_TYPES,
    MAX_FIELDS,
)

CHEM = load_pack("chemical")


# ── coerce_overrides ───────────────────────────────────────────────────────────
class TestCoerceOverrides:
    def test_dict_passes_through(self):
        assert coerce_overrides({"a": 1}) == {"a": 1}

    def test_json_string_parsed(self):
        assert coerce_overrides('{"a": 1}') == {"a": 1}

    def test_none_and_garbage_collapse_to_empty(self):
        assert coerce_overrides(None) == {}
        assert coerce_overrides("not json") == {}
        assert coerce_overrides("[1,2,3]") == {}   # JSON but not an object
        assert coerce_overrides(12345) == {}


# ── sanitize_form_fields ─────────────────────────────────────────────────────────
class TestSanitizeFormFields:
    def test_valid_fields_kept(self):
        out = sanitize_form_fields([
            {"name": "contact_email", "label": "Email", "type": "email", "required": True},
            {"name": "qty", "label": "Quantity", "type": "number"},
        ])
        assert [f["name"] for f in out] == ["contact_email", "qty"]
        assert out[0]["required"] is True
        assert out[1]["required"] is False

    def test_unknown_type_coerced_to_text(self):
        out = sanitize_form_fields([{"name": "x", "label": "X", "type": "wizardry"}])
        assert out[0]["type"] == "text"
        assert all(t in ALLOWED_FIELD_TYPES for t in (f["type"] for f in out))

    def test_name_slugified_and_label_defaulted(self):
        out = sanitize_form_fields([{"label": "Delivery Site!"}])
        assert out[0]["name"] == "delivery_site"
        assert out[0]["label"] == "Delivery Site!"

    def test_field_with_no_usable_name_dropped(self):
        out = sanitize_form_fields([{"name": "***", "type": "text"}, {"label": "  "}])
        assert out == []

    def test_duplicate_names_deduped_first_wins(self):
        out = sanitize_form_fields([
            {"name": "email", "label": "First"},
            {"name": "email", "label": "Second"},
        ])
        assert len(out) == 1
        assert out[0]["label"] == "First"

    def test_count_capped(self):
        out = sanitize_form_fields([{"name": f"f{i}"} for i in range(MAX_FIELDS + 10)])
        assert len(out) == MAX_FIELDS

    def test_non_list_returns_empty(self):
        assert sanitize_form_fields(None) == []
        assert sanitize_form_fields("nope") == []
        assert sanitize_form_fields({"name": "x"}) == []


# ── sanitize_sample_sink ─────────────────────────────────────────────────────────
class TestSanitizeSampleSink:
    def test_https_url_kept_with_secret(self):
        s = sanitize_sample_sink({"url": "https://script.google.com/x", "secret": "abc"})
        assert s == {"url": "https://script.google.com/x", "secret": "abc"}

    def test_non_https_url_rejected(self):
        assert sanitize_sample_sink({"url": "http://insecure.example/x"}) == {}
        assert sanitize_sample_sink({"url": "   "}) == {}
        assert sanitize_sample_sink({"url": "ftp://x"}) == {}

    def test_secret_optional(self):
        s = sanitize_sample_sink({"url": "https://x.example/y"})
        assert s == {"url": "https://x.example/y", "secret": ""}

    def test_non_dict_returns_empty(self):
        assert sanitize_sample_sink(None) == {}
        assert sanitize_sample_sink("https://x") == {}


# ── sanitize_overrides (storage shape) ───────────────────────────────────────────
class TestSanitizeOverrides:
    def test_drops_empty_sections(self):
        assert sanitize_overrides({}) == {}
        assert sanitize_overrides({"sample_form": [], "sample_sink": {}}) == {}

    def test_keeps_only_populated(self):
        out = sanitize_overrides({
            "sample_form": [{"name": "email", "type": "email"}],
            "sample_sink": {"url": "https://x.example/y", "secret": "s"},
        })
        assert set(out.keys()) == {"sample_form", "sample_sink"}
        assert out["sample_form"][0]["name"] == "email"

    def test_roundtrips_through_json(self):
        out = sanitize_overrides({"sample_form": [{"name": "qty", "type": "number"}]})
        assert json.loads(json.dumps(out)) == out


# ── effective_* (the runtime read paths) ─────────────────────────────────────────
class TestEffectiveSampleForm:
    def test_override_wins_over_pack_default(self):
        ov = {"sample_form": [{"name": "only_field", "label": "Only", "required": True}]}
        eff = effective_sample_form(CHEM, ov)
        assert [f["name"] for f in eff] == ["only_field"]

    def test_falls_back_to_pack_default_when_no_override(self):
        eff = effective_sample_form(CHEM, None)
        assert eff == CHEM.sample_form_payload()
        assert len(eff) > 0

    def test_empty_override_falls_back_to_default(self):
        eff = effective_sample_form(CHEM, {"sample_form": []})
        assert eff == CHEM.sample_form_payload()

    def test_garbage_override_falls_back_not_raises(self):
        eff = effective_sample_form(CHEM, "totally not json")
        assert eff == CHEM.sample_form_payload()

    def test_no_pack_means_no_form(self):
        assert effective_sample_form(None, None) == []


class TestEffectiveRequiredFields:
    def test_required_from_override(self):
        ov = {"sample_form": [
            {"name": "a", "required": True},
            {"name": "b", "required": False},
        ]}
        assert effective_required_fields(CHEM, ov) == ("a",)

    def test_required_from_pack_default(self):
        req = effective_required_fields(CHEM, None)
        # The chemical pack marks several fields required (product/grade/quantity/...).
        assert "product" in req and "contact_email" in req


class TestEffectiveSampleSink:
    def test_per_bot_override_wins(self):
        ov = {"sample_sink": {"url": "https://owner.example/hook", "secret": "k"}}
        assert effective_sample_sink(ov, "https://env.example/hook", "envsecret") == (
            "https://owner.example/hook", "k")

    def test_falls_back_to_env_when_no_override(self):
        assert effective_sample_sink(None, "https://env.example/hook", "envsecret") == (
            "https://env.example/hook", "envsecret")

    def test_invalid_override_falls_back_to_env(self):
        ov = {"sample_sink": {"url": "http://insecure"}}
        assert effective_sample_sink(ov, "https://env.example/hook", "envsecret") == (
            "https://env.example/hook", "envsecret")

    def test_nothing_configured_returns_empty(self):
        assert effective_sample_sink(None, "", "") == ("", "")
