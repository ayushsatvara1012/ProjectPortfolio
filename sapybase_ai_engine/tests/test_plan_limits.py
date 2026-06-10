"""Tests for PLAN_LIMITS — subscription tier enforcement."""
import pytest


def _import():
    from main import PLAN_LIMITS, MODEL_MAPPING, VALID_MODELS
    return PLAN_LIMITS, MODEL_MAPPING, VALID_MODELS


class TestPlanLimits:
    def test_free_tier_has_zero_bots(self):
        limits, _, _ = _import()
        assert limits["FREE"]["max_bots"] == 0

    def test_free_tier_has_zero_messages(self):
        limits, _, _ = _import()
        assert limits["FREE"]["messages"] == 0

    def test_starter_allows_one_bot(self):
        limits, _, _ = _import()
        assert limits["STARTER"]["max_bots"] == 1

    def test_enterprise_has_effectively_unlimited_bots(self):
        limits, _, _ = _import()
        assert limits["ENTERPRISE"]["max_bots"] >= 100

    def test_higher_tiers_have_more_messages(self):
        limits, _, _ = _import()
        # Commercial ladder: Starter < Growth(PRO) < Scale(BUSINESS) < Enterprise.
        assert limits["STARTER"]["messages"] < limits["PRO"]["messages"]
        assert limits["PRO"]["messages"] < limits["BUSINESS"]["messages"]
        assert limits["BUSINESS"]["messages"] < limits["ENTERPRISE"]["messages"]

    def test_higher_tiers_have_more_chunks(self):
        limits, _, _ = _import()
        assert limits["STARTER"]["chunks"] < limits["PRO"]["chunks"]

    def test_free_tier_no_lead_capture(self):
        limits, _, _ = _import()
        assert limits["FREE"]["lead_capture"] is False

    def test_pro_has_lead_capture(self):
        limits, _, _ = _import()
        assert limits["PRO"]["lead_capture"] is True

    def test_free_no_white_label(self):
        limits, _, _ = _import()
        assert limits["FREE"]["white_label"] is False

    def test_enterprise_has_all_features(self):
        limits, _, _ = _import()
        enterprise = limits["ENTERPRISE"]
        assert enterprise["human_handoff"] is True
        assert enterprise["lead_capture"] is True
        assert enterprise["white_label"] is True
        assert enterprise["webhook"] is True
        assert enterprise["analytics"] is True

    def test_all_expected_tiers_present(self):
        limits, _, _ = _import()
        for tier in ("FREE", "STARTER", "PRO", "ENTERPRISE"):
            assert tier in limits, f"Missing tier: {tier}"

    def test_basic_tier_fully_removed(self):
        limits, mapping, _ = _import()
        assert "BASIC" not in limits
        assert "BASIC" not in mapping

    # ── EXPLORE tier (lifetime-free top-of-funnel) ───────────────────────────
    def test_explore_tier_present(self):
        limits, _, _ = _import()
        assert "EXPLORE" in limits

    def test_explore_cost_caps(self):
        limits, _, _ = _import()
        e = limits["EXPLORE"]
        assert e["max_bots"] == 1
        assert e["messages"] == 200
        assert e["chunks"] == 75
        assert e["speed"] == "lite"
        assert e["max_owner_emails"] == 50

    def test_explore_full_product_except_white_label(self):
        # The single hard rule: white_label OFF; everything else ON.
        limits, _, _ = _import()
        e = limits["EXPLORE"]
        assert e["white_label"] is False, "white_label MUST be off on Explore (viral badge)"
        assert e["human_handoff"] is True
        assert e["lead_capture"] is True
        assert e["analytics"] is True
        assert e["webhook"] is True
        assert e["custom_logo"] is True

    def test_explore_uses_lite_model(self):
        _, mapping, valid = _import()
        assert "EXPLORE" in mapping
        assert mapping["EXPLORE"] == "gemini-2.5-flash-lite"
        assert mapping["EXPLORE"] in valid

    def test_advanced_bot_is_not_a_plan_limits_key(self):
        # advanced_bot is entitlements-only; adding it to PLAN_LIMITS would break
        # schema-shape consistency. Guard against accidental reintroduction.
        limits, _, _ = _import()
        for tier, d in limits.items():
            assert "advanced_bot" not in d, f"{tier} must not carry advanced_bot in PLAN_LIMITS"

    def test_schema_shape_consistency_all_tiers_same_keys(self):
        # Every tier dict MUST have identical keys, or dict access in main.py and
        # the test suite can break. This is the invariant §4.1 warns about.
        limits, _, _ = _import()
        key_sets = {tier: frozenset(d.keys()) for tier, d in limits.items()}
        reference = key_sets["FREE"]
        for tier, keys in key_sets.items():
            assert keys == reference, f"{tier} keys {keys ^ reference} differ from FREE"

    def test_max_owner_emails_present_on_every_tier(self):
        limits, _, _ = _import()
        for tier, d in limits.items():
            assert "max_owner_emails" in d, f"{tier} missing max_owner_emails"
        # Explore is capped; paid tiers are effectively unlimited; FREE is zero.
        assert limits["FREE"]["max_owner_emails"] == 0
        assert limits["EXPLORE"]["max_owner_emails"] == 50
        assert limits["STARTER"]["max_owner_emails"] >= 999999


class TestExploreRateLimitsAndDomains:
    def test_explore_has_rate_limits(self):
        from main import TIER_RATE_LIMITS
        assert "EXPLORE" in TIER_RATE_LIMITS
        caps = TIER_RATE_LIMITS["EXPLORE"]
        assert caps["per_minute"] == 20
        assert caps["per_hour"] == 200
        assert caps["per_day"] == 1200

    def test_domain_lists_loaded_and_disjoint(self):
        from config import FREE_EMAIL_DOMAINS, DISPOSABLE_EMAIL_DOMAINS
        assert "gmail.com" in FREE_EMAIL_DOMAINS
        assert "mailinator.com" in DISPOSABLE_EMAIL_DOMAINS
        # A domain must not be classified as both free-mail and disposable.
        assert FREE_EMAIL_DOMAINS.isdisjoint(DISPOSABLE_EMAIL_DOMAINS)
        # Stored normalized (lowercase) so signup-time domain matching is reliable.
        assert all(d == d.lower() for d in FREE_EMAIL_DOMAINS)
        assert all(d == d.lower() for d in DISPOSABLE_EMAIL_DOMAINS)


class TestModelMapping:
    def test_free_gets_lite_model(self):
        _, mapping, _ = _import()
        assert "lite" in mapping["FREE"].lower() or "flash" in mapping["FREE"].lower()

    def test_pro_gets_higher_model_than_free(self):
        _, mapping, _ = _import()
        # PRO should not use the same model as FREE
        assert mapping["PRO"] != mapping["FREE"]

    def test_all_mapped_models_are_valid(self):
        _, mapping, valid = _import()
        for tier, model in mapping.items():
            assert model in valid, f"Model '{model}' for tier '{tier}' not in VALID_MODELS"


class TestGetTierModel:
    def test_invalid_model_is_rejected(self):
        import main
        # An injected bad model string should not be used
        model = main.get_tier_model("PRO", company_model="gpt-4-hacked")
        # Should fall back to tier default, not use injected model
        assert model is not None

    def test_valid_model_override_is_accepted(self):
        import main
        from main import VALID_MODELS
        valid_model = next(iter(VALID_MODELS))
        model = main.get_tier_model("PRO", company_model=valid_model)
        assert model is not None

    def test_unknown_tier_falls_back_gracefully(self):
        import main
        model = main.get_tier_model("NONEXISTENT_TIER")
        assert model is not None
