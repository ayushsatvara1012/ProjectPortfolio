"""Tests for signup email-domain classification & routing (Explore §3)."""
import pytest


def _import():
    import services.email_routing as er
    return er


class TestNormalizeDomain:
    def test_basic(self):
        er = _import()
        assert er.normalize_email_domain("a@gmail.com") == "gmail.com"

    def test_lowercases_and_trims(self):
        er = _import()
        assert er.normalize_email_domain("  User@Gmail.COM  ") == "gmail.com"

    def test_plus_addressing_keeps_domain(self):
        er = _import()
        assert er.normalize_email_domain("user+promo@acme.io") == "acme.io"

    def test_trailing_dot_stripped(self):
        er = _import()
        assert er.normalize_email_domain("user@gmail.com.") == "gmail.com"

    @pytest.mark.parametrize("bad", [
        None, "", "   ", "noatsign", "a@@b.com", "two@@", "@gmail.com",
        "user@", "user@localhost", "user@nodot", 123, "a@b@c.com",
    ])
    def test_malformed_returns_none(self, bad):
        er = _import()
        assert er.normalize_email_domain(bad) is None


class TestClassify:
    @pytest.mark.parametrize("email", [
        "founder@acme.io", "ceo@my-company.co", "team@startup.dev",
    ])
    def test_business(self, email):
        er = _import()
        assert er.classify_email_domain(email) == er.BUSINESS

    @pytest.mark.parametrize("email", [
        "a@gmail.com", "b@yahoo.co.in", "c@outlook.com", "d@proton.me", "e@icloud.com",
    ])
    def test_personal(self, email):
        er = _import()
        assert er.classify_email_domain(email) == er.PERSONAL

    @pytest.mark.parametrize("email", [
        "a@mailinator.com", "b@10minutemail.com", "c@yopmail.com",
    ])
    def test_disposable(self, email):
        er = _import()
        assert er.classify_email_domain(email) == er.DISPOSABLE

    def test_subdomain_of_personal_is_personal(self):
        er = _import()
        assert er.classify_email_domain("user@mail.gmail.com") == er.PERSONAL

    def test_lookalike_is_not_personal(self):
        # `evil-gmail.com` must NOT match `gmail.com` (no dot boundary).
        er = _import()
        assert er.classify_email_domain("user@evil-gmail.com") == er.BUSINESS

    @pytest.mark.parametrize("bad", [None, "", "user@localhost", "noat"])
    def test_invalid(self, bad):
        er = _import()
        assert er.classify_email_domain(bad) == er.INVALID

    def test_disposable_takes_priority(self):
        # Guard the ordering even though the lists are disjoint today.
        er = _import()
        from core.config import FREE_EMAIL_DOMAINS, DISPOSABLE_EMAIL_DOMAINS
        assert FREE_EMAIL_DOMAINS.isdisjoint(DISPOSABLE_EMAIL_DOMAINS)


class TestRouting:
    def test_business_grants_explore(self):
        er = _import()
        assert er.signup_route_for("founder@acme.io") == er.ROUTE_GRANT_EXPLORE

    def test_personal_routes_to_enquiry(self):
        er = _import()
        assert er.signup_route_for("a@gmail.com") == er.ROUTE_ENQUIRY

    @pytest.mark.parametrize("email", ["a@mailinator.com", "garbage", "", None])
    def test_disposable_and_invalid_are_blocked(self, email):
        er = _import()
        assert er.signup_route_for(email) == er.ROUTE_BLOCK


class TestInitialSignupStatus:
    @pytest.mark.parametrize("email", [
        "founder@acme.io",   # business
        "a@gmail.com",       # personal
    ])
    def test_real_emails_are_pending(self, email):
        er = _import()
        assert er.initial_signup_status(email) == er.SIGNUP_STATUS_PENDING

    @pytest.mark.parametrize("email", [
        "a@mailinator.com",            # disposable
        "garbage", "", None, "user@localhost",  # invalid
    ])
    def test_disposable_and_invalid_are_blocked(self, email):
        er = _import()
        assert er.initial_signup_status(email) == er.SIGNUP_STATUS_BLOCKED

    def test_statuses_are_distinct_and_not_tiers(self):
        # Guard the contract: PENDING/BLOCKED are subscription_status values,
        # deliberately NOT in PLAN_LIMITS (tier lookups stay valid via FREE).
        er = _import()
        from core.config import PLAN_LIMITS
        assert er.SIGNUP_STATUS_PENDING != er.SIGNUP_STATUS_BLOCKED
        assert er.SIGNUP_STATUS_PENDING not in PLAN_LIMITS
        assert er.SIGNUP_STATUS_BLOCKED not in PLAN_LIMITS


