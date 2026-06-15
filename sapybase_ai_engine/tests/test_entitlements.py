"""Server-side entitlement enforcement (main.has_entitlement / require_entitlement).

Locks the re-scoped pricing ladder so a future edit can't silently grant a paid
feature to the wrong tier:
  Starter (STARTER) — bot only, no conversion engine
  Growth  (PRO)     — lead_capture only (alerts, booking, Action Center, digest)
  Scale   (BUSINESS)— + analytics, webhook, white_label, human_handoff, custom_logo
"""
import pytest
from fastapi import HTTPException

from main import has_entitlement, require_entitlement


def _user(tier, role="USER", custom=None):
    return {"tier": tier, "role": role, "custom_plan_config": custom or {}}


class TestStarter:
    def test_no_paid_features(self):
        u = _user("STARTER")
        for flag in ("lead_capture", "analytics", "webhook", "white_label", "human_handoff", "custom_logo"):
            assert has_entitlement(u, flag) is False


class TestGrowth:
    def test_lead_capture_only(self):
        u = _user("PRO")
        assert has_entitlement(u, "lead_capture") is True
        # Deep BI + integrations are Scale-only — Growth must NOT have them.
        for flag in ("analytics", "webhook", "white_label", "human_handoff", "custom_logo"):
            assert has_entitlement(u, flag) is False


class TestScale:
    def test_everything(self):
        u = _user("BUSINESS")
        for flag in ("lead_capture", "analytics", "webhook", "white_label", "human_handoff", "custom_logo"):
            assert has_entitlement(u, flag) is True


class TestFreeAndOverrides:
    def test_free_denied(self):
        u = _user("FREE")
        assert has_entitlement(u, "lead_capture") is False
        assert has_entitlement(u, "analytics") is False

    def test_super_admin_always_allowed(self):
        u = _user("FREE", role="SUPER_ADMIN")
        assert has_entitlement(u, "analytics") is True

    def test_custom_plan_reads_config(self):
        u = _user("CUSTOM", custom={"analytics": True, "lead_capture": False})
        assert has_entitlement(u, "analytics") is True
        assert has_entitlement(u, "lead_capture") is False

    def test_unknown_tier_denied(self):
        assert has_entitlement(_user("MYSTERY"), "lead_capture") is False


class TestByoDatabaseEntitlement:
    """RFC docs/rfc-byod.md Phase 1.1 — byo_database resolves like any feature flag.

    BYOD clients are tier CUSTOM with a config seeded from the BYOD template (§3.1),
    so the authoritative path is custom_plan_config; the all-on BYOD template grants
    every flag including byo_database.
    """

    def test_byo_database_off_for_standard_tiers(self):
        for tier in ("FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"):
            assert has_entitlement(_user(tier), "byo_database") is False, tier

    def test_byo_database_via_custom_plan_config(self):
        u = _user("CUSTOM", custom={"byo_database": True})
        assert has_entitlement(u, "byo_database") is True
        # Absent/false in config → denied (trust the control-plane config, not a default).
        assert has_entitlement(_user("CUSTOM", custom={}), "byo_database") is False

    def test_super_admin_has_byo_database(self):
        assert has_entitlement(_user("FREE", role="SUPER_ADMIN"), "byo_database") is True

    def test_byod_template_grants_all_features_plus_byo_database(self):
        # The seed template is the "all features enabled + BYOD" config a client gets.
        from main import BYOD_PLAN_DEFAULTS
        u = _user("CUSTOM", custom=dict(BYOD_PLAN_DEFAULTS))
        for flag in ("lead_capture", "analytics", "webhook", "white_label",
                     "human_handoff", "custom_logo", "advanced_bot", "byo_database"):
            assert has_entitlement(u, flag) is True, flag


class TestRequireEntitlement:
    def test_raises_402_when_denied(self):
        with pytest.raises(HTTPException) as exc:
            require_entitlement(_user("PRO"), "analytics", "ROI dashboard")
        assert exc.value.status_code == 402
        assert exc.value.detail["code"] == "TIER_REQUIRED"

    def test_passes_when_allowed(self):
        # No exception = allowed.
        require_entitlement(_user("BUSINESS"), "analytics")
        require_entitlement(_user("PRO"), "lead_capture")
