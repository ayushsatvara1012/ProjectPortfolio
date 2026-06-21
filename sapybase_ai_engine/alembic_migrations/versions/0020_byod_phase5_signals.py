"""Add the Phase 5 client->admin change signal + last-health columns.

Revision ID: 0020
Revises: 0019
Created: 2026-06-21 (BYOD Admin & Client UI plan — Phase 5, §4).

Phase 5 lets a BYOD client raise an admin-run change request (reconnect / leave)
and gives the operator a clear signal on the fleet list, plus surfaces the last
successful health probe in the client status card. Rather than stand up a separate
notifications system, the latest open request is parked on the tenant row
(``pending_change_*``) so it joins straight into the existing fleet query; a
``last_health_at`` column records the last healthy probe (distinct from
``updated_at``, which any mutation bumps).

Additive + idempotent (ADD COLUMN IF NOT EXISTS) and DARK by default (all NULLABLE,
default NULL): every existing row is untouched and behaviour is unchanged until a
client actually raises a request. DDL is the single source of truth in
``byod_store`` (imported here so the migration and app code never drift).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401

from byod_store import PHASE5_SIGNALS_ADD_COLUMNS_SQL, PHASE5_SIGNALS_DROP_COLUMNS_SQL


revision: str = '0020'
down_revision: Union[str, Sequence[str], None] = '0019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(PHASE5_SIGNALS_ADD_COLUMNS_SQL)


def downgrade() -> None:
    op.execute(PHASE5_SIGNALS_DROP_COLUMNS_SQL)
