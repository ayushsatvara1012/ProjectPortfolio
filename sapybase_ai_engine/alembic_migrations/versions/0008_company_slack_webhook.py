"""Add Slack lead-handoff webhook URL to companies.

Revision ID: 0008
Revises: 0007
Created: 2026-06-03 (Conversion engine — turnkey Slack handoff for captured leads).

Adds one column to companies:
  * slack_webhook_url TEXT NULL
        -- owner's Slack Incoming Webhook URL (https://hooks.slack.com/...).
        -- When set, each captured lead is posted to that Slack channel. NULL =
        -- Slack handoff disabled. Format/host is validated at the API layer.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0008'
down_revision: Union[str, Sequence[str], None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS slack_webhook_url")
