"""Static plan / model configuration constants.

Pure, immutable data — no env reads, no I/O, no side effects. Extracted verbatim
from main.py (no value changes) and re-exported from main so existing references
and the test suite resolve unchanged.
"""

from datetime import timedelta

# ── Plan Definitions ────────────────────────────────────────────────────────
# Commercial tiers (display name → internal key):
#   Starter  → STARTER  ($19/mo)  — RAG bot + UI customization. No conversion engine.
#   Growth   → PRO      ($49/mo)  — + lead capture/scoring, alerts, booking, Action Center, digest.
#   Scale    → BUSINESS ($99/mo)  — + deep BI (ROI/funnel/attribution), Slack, webhooks, handoff, white-label.
#   Enterprise → ENTERPRISE/CUSTOM (contact) — everything, custom limits.
# FREE = inactive/trial state. Starter is the entry paid tier.
# This is the single backend source of truth; src/lib/auth/entitlements.ts MUST mirror it.
# EXPLORE = lifetime-free top-of-funnel (a $0 Polar subscription). Full product ON
# (analytics, lead capture, WhatsApp/human handoff, webhooks, custom logo, advanced
# bot) EXCEPT white_label — the permanent "Powered by Vaayu Intelligence" badge is the
# viral engine. Cost-bearing dimensions are capped: 1 bot, 1000 messages/mo, 12000
# words, `lite` model, 50 owner-emails/mo. white_label is False here and must never be
# enabled via any self-serve path (super-admin override only, logged).
#
# `words` (knowledge-base storage limit, docs/word-based-storage-limit-plan.md):
# a real word count (len(text.split())) summed over ingested RAG chunks — NOT a
# chunk-row count. Values below are the pre-existing chunk limits × 60 (the
# frontend's long-standing chunks-to-words display constant), so commercial
# parity is exact; the pricing page's "60,000 / 240,000 / 900,000 / 12,000
# words" copy is these numbers verbatim.
#
# `max_owner_emails` (NEW dimension): monthly cap on Resend lead-emails sent to bot owners
# (the "resting"-state lead email). EXPLORE = 50 (abuse backstop). Paid tiers = 999999
# (effectively unlimited — "upgrade for unlimited lead emails" is a selling point). FREE = 0.
# NOTE: `advanced_bot` is intentionally NOT a PLAN_LIMITS key — it is an entitlements-only
# flag (see entitlements.ts, gated via company config not has_entitlement). Do not add it here.
#
# `byo_database` (BYOD — RFC docs/rfc-byod.md §3): a plan capability flag, present on EVERY
# row (False everywhere except the BYOD template) so the schema shape stays uniform and
# has_entitlement(user, "byo_database") resolves for any tier — exactly like white_label.
# BYOD = "Build-Your-Own-Database": the client supplies only a Postgres DSN; every feature
# is ON (incl. white_label). PLAN_LIMITS["BYOD"] is NOT a tier users are assigned to — it is
# the DEFAULT TEMPLATE that seeds a per-client `custom_plan_config` (tier stays CUSTOM, §3.1).
# Caps below are fair-use / anti-abuse on a flat $149/mo LLM-included plan (§3.2/§3.3), all
# super-admin editable. MUST stay mirrored with src/lib/auth/entitlements.ts (Rule R18).
PLAN_LIMITS = {
    "FREE":       {"max_bots": 0,   "messages": 0,      "words": 0,       "speed": "none",      "human_handoff": False, "lead_capture": False, "white_label": False, "webhook": False, "analytics": False, "custom_logo": False, "max_owner_emails": 0,      "byo_database": False},
    "EXPLORE":    {"max_bots": 1,   "messages": 1000,   "words": 12000,   "speed": "lite",      "human_handoff": True,  "lead_capture": True,  "white_label": False, "webhook": True,  "analytics": True, "custom_logo": True,  "max_owner_emails": 50,     "byo_database": False},
    "STARTER":    {"max_bots": 1,   "messages": 5000,   "words": 60000,   "speed": "standard",  "human_handoff": False, "lead_capture": False, "white_label": False, "webhook": False, "analytics": False, "custom_logo": False, "max_owner_emails": 999999, "byo_database": False},
    "PRO":        {"max_bots": 3,   "messages": 15000,  "words": 240000,  "speed": "priority",  "human_handoff": False, "lead_capture": True,  "white_label": False, "webhook": False, "analytics": False, "custom_logo": False, "max_owner_emails": 999999, "byo_database": False},
    "BUSINESS":   {"max_bots": 5,   "messages": 50000,  "words": 900000,  "speed": "ultra",     "human_handoff": True,  "lead_capture": True,  "white_label": True,  "webhook": True,  "analytics": True, "custom_logo": True,  "max_owner_emails": 999999, "byo_database": False},
    "ENTERPRISE": {"max_bots": 999, "messages": 999999, "words": 5999940, "speed": "dedicated", "human_handoff": True,  "lead_capture": True,  "white_label": True,  "webhook": True,  "analytics": True, "custom_logo": True,  "max_owner_emails": 999999, "byo_database": False},
    # BYOD template (RFC §3.2): flat $149/mo, LLM included; all features ON incl white_label.
    # 50k messages, 1 bot, 3M words (storage is the client's — only one-time embedding is ours).
    "BYOD":       {"max_bots": 1,   "messages": 50000,  "words": 3000000, "speed": "dedicated", "human_handoff": True,  "lead_capture": True,  "white_label": True,  "webhook": True,  "analytics": True, "custom_logo": True,  "max_owner_emails": 999999, "byo_database": True},
}

