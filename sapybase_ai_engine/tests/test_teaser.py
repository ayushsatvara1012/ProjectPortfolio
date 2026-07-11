"""Contextual teaser (Phase 1) — config sanitization, payload, event validation."""
import pytest

from services import teaser


# ── coerce_teaser_config ──────────────────────────────────────────────────────

def test_coerce_none_and_junk_return_empty():
    assert teaser.coerce_teaser_config(None) == {}
    assert teaser.coerce_teaser_config("not json {") == {}
    assert teaser.coerce_teaser_config(42) == {}
    assert teaser.coerce_teaser_config(["a"]) == {}


def test_coerce_json_string_is_parsed():
    cfg = teaser.coerce_teaser_config('{"enabled": false, "title": "Hey"}')
    assert cfg == {"enabled": False, "title": "Hey"}


def test_coerce_drops_unknown_keys_and_bad_types():
    cfg = teaser.coerce_teaser_config(
        {"enabled": "yes", "title": 7, "subtext": None, "delay_ms": "soon", "evil": "x"}
    )
    assert cfg == {}


def test_coerce_strips_control_chars_and_collapses_whitespace():
    cfg = teaser.coerce_teaser_config({"title": "  Hi\x00there \n  friend\x7f "})
    assert cfg["title"] == "Hi there friend"


def test_coerce_caps_lengths():
    cfg = teaser.coerce_teaser_config({"title": "x" * 500, "subtext": "y" * 500})
    assert len(cfg["title"]) == teaser.TITLE_MAX
    assert len(cfg["subtext"]) == teaser.SUBTEXT_MAX


def test_coerce_clamps_delay():
    assert teaser.coerce_teaser_config({"delay_ms": 10})["delay_ms"] == teaser.DELAY_MIN_MS
    assert teaser.coerce_teaser_config({"delay_ms": 10 ** 9})["delay_ms"] == teaser.DELAY_MAX_MS
    assert teaser.coerce_teaser_config({"delay_ms": 8000})["delay_ms"] == 8000
    # bool is an int subclass — must not sneak through as a delay
    assert "delay_ms" not in teaser.coerce_teaser_config({"delay_ms": True})


# ── merge_teaser_update ───────────────────────────────────────────────────────

def test_merge_sets_and_clears_overrides():
    merged = teaser.merge_teaser_update(None, {"enabled": False, "title": "Yo"})
    assert merged == {"enabled": False, "title": "Yo"}
    # blank title clears the override; untouched keys survive
    merged2 = teaser.merge_teaser_update(merged, {"title": "   "})
    assert merged2 == {"enabled": False}


def test_merge_ignores_unsent_keys():
    existing = {"enabled": False, "title": "Keep", "subtext": "Also keep"}
    merged = teaser.merge_teaser_update(existing, {"subtext": "New"})
    assert merged == {"enabled": False, "title": "Keep", "subtext": "New"}


def test_merge_sanitizes_incoming_text():
    merged = teaser.merge_teaser_update(None, {"title": "<b>Hi</b>\x00 " + "z" * 200})
    assert "\x00" not in merged["title"]
    assert len(merged["title"]) == teaser.TITLE_MAX
    # HTML is NOT stripped here — the loader renders via textContent, so tags
    # are inert; we only guarantee plain-text hygiene (no control chars).
    assert merged["title"].startswith("<b>Hi</b>")


# ── build_teaser_payload ──────────────────────────────────────────────────────

def test_payload_defaults_with_bot_name_substitution():
    p = teaser.build_teaser_payload(None, "ChemBot")
    assert p == {
        "enabled": True,
        "title": "Hi, I'm ChemBot",
        "subtext": "Need help getting started?",
        "delay_ms": teaser.DEFAULT_DELAY_MS,
    }


def test_payload_empty_bot_name_falls_back():
    assert teaser.build_teaser_payload(None, "  ")["title"] == "Hi, I'm Sapy AI"
    assert teaser.build_teaser_payload(None, None)["title"] == "Hi, I'm Sapy AI"


def test_payload_owner_overrides_win():
    raw = {"enabled": False, "title": "Ask {botName} anything", "delay_ms": 3000}
    p = teaser.build_teaser_payload(raw, "Vaayu")
    assert p["enabled"] is False
    assert p["title"] == "Ask Vaayu anything"
    assert p["subtext"] == teaser.DEFAULT_SUBTEXT
    assert p["delay_ms"] == 3000


