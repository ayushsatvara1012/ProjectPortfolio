-- V8 Performance & Security Migration
-- Part 1: Webhook Idempotency (Issue #5)
CREATE TABLE IF NOT EXISTS processed_webhooks (
    webhook_id VARCHAR(255) PRIMARY KEY,
    provider VARCHAR(50) NOT NULL, -- e.g., 'polar', 'clerk'
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_id ON processed_webhooks(webhook_id);

-- Part 2: Essential Performance Indexes (Issue #6)
-- Auth and Multi-tenancy lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_companies_api_key ON companies(api_key);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);

-- Usage tracking lookups (used in every /api/chat call)
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);

-- Knowledge Base lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_company_id ON company_knowledge(company_id);

-- Part 3: Vector Search Index (CRITICAL for pgvector performance)
-- We use HNSW for better speed/recall trade-off than IVFFlat.
-- Note: 'vector_cosine_ops' assumes you are using cosine similarity.
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding 
ON company_knowledge 
USING hnsw (embedding vector_cosine_ops);
