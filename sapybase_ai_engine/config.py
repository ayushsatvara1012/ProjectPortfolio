"""Static plan / model configuration constants.

Pure, immutable data — no env reads, no I/O, no side effects. Extracted verbatim
from main.py (no value changes) and re-exported from main so existing references
and the test suite resolve unchanged.
"""

from datetime import timedelta

# ── Plan Definitions ────────────────────────────────────────────────────────
PLAN_LIMITS = {
    "FREE":       {"max_bots": 0,   "messages": 0,      "chunks": 0,     "speed": "none",      "human_handoff": False, "lead_capture": False, "white_label": False, "webhook": False, "analytics": False},
    "BASIC":      {"max_bots": 1,   "messages": 500,    "chunks": 100,   "speed": "standard",  "human_handoff": False, "lead_capture": False, "white_label": False, "webhook": False, "analytics": False},
    "STARTER":    {"max_bots": 2,   "messages": 2000,   "chunks": 500,   "speed": "priority",  "human_handoff": False, "lead_capture": True,  "white_label": True,  "webhook": False, "analytics": False},
    "PRO":        {"max_bots": 5,   "messages": 5000,   "chunks": 2000,  "speed": "dedicated", "human_handoff": False, "lead_capture": True,  "white_label": True,  "webhook": True,  "analytics": True},
    "BUSINESS":   {"max_bots": 15,  "messages": 15000,  "chunks": 10000, "speed": "ultra",     "human_handoff": True,  "lead_capture": True,  "white_label": True,  "webhook": True,  "analytics": True},
    "ENTERPRISE": {"max_bots": 999, "messages": 999999, "chunks": 99999, "speed": "dedicated", "human_handoff": True,  "lead_capture": True,  "white_label": True,  "webhook": True,  "analytics": True},
}

# ── Dynamic Model Mapping (Profit & Speed Optimization) ──────────────────────
# Maps user tiers to specific models for cost efficiency and performance.
MODEL_MAPPING = {
    "FREE":       "gemini-2.5-flash-lite",
    "BASIC":      "gemini-2.5-flash-lite",
    "STARTER":    "gemini-2.5-flash",
    "PRO":        "gemini-2.5-pro",
    "BUSINESS":   "gemini-2.5-pro",
    "ENTERPRISE": "gemini-3.1-pro-preview",
}

VALID_MODELS = set(MODEL_MAPPING.values()) | {
    "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash", "gemini-2.5-pro"
}

UNLIMITED_PLAN = {"max_bots": 999, "messages": 999999999, "chunks": 999999999, "speed": "dedicated"}

# ── Tier-aware per-minute caps (anti-abuse rate ceilings) ────────────────────
TIER_RATE_LIMITS = {
    # NOTE on FREE: it is gated UPSTREAM by its monthly quota
    # (PLAN_LIMITS["FREE"]["messages"] == 0), which returns 402 MESSAGE_LIMIT_EXCEEDED
    # before any LLM call. The 0 values below mean "no per-tier rate cap enforced in
    # this gate" — FREE never reaches the LLM path here, so it needs no rate ceiling.
    # per_day is an anti-abuse backstop: it bounds how fast a single tenant's monthly
    # quota / LLM spend can be drained (e.g. by widget-key replay), well above any
    # legitimate single-bot daily volume.
    "FREE":       {"per_minute": 0,   "per_hour": 0,      "per_day": 0},
    "BASIC":      {"per_minute": 20,  "per_hour": 200,    "per_day": 1200},
    "STARTER":    {"per_minute": 40,  "per_hour": 800,    "per_day": 4800},
    "PRO":        {"per_minute": 80,  "per_hour": 2000,   "per_day": 12000},
    "BUSINESS":   {"per_minute": 200, "per_hour": 5000,   "per_day": 30000},   # ultra-speed tier
    "ENTERPRISE": {"per_minute": 500, "per_hour": 999999, "per_day": 999999},
    "CUSTOM":     {"per_minute": 100, "per_hour": 3000,   "per_day": 18000},   # safe default; override via custom_plan_config
}

