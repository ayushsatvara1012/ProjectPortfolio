-- SaPyBase Consolidated Migration Script for Supabase
-- This script recreates the entire schema from Neon into Supabase.

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    tier VARCHAR(50) DEFAULT 'FREE',
    subscription_status VARCHAR(50) DEFAULT 'active',
    polar_customer_id VARCHAR(255),
    billing_period_end TIMESTAMP,
    trial_end_date TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE,
    allowed_origin TEXT,
    domain VARCHAR(255),
    white_label BOOLEAN DEFAULT FALSE,
    bot_name VARCHAR(255) DEFAULT 'SapyBase Assistant',
    logo_url TEXT DEFAULT '/SB_loading_clean.svg',
    initial_message TEXT DEFAULT 'Hi! I am the SaPyBase AI Assistant. How can I help you today?',
    company_tone TEXT DEFAULT 'Professional and helpful',
    theme_color VARCHAR(50) DEFAULT '#5730F5',
    system_prompt TEXT DEFAULT 'You are a helpful AI assistant.',
    quick_questions JSONB,
    admin_notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Allowed Domains Table (For security/CORS)
CREATE TABLE IF NOT EXISTS allowed_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL
);

-- 5. Usage Tracking Table
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    messages_used INTEGER NOT NULL DEFAULT 0,
    sources_used INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 6. Company Knowledge Table (AI Memory)
CREATE TABLE IF NOT EXISTS company_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    url TEXT,
    content TEXT,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Admin Audit Log
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_clerk_id VARCHAR(255) NOT NULL,
    action TEXT NOT NULL,
    target_id VARCHAR(255),
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Processed Webhooks (Idempotency)
CREATE TABLE IF NOT EXISTS processed_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id VARCHAR(255) NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_companies_api_key ON companies(api_key);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_company_id ON company_knowledge(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON admin_audit_log(admin_clerk_id);
