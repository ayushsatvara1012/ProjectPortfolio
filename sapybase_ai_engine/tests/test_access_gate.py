"""Tests for the dashboard access-gate decision (Explore D3 + D5).

Pure logic — `is_dashboard_access_allowed(role, tier)`. The frontend mirror
(src/lib/auth/accessGate.ts) must encode the same rules.
"""
import pytest


def _import():
    from access_gate import is_dashboard_access_allowed, DASHBOARD_BLOCKED_TIERS
    return is_dashboard_access_allowed, DASHBOARD_BLOCKED_TIERS


class TestSuperAdminBypass:
    def test_super_admin_always_allowed_even_with_no_plan(self):
        allowed, _ = _import()
        assert allowed("SUPER_ADMIN", None) is True
        assert allowed("SUPER_ADMIN", "FREE") is True
        assert allowed("SUPER_ADMIN", "PENDING") is True


class TestBlockedStates:
    @pytest.mark.parametrize("tier", [None, "", "   ", "FREE", "PENDING", "free", "pending", " free "])
    def test_no_real_plan_is_blocked(self, tier):
        allowed, _ = _import()
        assert allowed("USER", tier) is False

    def test_blocked_set_is_exactly_free_and_pending(self):
        # Locks the contract the frontend mirror must match.
        _, blocked = _import()
        assert set(blocked) == {"FREE", "PENDING"}


class TestAllowedPlans:
    @pytest.mark.parametrize(
        "tier",
        ["EXPLORE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE", "CUSTOM"],
    )
    def test_real_plans_allowed(self, tier):
        allowed, _ = _import()
        assert allowed("USER", tier) is True

    def test_explore_is_allowed_lowercase_and_padded(self):
        allowed, _ = _import()
        assert allowed("USER", "explore") is True
        assert allowed("USER", "  Explore  ") is True

    def test_unknown_future_tier_is_allowed_denylist_semantics(self):
        # Denylist: only FREE/PENDING/empty are blocked; a tier added later
        # must not be accidentally locked out.
        allowed, _ = _import()
        assert allowed("USER", "SCALE_PLUS") is True


class TestBehaviourPreservation:
    """The refactor of require_premium_tier must not change outcomes for
    tiers that exist in production today."""

    def test_free_and_none_still_blocked_like_before(self):
        allowed, _ = _import()
        assert allowed("USER", "FREE") is False
        assert allowed("USER", None) is False

    def test_existing_paid_and_custom_still_allowed(self):
        allowed, _ = _import()
        for tier in ("STARTER", "PRO", "BUSINESS", "ENTERPRISE", "CUSTOM"):
            assert allowed("USER", tier) is True