# ── Logo validation limits / allowlists (SSRF + abuse prevention) ────────────
VALID_LOGO_SHAPES = {"circle", "squircle", "bento", "sharp"}

# Regex patterns for blocked logo URL patterns (SSRF + abuse prevention)
BLOCKED_LOGO_URL_PATTERNS = [
    r"^data:",                              # Base64 data URIs — never allowed
    r"(?i)localhost",                       # Loopback by name
    r"127\.\d+\.\d+\.\d+",                 # 127.x.x.x loopback
    r"192\.168\.\d+\.\d+",                 # RFC-1918 private class C
    r"10\.\d+\.\d+\.\d+",                  # RFC-1918 private class A
    r"172\.(1[6-9]|2\d|3[01])\.\d+\.\d+", # RFC-1918 private class B
    r"169\.254\.\d+\.\d+",                 # Link-local (AWS metadata etc.)
    r"(?i)cdn\.discordapp\.com",            # Ephemeral/expiring Discord CDNs
    r"(?i)files\.slack\.com",              # Slack file CDN (auth-gated)
    r"(?i)media\.giphy\.com",             # Giphy (inconsistent CORS)
    r"0\.0\.0\.0",                         # Null route
    r"::1",                                # IPv6 loopback
    r"(?i)\.internal",                     # Internal service names
    r"(?i)metadata\.google\.internal",     # GCP metadata endpoint
    r"(?i)169\.254\.169\.254",             # AWS/Azure metadata endpoint
]

MAX_LOGO_BYTES = 2 * 1024 * 1024  # 2 MB hard ceiling

# ── Custom plan feature flag keys (canonical list) ───────────────────────────
CUSTOM_PLAN_FEATURE_KEYS = {
    "advanced_bot", "human_handoff", "lead_capture", "white_label", "webhook", "custom_logo", "analytics"
}

CUSTOM_PLAN_DEFAULTS = {
    "plan_name": "Custom Plan",
    "monthly_price_usd": 0,
    "trial_days": 14,
    "max_bots": 1,
    "max_messages": 500,
    "max_chunks": 100,
    "gemini_model": None,
    "max_output_tokens": None,
    "advanced_bot": False,
    "human_handoff": False,
    "lead_capture": False,
    "white_label": False,
    "webhook": False,
    "custom_logo": False,
    "analytics": False,
    "notes": "",
    # Payment metadata — populated by /provision endpoint, not by admin form
    "polar_checkout_url": None,
    "polar_created_at": None,
}

# ── Custom plan access gate constants ────────────────────────────────────────
_CUSTOM_PLAN_GATE_MESSAGES: dict[str, str] = {
    "AWAITING_PAYMENT": "Your custom plan is ready. Complete checkout using the link sent by your account manager.",
    "TRIAL_EXPIRED_PENDING_CHARGE": "Trial ended; payment is processing. Refresh in a few minutes.",
    "PERIOD_EXPIRED": "Subscription expired. Update your payment method to restore access.",
    "PAYMENT_FAILED": "Last charge failed. Update the card on file via the Polar customer portal.",
    "SUSPENDED": "Subscription suspended. Contact your account manager.",
    "REVOKED": "Subscription revoked. Contact support.",
    "REFUNDED": "Subscription refunded. Subscribe again to restore access.",
    "EXPIRED": "Subscription expired. Re-subscribe to continue.",
    "UNKNOWN_STATE": "Account state is unclear. Please contact support.",
}
_CUSTOM_PLAN_GATE_GRACE = timedelta(hours=48)
_CUSTOM_PLAN_GATE_BLOCKED = {"PAYMENT_FAILED", "SUSPENDED", "REVOKED", "REFUNDED", "EXPIRED"}
