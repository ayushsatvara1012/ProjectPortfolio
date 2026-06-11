"""Dashboard access-gate decision (Explore plan, decisions D3 + D5) — pure helpers.

No I/O, no DB — the single source of truth for "may this user enter the
dashboard?". Mirrored on the frontend by src/lib/auth/accessGate.ts (keep in sync).

THE RULE (hybrid model, D1)
---------------------------
Every user needs a real plan to use the dashboard: Explore ($0 Polar sub) or a
paid tier. A user with no plan yet sits in a blocked state and is routed to
/pricing to pick one (which, for a business email, is the instant free Explore).

DENYLIST semantics (intentional)
--------------------------------
We block a small, explicit set of "no real plan" states and allow everything
else. This (a) exactly preserves today's behaviour — FREE / null blocked, every
real tier allowed — and (b) won't accidentally lock out a tier added later.

Blocked states:
  FREE     — legacy inactive / pre-activation tier (being retired from signup).
  PENDING  — signed up, no plan selected yet. Whether Phase B records this as a
             tier or a subscription_status, a brand-new user also has a null/empty
             tier, which this gate already blocks — so new users are covered
             either way.

Billing-status enforcement (expired / suspended / custom-plan payment gate) is
handled on the request paths (get_current_user, the chat path); this function
answers only the prior question: "does this user have a plan at all?"
"""

# "No real plan yet" → blocked from the dashboard, routed to /pricing.
DASHBOARD_BLOCKED_TIERS = frozenset({"FREE", "PENDING"})


def is_dashboard_access_allowed(role, tier) -> bool:
    """True if this user may enter the dashboard.

    SUPER_ADMIN always passes. A null/empty tier or a blocked tier (FREE/PENDING)
    is denied. Any real plan (EXPLORE, STARTER, PRO, BUSINESS, ENTERPRISE, CUSTOM)
    passes. Case-insensitive on tier.
    """
    if role == "SUPER_ADMIN":
        return True
    normalized = (tier or "").strip().upper()
    if not normalized or normalized in DASHBOARD_BLOCKED_TIERS:
        return False
    return True
