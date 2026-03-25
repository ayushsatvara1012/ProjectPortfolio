-- V9 Advanced Security & Audit Migration
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_clerk_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'UPDATE_USER_TIER'
    target_id VARCHAR(255),
    changes JSONB, -- Store {'old': 'FREE', 'new': 'PRO'}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast audit lookups by admin or target
CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON admin_audit_log(admin_clerk_id);
CREATE INDEX IF NOT EXISTS idx_audit_target_id ON admin_audit_log(target_id);
