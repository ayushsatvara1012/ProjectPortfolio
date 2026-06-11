"""Signup email-domain classification & routing (Explore plan §3) — pure helpers.

No I/O — the decision brain for "what happens when this email signs up?". Reuses
the domain lists in config.py (FREE_EMAIL_DOMAINS, DISPOSABLE_EMAIL_DOMAINS).

ROUTING (§3.1)
  business email   → grant Explore (instant $0 sub once provisioning exists)
  personal/free    → enquiry flow + manual super-admin approval (PENDING)
  disposable       → HARD BLOCK (abuse)
  malformed        → BLOCK (treat as invalid)

Subdomain-aware matching: `user@mail.gmail.com` still classifies as personal
(domain == listed OR ends with ".<listed>"). The leading dot prevents
false positives like `evil-gmail.com`.
"""

from config import FREE_EMAIL_DOMAINS, DISPOSABLE_EMAIL_DOMAINS

# Classification results.
BUSINESS = "business"
PERSONAL = "personal"
DISPOSABLE = "disposable"
INVALID = "invalid"

# Routing actions (what the signup hook should do).
ROUTE_GRANT_EXPLORE = "grant_explore"
ROUTE_ENQUIRY = "enquiry"
ROUTE_BLOCK = "block"

# subscription_status stamped on a brand-new signup row (Phase B wiring).
# These are *statuses*, NOT tiers — tier stays FREE so the dashboard gate
# (which blocks FREE/null) holds them, while PLAN_LIMITS stays a valid lookup.
SIGNUP_STATUS_PENDING = "PENDING"   # real email: business→auto-provision, personal→enquiry/approval
SIGNUP_STATUS_BLOCKED = "BLOCKED"   # disposable/invalid: quarantined, never granted access


def normalize_email_domain(email) -> str | None:
    """Extract and normalize the domain from an email address.

    Returns the lowercased, trimmed domain, or None if the address is malformed
    (empty, no/!=1 '@', empty local or domain, or a domain without a dot — which
    can't be a real public email domain and must never be granted as 'business').
    """
    if not email or not isinstance(email, str):
        return None
    cleaned = email.strip().lower()
    if cleaned.count("@") != 1:
        return None
    local, _, domain = cleaned.partition("@")
    domain = domain.strip().rstrip(".")
    if not local or not domain or "." not in domain:
        return None
    return domain


def _matches(domain: str, domain_set) -> bool:
    """True if domain equals, or is a subdomain of, any domain in the set."""
    return any(domain == d or domain.endswith("." + d) for d in domain_set)


def classify_email_domain(email) -> str:
    """Classify an email as BUSINESS / PERSONAL / DISPOSABLE / INVALID.

    Disposable is checked before personal so a throwaway domain is always a hard
    block even if it were (mistakenly) also on the free list.
    """
    domain = normalize_email_domain(email)
    if domain is None:
        return INVALID
    if _matches(domain, DISPOSABLE_EMAIL_DOMAINS):
        return DISPOSABLE
    if _matches(domain, FREE_EMAIL_DOMAINS):
        return PERSONAL
    return BUSINESS


def signup_route_for(email) -> str:
    """Map an email to the signup action: grant_explore / enquiry / block."""
    classification = classify_email_domain(email)
    if classification == BUSINESS:
        return ROUTE_GRANT_EXPLORE
    if classification == PERSONAL:
        return ROUTE_ENQUIRY
    return ROUTE_BLOCK  # disposable or invalid


def initial_signup_status(email) -> str:
    """The subscription_status to stamp on a brand-new signup row (no active sub yet).

    PENDING for real emails — business will be auto-provisioned to a $0 Explore sub
    (once A0's provision helper exists), personal goes through the enquiry →
    super-admin approval flow. BLOCKED for disposable/invalid addresses so abuse
    signups are quarantined and never surface in the approval queue or get granted.

    tier stays FREE either way, so the dashboard gate blocks both — this status is
    purely a marker for the enquiry/approval + future auto-provisioner flows.
    """
    if signup_route_for(email) == ROUTE_BLOCK:
        return SIGNUP_STATUS_BLOCKED
    return SIGNUP_STATUS_PENDING


# tier + subscription_status used to provision a brand-new signup row.
SIGNUP_TIER_DEFAULT = "FREE"      # gate-blocked; valid PLAN_LIMITS key
SIGNUP_TIER_EXPLORE = "EXPLORE"
SUBSCRIPTION_ACTIVE = "ACTIVE"


# Pricing-page CTA routes for the signed-in user clicking "Get Explore".
ROUTE_CTA_ACTIVE = "active"      # already has dashboard access (Explore or paid) — nothing to do
ROUTE_CTA_CHECKOUT = "checkout"  # business email → Polar $0 hosted checkout
ROUTE_CTA_ENQUIRY = "enquiry"    # personal/free email → enquiry + manual approval
ROUTE_CTA_BLOCKED = "blocked"    # disposable/invalid email → no path

# Tiers that already grant dashboard access (so the Explore CTA is a no-op for them).
_ACCESS_TIERS = frozenset({"EXPLORE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE", "CUSTOM"})


def explore_cta_route(tier, email, *, has_approved_enquiry: bool = False) -> str:
    """What should happen when this signed-in user clicks 'Get Explore'?

    Already on an access-granting tier → ACTIVE (no-op). Otherwise classify the
    email: business → CHECKOUT (Polar $0 sub, no approval needed). Personal →
    ENQUIRY (manual super-admin approval) until that approval lands; once approved
    (has_approved_enquiry) it also goes to CHECKOUT. Approval only unlocks the
    Polar checkout door — it does NOT grant Explore. The EXPLORE tier is granted
    solely by the Polar subscription.created webhook once the $0 checkout completes,
    so the billing period (limit-reset window) always comes from Polar. Disposable/
    invalid → BLOCKED.
    """
    if tier in _ACCESS_TIERS:
        return ROUTE_CTA_ACTIVE
    route = signup_route_for(email)
    if route == ROUTE_GRANT_EXPLORE:
        return ROUTE_CTA_CHECKOUT
    if route == ROUTE_ENQUIRY:
        return ROUTE_CTA_CHECKOUT if has_approved_enquiry else ROUTE_CTA_ENQUIRY
    return ROUTE_CTA_BLOCKED


def signup_provisioning(email) -> tuple:
    """(tier, subscription_status) to provision a brand-new signup row with.

    Always FREE + the gate-holding status from initial_signup_status (PENDING for
    real emails, BLOCKED for disposable/invalid). Access to Explore is NEVER granted
    here — not even when an *approved* enquiry already exists for this email.
    Approval only unlocks the Polar checkout route (see explore_cta_route); the
    EXPLORE tier is granted solely by the Polar subscription.created webhook once the
    $0 checkout completes, so the billing period (limit reset) comes from Polar.
    """
    return (SIGNUP_TIER_DEFAULT, initial_signup_status(email))
