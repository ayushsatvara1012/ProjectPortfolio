-- Migration v14: SaPyBase ROI & Analytics Engine

-- 1. Modify chat_logs
ALTER TABLE chat_logs 
ADD COLUMN IF NOT EXISTS sentiment VARCHAR,
ADD COLUMN IF NOT EXISTS intent_category VARCHAR,
ADD COLUMN IF NOT EXISTS session_id UUID;

-- 2. New Table lead_capture
CREATE TABLE IF NOT EXISTS lead_capture (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR NOT NULL,
    name VARCHAR,
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_lead_capture_company ON lead_capture(company_id);

-- 3. New Table roi_benchmarks
CREATE TABLE IF NOT EXISTS roi_benchmarks (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    avg_human_cost_per_ticket NUMERIC DEFAULT 5.00,
    avg_lead_value NUMERIC DEFAULT 50.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
