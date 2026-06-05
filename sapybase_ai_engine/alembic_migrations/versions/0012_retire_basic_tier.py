"""Retire the legacy BASIC tier — migrate remaining rows to STARTER.

Revision ID: 0012
Revises: 0011
Created: 2026-06-05 (Pricing cleanup — the $9 BASIC plan was pulled from Polar.
BASIC had identical limits to STARTER, so this migration is lossless.)

BASIC is no longer sold and has been removed from PLAN_LIMITS / MODEL_MAPPING /
TIER_RATE_LIMITS and the UserTier enum. Any pre-existing rows with tier='BASIC'
would otherwise fall back to FREE once the tier is gone from config, silently
revoking access. This migration promotes them to STARTER (same max_bots /
messages / chunks), preserving every customer's capabilities.

Idempotent: re-running is a no-op once no BASIC rows remain. The application
also normalizes BASIC→STARTER lazily on read (get_current_user), so this is
belt-and-suspenders for environments where migrations run after deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0012'
down_revision: Union[str, Sequence[str], None] = '0011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE users SET tier = 'STARTER' WHERE tier = 'BASIC'")


def downgrade() -> None:
    # Non-reversible: BASIC is retired and STARTER rows are indistinguishable
    # from migrated BASIC rows. No-op to keep the chain reversible structurally.
    pass
