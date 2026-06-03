"""Add lead scoring columns to lead_capture.

Revision ID: 0005
Revises: 0004
Created: 2026-06-02 (Track 3 item 12 — deterministic lead scoring + routing).

Adds three nullable columns to lead_capture:
  * score         INTEGER  -- 0..100 deterministic lead quality score
  * score_band    TEXT     -- 'HOT' | 'WARM' | 'COLD'
  * score_reasons TEXT     -- human-readable "; "-joined explanation of the score

Backfill is intentionally omitted: existing leads keep NULL (honest "unscored"),
new captures are scored synchronously at capture time. No LLM, no extra cost.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0005'
down_revision: Union[str, Sequence[str], None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS score INTEGER NULL")
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS score_band TEXT NULL")
    op.execute("ALTER TABLE lead_capture ADD COLUMN IF NOT EXISTS score_reasons TEXT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS score_reasons")
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS score_band")
    op.execute("ALTER TABLE lead_capture DROP COLUMN IF EXISTS score")