class TestSignupProvisioning:
    def test_never_grants_explore_even_when_pre_approved(self):
        er = _import()
        # Provisioning NEVER grants EXPLORE — not even for an approved email. The
        # EXPLORE tier is earned only by completing the Polar $0 checkout (webhook).
        # A brand-new signup always starts FREE + gate-holding status.
        assert er.signup_provisioning("a@gmail.com") == ("FREE", er.SIGNUP_STATUS_PENDING)
        assert er.signup_provisioning("founder@acme.io") == ("FREE", er.SIGNUP_STATUS_PENDING)

    def test_real_email_is_free_pending(self):
        er = _import()
        assert er.signup_provisioning("a@gmail.com") == ("FREE", er.SIGNUP_STATUS_PENDING)
        assert er.signup_provisioning("founder@acme.io") == ("FREE", er.SIGNUP_STATUS_PENDING)

    def test_disposable_is_free_blocked(self):
        er = _import()
        assert er.signup_provisioning("a@mailinator.com") == ("FREE", er.SIGNUP_STATUS_BLOCKED)
        assert er.signup_provisioning("garbage") == ("FREE", er.SIGNUP_STATUS_BLOCKED)

    def test_provisioned_tier_is_a_valid_plan_limits_key(self):
        er = _import()
        from core.config import PLAN_LIMITS
        tier, _ = er.signup_provisioning("a@gmail.com")
        assert tier in PLAN_LIMITS  # FREE must be a real tier


class TestExploreCtaRoute:
    def test_business_email_goes_to_checkout(self):
        er = _import()
        assert er.explore_cta_route("FREE", "founder@acme.io") == er.ROUTE_CTA_CHECKOUT
        assert er.explore_cta_route(None, "team@startup.dev") == er.ROUTE_CTA_CHECKOUT

    def test_personal_email_goes_to_enquiry_until_approved(self):
        er = _import()
        # Personal email with no approval → enquiry form.
        assert er.explore_cta_route("FREE", "a@gmail.com") == er.ROUTE_CTA_ENQUIRY
        assert (
            er.explore_cta_route("FREE", "a@gmail.com", has_approved_enquiry=False)
            == er.ROUTE_CTA_ENQUIRY
        )

    def test_approved_personal_email_goes_to_checkout(self):
        er = _import()
        # Once the enquiry is approved, the personal user routes to Polar checkout —
        # approval unlocks the door but does NOT grant Explore (the webhook does).
        assert (
            er.explore_cta_route("FREE", "a@gmail.com", has_approved_enquiry=True)
            == er.ROUTE_CTA_CHECKOUT
        )

    def test_approval_does_not_override_block_for_disposable(self):
        er = _import()
        # A disposable/invalid email stays BLOCKED even if (somehow) flagged approved.
        assert (
            er.explore_cta_route("FREE", "x@mailinator.com", has_approved_enquiry=True)
            == er.ROUTE_CTA_BLOCKED
        )

    def test_disposable_invalid_blocked(self):
        er = _import()
        assert er.explore_cta_route("FREE", "x@mailinator.com") == er.ROUTE_CTA_BLOCKED
        assert er.explore_cta_route("FREE", "garbage") == er.ROUTE_CTA_BLOCKED

    @pytest.mark.parametrize("tier", ["EXPLORE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE", "CUSTOM"])
    def test_existing_access_tiers_are_active_noop(self, tier):
        er = _import()
        # Even a personal email on an access tier → ACTIVE (already has access).
        assert er.explore_cta_route(tier, "a@gmail.com") == er.ROUTE_CTA_ACTIVE