def test_payload_substitution_cannot_exceed_cap():
    raw = {"title": "{botName}" + "x" * (teaser.TITLE_MAX - 9)}
    p = teaser.build_teaser_payload(raw, "B" * 200)
    assert len(p["title"]) <= teaser.TITLE_MAX


# ── owner_teaser_view ─────────────────────────────────────────────────────────

def test_owner_view_keeps_placeholder_and_empty_means_default():
    v = teaser.owner_teaser_view({"title": "Hi, I'm {botName}", "enabled": True})
    assert v == {"enabled": True, "title": "Hi, I'm {botName}", "subtext": ""}
    assert teaser.owner_teaser_view(None) == {"enabled": True, "title": "", "subtext": ""}


# ── normalize_event ───────────────────────────────────────────────────────────

def test_normalize_event_accepts_valid():
    assert teaser.normalize_event("impression", None) == ("impression", None)
    assert teaser.normalize_event("click", "default") == ("click", "default")


@pytest.mark.parametrize("event", ["", "open", "IMPRESSION", None, 5])
def test_normalize_event_rejects_bad_event(event):
    with pytest.raises(ValueError):
        teaser.normalize_event(event, None)


@pytest.mark.parametrize("rule", ["", "a b", "x" * 65, "<script>", 5])
def test_normalize_event_rejects_bad_rule_id(rule):
    with pytest.raises(ValueError):
        teaser.normalize_event("dismiss", rule)


# ── coerce_rules / rules in config (Phase 2) ──────────────────────────────────

def test_coerce_rules_ignores_non_list_and_junk_items():
    assert teaser.coerce_rules(None) == []
    assert teaser.coerce_rules("x") == []
    assert teaser.coerce_rules([1, "a", {}, {"match": "/p"}]) == []  # no titles


def test_coerce_rule_normalizes_match_and_derives_id():
    rules = teaser.coerce_rules([{"match": "  /Products/ ?x=1#h ", "title": "Hi"}])
    assert rules == [{"id": "products", "title": "Hi", "match": "/products"}]


def test_coerce_rule_keeps_valid_id_and_page_only_rule():
    rules = teaser.coerce_rules(
        [{"id": "pr_1", "page": "Pricing", "title": "Price?", "subtext": "Ask"}]
    )
    assert rules == [{"id": "pr_1", "title": "Price?", "subtext": "Ask", "page": "pricing"}]


def test_coerce_rule_drops_rule_without_target():
    assert teaser.coerce_rules([{"title": "orphan"}]) == []


def test_coerce_rules_dedupes_ids():
    # A duplicate id is replaced by one derived from the rule's own match token.
    rules = teaser.coerce_rules(
        [{"id": "x", "match": "/a", "title": "A"}, {"id": "x", "match": "/b", "title": "B"}]
    )
    assert [r["id"] for r in rules] == ["x", "b"]


def test_coerce_rules_caps_count():
    many = [{"match": f"/p{i}", "title": "t"} for i in range(teaser.RULES_MAX + 10)]
    assert len(teaser.coerce_rules(many)) == teaser.RULES_MAX


def test_config_round_trips_rules():
    cfg = teaser.coerce_teaser_config({"rules": [{"match": "/p", "title": "Hi"}]})
    assert cfg["rules"] == [{"id": "p", "title": "Hi", "match": "/p"}]


# ── build_teaser_rules (Phase 2) ──────────────────────────────────────────────

def test_build_rules_falls_back_to_pack_seeds_and_substitutes_name():
    pack_rules = [{"id": "hi", "match": "/p", "title": "Ask {botName}", "subtext": "x"}]
    out = teaser.build_teaser_rules(None, pack_rules, "Acme Bot")
    assert out == [{"id": "hi", "title": "Ask Acme Bot", "subtext": "x", "match": "/p"}]


def test_build_rules_owner_rules_win_over_pack_seeds():
    owner = {"rules": [{"id": "own", "match": "/o", "title": "Mine"}]}
    pack_rules = [{"id": "seed", "match": "/p", "title": "Seed"}]
    out = teaser.build_teaser_rules(owner, pack_rules, "Bot")
    assert [r["id"] for r in out] == ["own"]


def test_build_rules_empty_when_no_owner_and_no_pack():
    assert teaser.build_teaser_rules(None, None, "Bot") == []
    assert teaser.build_teaser_rules({"enabled": True}, [], "Bot") == []