# ── Non-tier model selection ─────────────────────────────────────────────────
# Every model id in the stack lives here. Hardcoding them at call sites is how
# gemini-2.0-flash-lite stayed wired into PDF OCR for ten weeks after Google
# retired it (2026-06-01): the call raised, the handler swallowed it, and owners
# silently got "Could not extract text from this PDF" instead of an error.

# Cheap deterministic helpers: HyDE, rerank, eval judge, insight synthesis,
# teaser copy, session summaries. Cheapest model Google sells, and these are
# short temperature-0 jobs where frontier reasoning buys nothing.
AUX_MODEL = "gemini-2.5-flash-lite"

# Vision OCR for scanned PDFs. Capped at 3 pages per document, so absolute spend
# is negligible and accuracy outranks the price gap — this is the only text that
# source will ever have. Replaces gemini-2.0-flash-lite, retired 2026-06-01.
OCR_MODEL = "gemini-2.5-flash"

# Vertical ReAct agent, pinned independently of tier: the loop makes 3-5 blocking
# calls inside a 30s budget, so availability and speed outrank raw intelligence.
AGENT_MODEL = "gemini-2.5-flash"

# ── Why not Gemini 3.x, verified against the live API 2026-08-13 ─────────────
# 3.x is cheaper-per-intelligence and every id resolves and responds fast
# (3.5-flash-lite 0.57s, 3.5-flash 1.23s). It is NOT adopted yet because those
# models return `response.content` as a LIST of content blocks where 2.5 returns
# a plain string, and `output_version` does not change that on 3.x — it is the
# model, not the adapter. 22 call sites here read `.content` as text, so a swap
# would print [{'type': 'text', ...}] into live replies. Adopting 3.x needs a
# normalisation layer at the model boundary plus a re-run of the guardrail evals
# and the response-contract thresholds, which were tuned on 2.5 output.

# ── Dynamic Model Mapping (Profit & Speed Optimization) ──────────────────────
# Maps user tiers to specific models for cost efficiency and performance.
MODEL_MAPPING = {
    "FREE":       "gemini-2.5-flash-lite",
    "EXPLORE":    "gemini-2.5-flash-lite",  # cheapest model — upgrade path = smarter/faster
    "STARTER":    "gemini-2.5-flash",
    # RFC §3.2 named gemini-2.5-pro for these tiers. It now 404s ("no longer
    # available to new users"), verified against the live API 2026-08-13, so the
    # generic chat path was erroring for every paid tier. gemini-2.5-flash is the
    # highest model that both works and returns string content — and at
    # $0.30/$2.50 per 1M it is 4x cheaper than the 2.5-pro it replaces.
    # Tier differentiation is carried by token ceilings until 3.x is adopted.
    "PRO":        "gemini-2.5-flash",
    "BUSINESS":   "gemini-2.5-flash",
    "ENTERPRISE": "gemini-2.5-flash",
    "BYOD":       "gemini-2.5-flash",  # BYOD default model (RFC §3.2; super-admin editable)
}

# Retired ids are deliberately absent. An allowlisted-but-retired model passes
# validation and then fails at call time; a rejected one falls back to a working
# tier default instead. The 2.5 entries are still live and may be pinned on
# existing bot rows, so they stay.
VALID_MODELS = set(MODEL_MAPPING.values()) | {
    "gemini-2.5-flash-lite", "gemini-2.5-flash",
}

