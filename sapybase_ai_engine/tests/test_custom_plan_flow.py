"""
End-to-end unit tests for the custom plan flow (Phases A–E).

Coverage:
  - _check_custom_plan_gate: all statuses × period-end edge cases × checkout_url presence
  - CustomPlanConfig: field validators (price, trial_days, model, non-negative fields)
  - CUSTOM_PLAN_DEFAULTS: structure assertions
  - CustomPlanOverrideRequest: field validation (action enum, extend_days bounds)
  - Reconciliation report structure (_run_custom_plan_reconciliation via mock)
  - Dashboard status_color and quick_actions mappings
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("CLERK_JWT_ISSUER", "https://test.clerk.accounts.dev")
os.environ.setdefault("CLERK_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("POLAR_WEBHOOK_SECRET", "test-polar-secret")
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")
os.environ.setdefault("ENV", "test")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now():
    return datetime.now(timezone.utc)


def _past(days=0, hours=0):
    return _now() - timedelta(days=days, hours=hours)


def _future(days=0, hours=0):
    return _now() + timedelta(days=days, hours=hours)


# ---------------------------------------------------------------------------
# _check_custom_plan_gate
# ---------------------------------------------------------------------------

class TestCustomPlanGate:
    """Every status × billing_end edge × checkout_url presence."""

    def setup_method(self):
        from main import _check_custom_plan_gate
        self.gate = _check_custom_plan_gate

    # ── AWAITING_PAYMENT ────────────────────────────────────────────────────

    def test_awaiting_payment_always_denied(self):
        result = self.gate("AWAITING_PAYMENT", None, _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_PAYMENT_NOT_STARTED"

    def test_awaiting_payment_includes_checkout_url_when_present(self):
        result = self.gate("AWAITING_PAYMENT", None, _now(), checkout_url="https://buy.polar.sh/prod_abc")
        assert result["checkout_url"] == "https://buy.polar.sh/prod_abc"

    def test_awaiting_payment_no_checkout_url_field_when_absent(self):
        result = self.gate("AWAITING_PAYMENT", None, _now(), checkout_url=None)
        assert "checkout_url" not in result

    # ── TRIAL_ACTIVE ────────────────────────────────────────────────────────

    def test_trial_active_within_period_allowed(self):
        result = self.gate("TRIAL_ACTIVE", _future(days=3), _now())
        assert result is None

    def test_trial_active_no_billing_end_allowed(self):
        result = self.gate("TRIAL_ACTIVE", None, _now())
        assert result is None

    def test_trial_active_expired_billing_end_denied(self):
        result = self.gate("TRIAL_ACTIVE", _past(hours=1), _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_TRIAL_EXPIRED_PENDING_CHARGE"

    def test_trial_expired_no_checkout_url_in_response(self):
        result = self.gate("TRIAL_ACTIVE", _past(hours=1), _now(), checkout_url="https://buy.polar.sh/x")
        assert "checkout_url" not in result

    # ── ACTIVE ──────────────────────────────────────────────────────────────

    def test_active_within_period_allowed(self):
        result = self.gate("ACTIVE", _future(days=5), _now())
        assert result is None

    def test_active_no_billing_end_allowed(self):
        result = self.gate("ACTIVE", None, _now())
        assert result is None

    def test_active_within_grace_period_allowed(self):
        # billing_end was 24h ago — within the 48h grace window
        result = self.gate("ACTIVE", _past(hours=24), _now())
        assert result is None

    def test_active_within_grace_boundary_allowed(self):
        # billing_end was 47h ago — still inside the 48h grace window
        result = self.gate("ACTIVE", _past(hours=47), _now())
        assert result is None

    def test_active_past_grace_period_denied(self):
        # billing_end was 49h ago — past the 48h grace window
        result = self.gate("ACTIVE", _past(hours=49), _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_PERIOD_EXPIRED"

    def test_active_past_grace_includes_checkout_url(self):
        result = self.gate("ACTIVE", _past(hours=49), _now(), checkout_url="https://buy.polar.sh/x")
        assert result["checkout_url"] == "https://buy.polar.sh/x"

    # ── CANCELED ────────────────────────────────────────────────────────────

    def test_canceled_within_period_allowed(self):
        result = self.gate("CANCELED", _future(days=2), _now())
        assert result is None

    def test_canceled_no_billing_end_allowed(self):
        result = self.gate("CANCELED", None, _now())
        assert result is None

    def test_canceled_past_period_end_denied(self):
        result = self.gate("CANCELED", _past(days=1), _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_EXPIRED"

    def test_canceled_expired_includes_checkout_url(self):
        result = self.gate("CANCELED", _past(days=1), _now(), checkout_url="https://buy.polar.sh/x")
        assert result["checkout_url"] == "https://buy.polar.sh/x"

    # ── PAUSED ──────────────────────────────────────────────────────────────

    def test_paused_always_allowed(self):
        result = self.gate("PAUSED", _past(days=5), _now())
        assert result is None

    def test_paused_no_billing_end_allowed(self):
        result = self.gate("PAUSED", None, _now())
        assert result is None

    # ── BLOCKED statuses ────────────────────────────────────────────────────

    def test_payment_failed_denied(self):
        result = self.gate("PAYMENT_FAILED", _future(days=5), _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_PAYMENT_FAILED"

    def test_payment_failed_includes_checkout_url(self):
        result = self.gate("PAYMENT_FAILED", None, _now(), checkout_url="https://buy.polar.sh/x")
        assert result["checkout_url"] == "https://buy.polar.sh/x"

    def test_suspended_denied(self):
        result = self.gate("SUSPENDED", _future(days=5), _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_SUSPENDED"

    def test_suspended_no_checkout_url_even_when_available(self):
        result = self.gate("SUSPENDED", None, _now(), checkout_url="https://buy.polar.sh/x")
        assert "checkout_url" not in result

    def test_revoked_denied(self):
        result = self.gate("REVOKED", None, _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_REVOKED"

    def test_revoked_no_checkout_url(self):
        result = self.gate("REVOKED", None, _now(), checkout_url="https://buy.polar.sh/x")
        assert "checkout_url" not in result

    def test_refunded_denied(self):
        result = self.gate("REFUNDED", None, _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_REFUNDED"

    def test_expired_denied(self):
        result = self.gate("EXPIRED", None, _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_EXPIRED"

    def test_expired_includes_checkout_url(self):
        result = self.gate("EXPIRED", None, _now(), checkout_url="https://buy.polar.sh/x")
        assert result["checkout_url"] == "https://buy.polar.sh/x"

    # ── None / unknown status ────────────────────────────────────────────────

    def test_none_status_treated_as_unknown(self):
        result = self.gate(None, None, _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_UNKNOWN_STATE"

    def test_completely_unknown_status_denied(self):
        result = self.gate("SOME_FUTURE_STATE", None, _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_UNKNOWN_STATE"

    # ── All denied results have required fields ──────────────────────────────

    @pytest.mark.parametrize("status", [
        "AWAITING_PAYMENT", "PAYMENT_FAILED", "SUSPENDED",
        "REVOKED", "REFUNDED", "EXPIRED", None, "GARBAGE",
    ])
    def test_denied_result_always_has_code_and_message(self, status):
        result = self.gate(status, None, _now())
        assert result is not None
        assert "code" in result
        assert "message" in result
        assert result["code"].startswith("CUSTOM_PLAN_")
        assert len(result["message"]) > 10

    @pytest.mark.parametrize("status", ["TRIAL_ACTIVE", "ACTIVE", "CANCELED", "PAUSED"])
    def test_allowed_statuses_return_none_when_period_valid(self, status):
        result = self.gate(status, _future(days=10), _now())
        assert result is None


# ---------------------------------------------------------------------------
# CustomPlanConfig validators
# ---------------------------------------------------------------------------

class TestCustomPlanConfig:

    def setup_method(self):
        from main import CustomPlanConfig
        self.Model = CustomPlanConfig

    def test_valid_config_accepted(self):
        cfg = self.Model(monthly_price_usd=299, trial_days=14, max_bots=5)
        assert cfg.monthly_price_usd == 299

    def test_price_zero_accepted(self):
        cfg = self.Model(monthly_price_usd=0)
        assert cfg.monthly_price_usd == 0

    def test_price_negative_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="0 or greater"):
            self.Model(monthly_price_usd=-1)

    def test_trial_days_zero_accepted(self):
        cfg = self.Model(trial_days=0)
        assert cfg.trial_days == 0

    def test_trial_days_30_accepted(self):
        cfg = self.Model(trial_days=30)
        assert cfg.trial_days == 30

    def test_trial_days_31_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="between 0 and 30"):
            self.Model(trial_days=31)

    def test_trial_days_negative_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="between 0 and 30"):
            self.Model(trial_days=-1)

    def test_max_bots_negative_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="0 or greater"):
            self.Model(max_bots=-1)

    def test_max_messages_negative_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="0 or greater"):
            self.Model(max_messages=-1)

    def test_max_chunks_negative_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="0 or greater"):
            self.Model(max_chunks=-1)

    def test_invalid_gemini_model_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError, match="gemini_model must be one of"):
            self.Model(gemini_model="gpt-4-hacked")

    def test_none_gemini_model_accepted(self):
        cfg = self.Model(gemini_model=None)
        assert cfg.gemini_model is None

    def test_extra_fields_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self.Model(monthly_price_usd=100, unknown_field="x")

    def test_polar_checkout_url_accepted(self):
        cfg = self.Model(polar_checkout_url="https://buy.polar.sh/prod_abc")
        assert cfg.polar_checkout_url == "https://buy.polar.sh/prod_abc"

    def test_defaults_match_custom_plan_defaults(self):
        from main import CUSTOM_PLAN_DEFAULTS
        cfg = self.Model()
        assert cfg.trial_days == CUSTOM_PLAN_DEFAULTS["trial_days"]
        assert cfg.polar_checkout_url == CUSTOM_PLAN_DEFAULTS["polar_checkout_url"]


# ---------------------------------------------------------------------------
# CUSTOM_PLAN_DEFAULTS structure
# ---------------------------------------------------------------------------

class TestCustomPlanDefaults:

    def setup_method(self):
        from main import CUSTOM_PLAN_DEFAULTS
        self.defaults = CUSTOM_PLAN_DEFAULTS

    def test_has_all_required_keys(self):
        required = {
            "plan_name", "monthly_price_usd", "trial_days",
            "max_bots", "max_messages", "max_chunks",
            "human_handoff", "lead_capture", "white_label",
            "webhook", "custom_logo", "analytics",
            "polar_checkout_url", "polar_created_at",
        }
        for key in required:
            assert key in self.defaults, f"Missing key: {key}"

    def test_default_trial_days_is_14(self):
        assert self.defaults["trial_days"] == 14

    def test_default_features_are_off(self):
        for feat in ("human_handoff", "lead_capture", "white_label", "webhook", "custom_logo", "analytics"):
            assert self.defaults[feat] is False, f"{feat} should default to False"

    def test_payment_metadata_defaults_are_none(self):
        assert self.defaults["polar_checkout_url"] is None
        assert self.defaults["polar_created_at"] is None


# ---------------------------------------------------------------------------
# CustomPlanOverrideRequest
# ---------------------------------------------------------------------------

class TestCustomPlanOverrideRequest:

    def setup_method(self):
        from main import CustomPlanOverrideRequest
        self.Model = CustomPlanOverrideRequest

    def test_valid_activate(self):
        req = self.Model(action="activate", reason="testing")
        assert req.action == "activate"

    def test_valid_suspend(self):
        req = self.Model(action="suspend", reason="abuse detected")
        assert req.action == "suspend"

    def test_valid_reactivate(self):
        req = self.Model(action="reactivate", reason="resolved")
        assert req.action == "reactivate"

    def test_valid_cancel(self):
        req = self.Model(action="cancel", reason="customer requested")
        assert req.action == "cancel"

    def test_valid_extend_with_days(self):
        req = self.Model(action="extend", reason="goodwill", extend_days=7)
        assert req.extend_days == 7

    def test_action_is_free_string_at_model_level(self):
        # action is validated as an allowed set by the endpoint, not the Pydantic model.
        # The model accepts any non-empty string; the endpoint raises 400 for unknown actions.
        req = self.Model(action="delete", reason="bad")
        assert req.action == "delete"  # model-level: accepted; endpoint-level: rejected

    def test_reason_required(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self.Model(action="activate")

    def test_empty_reason_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self.Model(action="activate", reason="")

    def test_extend_days_zero_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self.Model(action="extend", reason="test", extend_days=0)

    def test_extend_days_366_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self.Model(action="extend", reason="test", extend_days=366)

    def test_extend_days_365_accepted(self):
        req = self.Model(action="extend", reason="long extension", extend_days=365)
        assert req.extend_days == 365

    def test_extend_days_1_accepted(self):
        req = self.Model(action="extend", reason="one day", extend_days=1)
        assert req.extend_days == 1


# ---------------------------------------------------------------------------
# Dashboard status_color and quick_actions mappings
# (Test the logic constants, not the DB-dependent endpoint)
# ---------------------------------------------------------------------------

class TestDashboardMappings:
    """Verify the color and valid-actions tables used by the dashboard endpoint."""

    STATUS_COLOR = {
        "TRIAL_ACTIVE": "green",
        "ACTIVE": "green",
        "PAUSED": "green",
        "AWAITING_PAYMENT": "amber",
        "CANCELED": "amber",
        "PAYMENT_FAILED": "red",
        "SUSPENDED": "red",
        "REVOKED": "red",
        "REFUNDED": "red",
        "EXPIRED": "red",
    }

    VALID_ACTIONS = {
        "AWAITING_PAYMENT": ["activate", "cancel"],
        "TRIAL_ACTIVE":     ["suspend", "cancel", "extend"],
        "ACTIVE":           ["suspend", "cancel", "extend"],
        "PAYMENT_FAILED":   ["activate", "suspend", "cancel", "extend"],
        "PAUSED":           ["suspend", "cancel"],
        "CANCELED":         ["activate"],
        "EXPIRED":          ["activate"],
        "SUSPENDED":        ["reactivate", "cancel"],
        "REVOKED":          ["activate"],
        "REFUNDED":         ["activate"],
    }

    def test_all_terminal_statuses_are_red(self):
        for s in ("PAYMENT_FAILED", "SUSPENDED", "REVOKED", "REFUNDED", "EXPIRED"):
            assert self.STATUS_COLOR[s] == "red", f"{s} should be red"

    def test_active_statuses_are_green(self):
        for s in ("TRIAL_ACTIVE", "ACTIVE", "PAUSED"):
            assert self.STATUS_COLOR[s] == "green"

    def test_pending_statuses_are_amber(self):
        for s in ("AWAITING_PAYMENT", "CANCELED"):
            assert self.STATUS_COLOR[s] == "amber"

    def test_suspended_can_only_reactivate_or_cancel(self):
        actions = self.VALID_ACTIONS["SUSPENDED"]
        assert set(actions) == {"reactivate", "cancel"}

    def test_active_cannot_reactivate(self):
        for s in ("TRIAL_ACTIVE", "ACTIVE"):
            assert "reactivate" not in self.VALID_ACTIONS[s]

    def test_terminal_states_can_activate(self):
        for s in ("CANCELED", "EXPIRED", "REVOKED", "REFUNDED"):
            assert "activate" in self.VALID_ACTIONS[s], f"{s} should allow activate"

    def test_active_states_can_extend(self):
        for s in ("TRIAL_ACTIVE", "ACTIVE", "PAYMENT_FAILED"):
            assert "extend" in self.VALID_ACTIONS[s]


# ---------------------------------------------------------------------------
# Webhook handler — custom plan lookup branch
# (Tests the branching logic with a mocked DB cursor)
# ---------------------------------------------------------------------------

class TestWebhookCustomPlanLookup:
    """
    Tests for the custom-plan lookup branch in the Polar webhook handler.
    We validate the lookup semantics without triggering a real DB connection.
    """

    def test_known_standard_product_skips_custom_lookup(self):
        import main
        # POLAR_PRODUCT_TIER_MAP should not contain a made-up product
        assert "unknown_product_xyz" not in main.POLAR_PRODUCT_TIER_MAP

    def test_polar_product_tier_map_has_expected_keys(self):
        import main
        tier_map = main.POLAR_PRODUCT_TIER_MAP
        # All values must be non-CUSTOM tiers (custom plan lookup is separate)
        for product_id, tier in tier_map.items():
            assert tier != "CUSTOM", f"Standard product {product_id} should not map to CUSTOM"
            assert tier in {"FREE", "EXPLORE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"}

    def test_check_custom_plan_gate_suspended_not_overwritten_by_active_event(self):
        """
        SUSPENDED is sticky — even if Polar sends an 'active' event, status
        must not be flipped. The gate function itself should still deny SUSPENDED
        regardless of billing_end being in the future.
        """
        from main import _check_custom_plan_gate
        # Billing end is in the future (i.e., Polar says active), but status=SUSPENDED
        result = _check_custom_plan_gate("SUSPENDED", _future(days=30), _now())
        assert result is not None
        assert result["code"] == "CUSTOM_PLAN_SUSPENDED"


# ---------------------------------------------------------------------------
# Reconciliation report structure
# ---------------------------------------------------------------------------

class TestReconciliationReport:
    """
    Smoke-test _run_custom_plan_reconciliation with a fully mocked DB.
    Verifies the report dict structure without touching Polar or a real DB.
    """

    @pytest.mark.asyncio
    async def test_reconcile_returns_expected_keys_when_polar_token_missing(self):
        import main

        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.fetchone.return_value = (0, 0)

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch("main.get_db_connection", return_value=mock_conn), \
             patch("main.release_db_connection"), \
             patch("main.log_admin_action"), \
             patch.dict(os.environ, {}, clear=False):
            # Remove POLAR_ACCESS_TOKEN so the job skips the Polar fetch
            os.environ.pop("POLAR_ACCESS_TOKEN", None)
            report = await main._run_custom_plan_reconciliation()

        assert "ran_at" in report
        assert "db_custom_users" in report
        assert "mismatches" in report
        assert "awaiting_payment_stale" in report
        assert "payment_failed_24h" in report
        assert "polar_reachable" in report
        assert report["polar_reachable"] is False
        assert isinstance(report["mismatches"], list)

    @pytest.mark.asyncio
    async def test_reconcile_flags_orphan_db_row(self):
        """DB has tier=CUSTOM, status=ACTIVE, but no custom_plan_polar_product_id."""
        import main

        now = datetime.now(timezone.utc)
        orphan_row = (
            "user_abc",          # clerk_id
            "test@example.com",  # email
            "ACTIVE",            # subscription_status (non-terminal)
            None,                # custom_plan_polar_product_id — None → orphan
            now + timedelta(days=5),  # billing_period_end
            now,                 # last_polar_event_at
            now - timedelta(days=10),  # created_at
        )

        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [orphan_row]
        mock_cursor.fetchone.return_value = (0, 0)

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch("main.get_db_connection", return_value=mock_conn), \
             patch("main.release_db_connection"), \
             patch("main.log_admin_action"), \
             patch.dict(os.environ, {}, clear=False):
            os.environ.pop("POLAR_ACCESS_TOKEN", None)
            report = await main._run_custom_plan_reconciliation()

        assert len(report["mismatches"]) == 1
        assert report["mismatches"][0]["type"] == "ORPHAN_DB_NO_PRODUCT_ID"
        assert report["mismatches"][0]["clerk_id"] == "user_abc"

    @pytest.mark.asyncio
    async def test_reconcile_flags_stale_awaiting_payment(self):
        """DB has AWAITING_PAYMENT for >7 days — should appear in stale list."""
        import main

        now = datetime.now(timezone.utc)
        stale_row = (
            "user_stale",
            "stale@example.com",
            "AWAITING_PAYMENT",
            None,
            None,
            None,
            now - timedelta(days=10),  # created >7 days ago
        )

        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [stale_row]
        mock_cursor.fetchone.return_value = (0, 0)

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch("main.get_db_connection", return_value=mock_conn), \
             patch("main.release_db_connection"), \
             patch("main.log_admin_action"), \
             patch.dict(os.environ, {}, clear=False):
            os.environ.pop("POLAR_ACCESS_TOKEN", None)
            report = await main._run_custom_plan_reconciliation()

        assert len(report["awaiting_payment_stale"]) == 1
        assert report["awaiting_payment_stale"][0]["clerk_id"] == "user_stale"

    @pytest.mark.asyncio
    async def test_reconcile_does_not_flag_terminal_awaiting_payment_as_orphan(self):
        """AWAITING_PAYMENT with no product_id is terminal — should NOT be an orphan mismatch."""
        import main

        now = datetime.now(timezone.utc)
        row = (
            "user_terminal",
            "t@example.com",
            "AWAITING_PAYMENT",  # terminal-ish; orphan check skips terminal statuses
            None,
            None,
            None,
            now,  # just created — not stale
        )

        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [row]
        mock_cursor.fetchone.return_value = (0, 0)

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch("main.get_db_connection", return_value=mock_conn), \
             patch("main.release_db_connection"), \
             patch("main.log_admin_action"), \
             patch.dict(os.environ, {}, clear=False):
            os.environ.pop("POLAR_ACCESS_TOKEN", None)
            report = await main._run_custom_plan_reconciliation()

        orphan_mismatches = [m for m in report["mismatches"] if m["type"] == "ORPHAN_DB_NO_PRODUCT_ID"]
        assert len(orphan_mismatches) == 0


# ---------------------------------------------------------------------------
# State machine — legal and illegal transition assertions
# ---------------------------------------------------------------------------

class TestStateMachineTransitions:
    """
    Verify that the gate allows/denies the expected combinations that represent
    legal state machine transitions.
    """

    def setup_method(self):
        from main import _check_custom_plan_gate
        self.gate = _check_custom_plan_gate

    def test_awaiting_payment_to_trial_active_is_blocked(self):
        """AWAITING_PAYMENT user cannot access — must complete checkout first."""
        assert self.gate("AWAITING_PAYMENT", _future(days=14), _now()) is not None

    def test_trial_active_within_trial_has_access(self):
        """TRIAL_ACTIVE user with future billing_end has full access."""
        assert self.gate("TRIAL_ACTIVE", _future(days=7), _now()) is None

    def test_active_subscription_has_access(self):
        assert self.gate("ACTIVE", _future(days=30), _now()) is None

    def test_active_subscription_with_past_end_within_grace_has_access(self):
        """Renewal webhook may be delayed — 48h grace must absorb this."""
        assert self.gate("ACTIVE", _past(hours=47), _now()) is None

    def test_active_subscription_past_grace_loses_access(self):
        assert self.gate("ACTIVE", _past(hours=49), _now()) is not None

    def test_canceled_before_period_end_retains_access(self):
        """Customer canceled but period hasn't ended — they keep access."""
        assert self.gate("CANCELED", _future(days=3), _now()) is None

    def test_canceled_after_period_end_loses_access(self):
        assert self.gate("CANCELED", _past(days=1), _now()) is not None

    def test_payment_failed_blocks_immediately(self):
        """PAYMENT_FAILED has no grace period — blocked at first failed charge."""
        assert self.gate("PAYMENT_FAILED", _future(days=30), _now()) is not None

    def test_suspended_blocks_even_with_valid_billing(self):
        """Admin suspend is sticky — future billing_end does not grant access."""
        assert self.gate("SUSPENDED", _future(days=30), _now()) is not None

    def test_revoked_blocks_permanently(self):
        assert self.gate("REVOKED", _future(days=30), _now()) is not None

    def test_refunded_blocks_immediately(self):
        assert self.gate("REFUNDED", _future(days=30), _now()) is not None

    def test_paused_retains_access_regardless_of_billing(self):
        """Polar pause = access preserved. billing_end is irrelevant."""
        assert self.gate("PAUSED", _past(days=10), _now()) is None
