"""Add booking_url to companies (instant-booking / speed-to-lead).

Revision ID: 0010
Revises: 0009
Created: 2026-06-03 (Conversion engine — let qualified leads book a meeting the
moment they leave their details).

Adds one column to companies:
  * booking_url TEXT NULL
        -- HTTPS scheduling link (Calendly, Cal.com, HubSpot, …) surfaced as a
        -- "Book a call" CTA in the widget for HOT/WARM leads. NULL = feature off.

Additive and idempotent. Distinct from handoff_redirect_url, which is shown
only after a human-handoff request.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0010'
down_revision: Union[str, Sequence[str], None] = '0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS booking_url TEXT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS booking_url")