UNLIMITED_PLAN = {"max_bots": 999, "messages": 999999999, "words": 999999999, "speed": "dedicated"}

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
    # EXPLORE serves real traffic (unlike FREE), so it needs genuine anti-abuse caps.
    # Generous for one real bot; tight enough to bound a single widget-key replay burst.
    "EXPLORE":    {"per_minute": 20,  "per_hour": 200,    "per_day": 1200},
    "STARTER":    {"per_minute": 40,  "per_hour": 800,    "per_day": 4800},
    "PRO":        {"per_minute": 80,  "per_hour": 2000,   "per_day": 12000},
    "BUSINESS":   {"per_minute": 200, "per_hour": 5000,   "per_day": 30000},   # ultra-speed tier
    "ENTERPRISE": {"per_minute": 500, "per_hour": 999999, "per_day": 999999},
    "CUSTOM":     {"per_minute": 100, "per_hour": 3000,   "per_day": 18000},   # safe default; override via custom_plan_config
    # BYOD (RFC §3.2): 100/min · 2,000/hr · 6,000/day. The daily ceiling (~3.6× a 50k/mo
    # bot's avg daily volume) absorbs spikes while bounding Gemini spend on the flat plan (§3.3).
    "BYOD":       {"per_minute": 100, "per_hour": 2000,   "per_day": 6000},
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

# ── Signup-routing domain lists (Explore plan §3) ────────────────────────────
# Personal/free-mail domains → route to the ENQUIRY flow (manual approval) instead
# of an instant $0 Explore grant. This filters intent and protects LLM cost.
# Stored as data (frozenset, lowercase) — extend over time without touching logic.
FREE_EMAIL_DOMAINS = frozenset({
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "ymail.com",
    "rocketmail.com", "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
    "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com", "proton.me", "gmx.com",
    "gmx.net", "mail.com", "yandex.com", "yandex.ru", "tutanota.com", "hey.com", "zoho.com",
    "fastmail.com", "pm.me",
})

# Disposable / throwaway domains → HARD BLOCK signup (abuse). Static list covers ~95%;
# do NOT add an external disposable-check API at launch (new dependency + latency + failure
# mode). Revisit only if abuse data shows it's needed.
DISPOSABLE_EMAIL_DOMAINS = frozenset({
    "mailinator.com", "10minutemail.com", "guerrillamail.com", "temp-mail.org", "tempmail.com",
    "trashmail.com", "getnada.com", "throwawaymail.com", "yopmail.com", "sharklasers.com",
    "dispostable.com", "maildrop.cc",
})

# ── Custom plan feature flag keys (canonical list) ───────────────────────────
# `byo_database` (RFC §3.1) joins the set so it can be granted per-client via
# custom_plan_config and resolved by has_entitlement, exactly like the others.
# Mirror this set with the resolve(...) feature keys in entitlements.ts (Rule R18).
CUSTOM_PLAN_FEATURE_KEYS = {
    "advanced_bot", "human_handoff", "lead_capture", "white_label", "webhook", "custom_logo", "analytics", "byo_database"
}

CUSTOM_PLAN_DEFAULTS = {
    "plan_name": "Custom Plan",
    "monthly_price_usd": 0,
    "trial_days": 14,
    "max_bots": 1,
    "max_messages": 500,
    "max_words": 6000,
    "gemini_model": None,
    "max_output_tokens": None,
    "advanced_bot": False,
    "human_handoff": False,
    "lead_capture": False,
    "white_label": False,
    "webhook": False,
    "custom_logo": False,
    "analytics": False,
    "byo_database": False,
    "notes": "",
    # Payment metadata — populated by /provision endpoint, not by admin form
    "polar_checkout_url": None,
    "polar_created_at": None,
}

# ── BYOD seed template (RFC §3.1/§3.2) ───────────────────────────────────────
# Putting a client on BYOD creates a per-client `custom_plan_config` PRE-FILLED
# from this template (tier stays CUSTOM); the super-admin panel may then override
# every field. Derived from the canonical PLAN_LIMITS["BYOD"] / MODEL_MAPPING so
# limits and model can never drift from the tier template. Price ($149) is the one
# literal — it lives nowhere else. Consumed by provisioning in Phase 2.1.
BYOD_PLAN_DEFAULTS = {
    **CUSTOM_PLAN_DEFAULTS,
    "plan_name": "BYOD",
    "monthly_price_usd": 149,
    "max_bots": PLAN_LIMITS["BYOD"]["max_bots"],
    "max_messages": PLAN_LIMITS["BYOD"]["messages"],
    "max_words": PLAN_LIMITS["BYOD"]["words"],
    "gemini_model": MODEL_MAPPING["BYOD"],
    # Every capability ON. advanced_bot isn't a PLAN_LIMITS key (entitlements-only),
    # so it defaults True here; the rest mirror the all-on PLAN_LIMITS["BYOD"] row.
    **{k: PLAN_LIMITS["BYOD"].get(k, True) for k in CUSTOM_PLAN_FEATURE_KEYS},
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
