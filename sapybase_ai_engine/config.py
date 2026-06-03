"""Static plan / model configuration constants.

Pure, immutable data — no env reads, no I/O, no side effects. Extracted verbatim
from main.py (no value changes) and re-exported from main so existing references
and the test suite resolve unchanged.
"""

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
