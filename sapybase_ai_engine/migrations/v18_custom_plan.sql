-- ── v18_custom_plan.sql ─────────────────────────────────────────────────────
-- Custom Plan support: admin-configured per-user overrides.
-- All limits and feature flags live in a single JSONB column so new params
-- require zero schema changes in the future.
--
-- Expected custom_plan_config shape (all fields optional, null = use tier default):
-- {
--   "plan_name":             "Agency Pro",          -- display label
--   "monthly_price_usd":     299,                   -- for your records only, not enforced here
--   "max_bots":              15,
--   "max_messages":          50000,
--   "max_chunks":            10000,
--   "gemini_model":          "gemini-2.5-pro",      -- must be in VALID_MODELS
--   "max_output_tokens":     1200,
--   "human_handoff":         true,
--   "lead_capture":          true,
--   "white_label":           true,
--   "webhook":               true,
--   "custom_logo":           true,
--   "analytics":             true,
--   "notes":                 "Agency deal, signed 2026-04-20"
-- }

ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_plan_config JSONB DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Index so admin queries filtering on CUSTOM tier stay fast
CREATE INDEX IF NOT EXISTS idx_users_custom_plan ON users ((custom_plan_config IS NOT NULL)) WHERE custom_plan_config IS NOT NULL;

-- Add CUSTOM to the tier enum if it doesn't already exist.
-- PostgreSQL requires this in two steps when the column is in use.
DO $$
BEGIN
    ALTER TYPE user_tier ADD VALUE IF NOT EXISTS 'CUSTOM';
EXCEPTION WHEN others THEN
    -- tier is stored as VARCHAR in some setups; the UPDATE below handles it either way.
    NULL;
END$$;
