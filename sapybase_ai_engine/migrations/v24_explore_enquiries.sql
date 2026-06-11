-- ── v24_explore_enquiries.sql ───────────────────────────────────────────────
-- Explore plan (§3): signup enquiries from personal-email applicants.
--
-- Business emails get an instant $0 Explore subscription (no row here).
-- Personal/free emails (gmail.com, etc.) cannot self-serve — they submit an
-- enquiry that a super-admin manually approves before access is granted.
-- Disposable/invalid emails are rejected at the endpoint and never persisted.
--
-- status lifecycle:  pending → approved | rejected
-- email_class mirrors email_routing.classify_email_domain():
--   'business' | 'personal' | 'disposable' | 'invalid'

CREATE TABLE IF NOT EXISTS explore_enquiries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL,
    name          TEXT,
    company_name  TEXT,
    use_case      TEXT,
    email_class   TEXT NOT NULL,                       -- classification at submit time
    status        TEXT NOT NULL DEFAULT 'pending',     -- pending | approved | rejected
    source_ip     INET,                                -- abuse forensics
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at   TIMESTAMPTZ,
    reviewed_by   TEXT,                                -- super-admin email/id who actioned it
    review_note   TEXT                                 -- decline reason (required on decline, §6)
);

-- Admin queue: list pending enquiries newest-first.
CREATE INDEX IF NOT EXISTS idx_explore_enquiries_status
    ON explore_enquiries (status, created_at DESC);

-- One *pending* enquiry per email — re-submits while under review are deduped.
-- (Approved/rejected rows are kept for history and don't block this.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_explore_enquiries_pending_email
    ON explore_enquiries (lower(email))
    WHERE status = 'pending';
