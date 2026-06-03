"""Add weekly results digest settings to companies.

Revision ID: 0007
Revises: 0006
Created: 2026-06-03 (Conversion engine — weekly lead-results digest email).

Adds two columns to companies:
  * weekly_digest_enabled   BOOLEAN NOT NULL DEFAULT TRUE
        -- owner opt-in for the weekly results email (on by default).
  * last_weekly_digest_week TEXT NULL
        -- ISO-week key (e.g. '2026-W23') of the last sent digest; used to
        -- guarantee at-most-once-per-week delivery regardless of how often the
        -- cron trigger fires. NULL = never sent.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0007'
down_revision: Union[str, Sequence[str], None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS "
        "weekly_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE"
    )
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_weekly_digest_week TEXT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS last_weekly_digest_week")
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS weekly_digest_enabled")
