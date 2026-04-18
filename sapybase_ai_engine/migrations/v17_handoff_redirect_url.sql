-- v17: Human handoff redirect URL per bot
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS handoff_redirect_url TEXT;