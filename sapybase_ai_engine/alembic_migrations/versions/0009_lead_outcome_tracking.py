"""Add outcome/pipeline tracking to lead_capture.

Revision ID: 0009
Revises: 0008
Created: 2026-06-03 (Closed-loop BI — track what happens to each lead so ROI
reflects realized revenue, not just potential).

Adds three columns to lead_capture:
  * status            TEXT NOT NULL DEFAULT 'new'
        -- pipeline state: 'new' | 'contacted' | 'won' | 'lost'.
        -- Existing rows default to 'new' (honest "not yet worked").
  * value_usd         NUMERIC(12,2) NULL
        -- realized deal value, set when a lead is marked 'won'. NULL otherwise.
  * status_updated_at TIMESTAMPTZ NULL
        -- when the status last changed (NULL = never moved off 'new').

A partial index on (company_id, status) keeps pipeline aggregation fast.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0009'
down_revision: Union[str, Sequence[str], None] = '0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'")
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS value_usd NUMERIC(12,2) NULL")
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ NULL")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_lead_capture_company_status "
        "ON lead_capture (company_id, status)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_lead_capture_company_status")
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS status_updated_at")
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS value_usd")
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS status")
