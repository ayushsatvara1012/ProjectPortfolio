-- v13: Bot Logo Customization (Shape + Custom URL)
-- Run in your Supabase SQL Editor BEFORE deploying v13 backend.

-- 1. Add new columns for the customization feature
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS logo_shape      VARCHAR(20) NOT NULL DEFAULT 'circle',
    ADD COLUMN IF NOT EXISTS custom_logo_url TEXT;

-- 2. Hard constraint: only the four supported shapes are accepted.
ALTER TABLE companies
    DROP CONSTRAINT IF EXISTS companies_logo_shape_check;

ALTER TABLE companies
    ADD CONSTRAINT companies_logo_shape_check
        CHECK (logo_shape IN ('circle', 'squircle', 'bento', 'sharp'));

-- 3. Backfill existing row constraint data for logo_shape
UPDATE companies
    SET logo_shape = 'circle'
    WHERE logo_shape IS NULL OR logo_shape NOT IN ('circle', 'squircle', 'bento', 'sharp');

-- 4. SMART DATA MIGRATION: Preserve existing custom bot logos
-- If a user customized their specific bot with a non-default logo in the old 'logo_url' column, 
-- we migrate that link into the new 'custom_logo_url' column to ensure no customizations are lost.
UPDATE companies
    SET custom_logo_url = logo_url
    WHERE logo_url IS NOT NULL 
    AND custom_logo_url IS NULL
    AND logo_url != '/SB_loading_clean.svg';

-- 5. Add DB Definitions and Comments
COMMENT ON COLUMN companies.logo_shape IS
    'Widget avatar shape. Allowed: circle | squircle | bento | sharp. Default: circle.';

COMMENT ON COLUMN companies.custom_logo_url IS
    'Tenant-supplied HTTPS image URL for the bot avatar. NULL = Sapybase default logo. '
    'Tenant is responsible for hosting and CORS. Sapybase never stores or proxies the image.';
