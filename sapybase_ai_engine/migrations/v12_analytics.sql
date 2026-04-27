-- v12: Sapybase Insights Analytics
-- Logs every user chat interaction and stores AI-generated BI reports.

-- chat_logs: every user interaction (logged silently via BackgroundTasks)
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_query TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    was_cache_hit BOOLEAN DEFAULT false,
    is_unanswered BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Composite index for efficient per-tenant queries sorted by recency
CREATE INDEX IF NOT EXISTS idx_chat_logs_company
    ON chat_logs (company_id, created_at DESC);

-- insight_reports: cached AI-generated BI reports (24h cooldown)
CREATE TABLE IF NOT EXISTS insight_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    report_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast cooldown lookups
CREATE INDEX IF NOT EXISTS idx_insight_reports_company
    ON insight_reports (company_id, created_at DESC);
