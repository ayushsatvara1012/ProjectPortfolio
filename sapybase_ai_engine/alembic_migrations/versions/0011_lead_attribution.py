"""Add source attribution to lead_capture.

Revision ID: 0011
Revises: 0010
Created: 2026-06-03 (BI — know which pages/campaigns produce leads and won deals).

Adds five nullable columns to lead_capture, all best-effort signals captured
from the widget at submit time:
  * page_url     TEXT  -- the page the visitor was on
  * referrer     TEXT  -- document.referrer
  * utm_source   TEXT
  * utm_medium   TEXT
  * utm_campaign TEXT

Additive and idempotent. All NULL for historical rows (reported as 'Direct').
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0011'
down_revision: Union[str, Sequence[str], None] = '0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS page_url TEXT NULL")
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS referrer TEXT NULL")
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS utm_source TEXT NULL")
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS utm_medium TEXT NULL")
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS utm_campaign TEXT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS utm_campaign")
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS utm_medium")
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS utm_source")
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS referrer")
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS page_url")
