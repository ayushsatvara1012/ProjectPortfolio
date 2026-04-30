-- v23: HMAC signing secret per bot + webhook delivery audit log

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

CREATE TABLE IF NOT EXISTS lead_webhook_deliveries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    lead_id       UUID NOT NULL,
    attempt       SMALLINT NOT NULL DEFAULT 1,
    status        TEXT NOT NULL,          -- 'success' | 'failed'
    http_status   SMALLINT,
    error_msg     TEXT,
    delivered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lwd_company_lead
    ON lead_webhook_deliveries (company_id, lead_id);
