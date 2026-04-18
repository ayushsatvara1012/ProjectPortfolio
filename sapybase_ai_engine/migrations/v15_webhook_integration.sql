-- v15: Lead capture webhook URL per bot
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS webhook_url TEXT;