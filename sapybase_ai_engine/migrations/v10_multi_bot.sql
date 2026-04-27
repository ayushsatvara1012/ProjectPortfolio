-- ── v10_multi_bot.sql ──────────────────────────────────────────────────────
-- Multi-bot plan enforcement migration
-- Run manually against Supabase/Neon before deploying v10 backend.

-- 1. Add plan-limit columns to users (denormalised for fast auth checks)
-- NOTE: Limits are enforced dynamically in code via PLAN_LIMITS/get_plan(). These columns are
--       informational only and do not override code-level limits.
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_bots INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS speed_tier VARCHAR(20) NOT NULL DEFAULT 'standard';

-- Set SUPER_ADMIN to unlimited
UPDATE users SET max_bots = 999, speed_tier = 'dedicated' WHERE role = 'SUPER_ADMIN';

-- 2. Remove the UNIQUE constraint on companies.user_id so one user can own many companies.
--    The unique index name may vary — check first:
--      SELECT conname FROM pg_constraint WHERE conrelid = 'companies'::regclass AND contype = 'u';
--    Then drop by name, e.g.:
--      ALTER TABLE companies DROP CONSTRAINT companies_user_id_key;
DROP INDEX IF EXISTS idx_companies_user_id_unique;

-- 3. Add multi-bot UX columns to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 4. Add company_id to usage_tracking for per-bot tracking
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 5. Index for per-company usage lookups
CREATE INDEX IF NOT EXISTS idx_usage_tracking_company_id ON usage_tracking(company_id);

-- 6. Backfill: link existing usage_tracking rows to the user's first company
UPDATE usage_tracking ut
SET company_id = (
    SELECT c.id FROM companies c WHERE c.user_id = ut.user_id LIMIT 1
)
WHERE ut.company_id IS NULL;

-- 7. Ensure the existing company (the live Sapybase.com bot) is visible in the bot manager.
--    The ADD COLUMN steps above apply defaults to existing rows, so is_active and display_order
--    are already set. This step creates a usage_tracking row if one doesn't exist yet,
--    so the bot card shows correct usage stats instead of 0/NULL.
INSERT INTO usage_tracking (user_id, company_id, messages_used, period_start, period_end)
SELECT
    c.user_id,
    c.id,
    0,
    now(),
    now() + interval '30 days'
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM usage_tracking ut WHERE ut.company_id = c.id
)
ON CONFLICT DO NOTHING;
