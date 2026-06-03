"""Add hot-lead alert settings to companies.

Revision ID: 0006
Revises: 0005
Created: 2026-06-03 (Conversion engine — owner control over instant HOT-lead alerts).

Adds two columns to companies:
  * hot_lead_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE
        -- owner opt-in for the instant HOT-lead email (on by default so existing
        -- Pro customers keep getting alerts without any action).
  * alert_email             TEXT NULL
        -- optional override address for alerts; when blank/NULL the alert falls
        -- back to the account owner's email (users.email).

No backfill needed: the DEFAULT applies to existing rows, and alert_email NULL
correctly means "use the account email".
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0006'
down_revision: Union[str, Sequence[str], None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS "
        "hot_lead_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE"
    )
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS alert_email TEXT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS alert_email")
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS hot_lead_alerts_enabled")
