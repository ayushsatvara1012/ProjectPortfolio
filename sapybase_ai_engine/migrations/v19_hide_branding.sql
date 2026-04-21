-- v19: Add hide_branding column to companies table
-- Allows STARTER+ users to remove "Powered by SaPyBase" footer from the widget.
-- Defaults to FALSE so existing bots are unaffected until the user explicitly toggles it.

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS hide_branding BOOLEAN NOT NULL DEFAULT FALSE;
