"""Add custom_plan_polar_product_id column to users and grandfather existing CUSTOM users.

Revision ID: 0003
Revises: 0002
Created: 2026-05-07 (Phase A of custom_plan_flow implementation).

== What this migration does ==

1. Adds `custom_plan_polar_product_id VARCHAR(255)` to the `users` table.
   This column stores the Polar product ID for custom-plan users and is the
   key used in webhook lookup. It must be indexed for fast WHERE lookups.

2. Creates a partial index on the column (WHERE NOT NULL) — typical query
   pattern is `WHERE custom_plan_polar_product_id = %s` and the vast
   majority of rows will be NULL (standard/free users).

3. Grandfathers existing CUSTOM-tier users: any user with tier='CUSTOM' and
   no custom_plan_polar_product_id is set to subscription_status='AWAITING_PAYMENT'.
   This makes the state explicit (§10.17 decision: force AWAITING_PAYMENT,
   admin must re-provision via the new /provision endpoint).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add column (idempotent)
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_plan_polar_product_id VARCHAR(255) NULL"
    )

    # 2. Partial index for fast webhook lookups
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_users_custom_plan_polar_product_id
          ON users (custom_plan_polar_product_id)
          WHERE custom_plan_polar_product_id IS NOT NULL
        """
    )

    # 3. Grandfather: existing CUSTOM users with no linked Polar product
    #    must go through the new /provision endpoint — set AWAITING_PAYMENT
    #    so access gate blocks them until they re-provision.
    op.execute(
        """
        UPDATE users
           SET subscription_status = 'AWAITING_PAYMENT'
         WHERE tier = 'CUSTOM'
           AND (custom_plan_polar_product_id IS NULL OR custom_plan_polar_product_id = '')
           AND subscription_status NOT IN ('AWAITING_PAYMENT', 'REVOKED', 'REFUNDED', 'EXPIRED', 'CANCELED')
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_users_custom_plan_polar_product_id")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS custom_plan_polar_product_id")
