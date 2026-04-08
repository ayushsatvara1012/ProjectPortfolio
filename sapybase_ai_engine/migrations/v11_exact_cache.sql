-- v11: Exact-Match Query Cache
-- Reduces Gemini API cost and latency by caching Q&A pairs per tenant.
-- Run this in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS exact_query_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    query_hash VARCHAR(64) NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Composite UNIQUE index: O(1) cache lookups + prevents duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_company_hash
    ON exact_query_cache (company_id, query_hash);
