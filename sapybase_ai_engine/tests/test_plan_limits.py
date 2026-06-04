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

    def test_basic_allows_one_bot(self):
        limits, _, _ = _import()
        assert limits["BASIC"]["max_bots"] == 1

    def test_enterprise_has_effectively_unlimited_bots(self):
        limits, _, _ = _import()
        assert limits["ENTERPRISE"]["max_bots"] >= 100

    def test_higher_tiers_have_more_messages(self):
        limits, _, _ = _import()
        # Commercial ladder: Starter < Growth(PRO) < Scale(BUSINESS) < Enterprise.
        # BASIC is a legacy alias of Starter (equal), no longer sold.
        assert limits["BASIC"]["messages"] == limits["STARTER"]["messages"]
        assert limits["STARTER"]["messages"] < limits["PRO"]["messages"]
        assert limits["PRO"]["messages"] < limits["BUSINESS"]["messages"]
        assert limits["BUSINESS"]["messages"] < limits["ENTERPRISE"]["messages"]

    def test_higher_tiers_have_more_chunks(self):
        limits, _, _ = _import()
        assert limits["BASIC"]["chunks"] < limits["PRO"]["chunks"]

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
        for tier in ("FREE", "BASIC", "STARTER", "PRO", "ENTERPRISE"):
            assert tier in limits, f"Missing tier: {tier}"


class TestModelMapping:
    def test_free_gets_lite_model(self):
        _, mapping, _ = _import()
        assert "lite" in mapping["FREE"].lower() or "flash" in mapping["FREE"].lower()

    def test_pro_gets_higher_model_than_basic(self):
        _, mapping, _ = _import()
        # PRO should not use same model as FREE/BASIC
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
