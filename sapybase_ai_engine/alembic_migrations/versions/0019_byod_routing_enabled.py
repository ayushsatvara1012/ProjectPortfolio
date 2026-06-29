"""Add routing_enabled switch to byod_tenant_databases.

Revision ID: 0019
Revises: 0018
Created: 2026-06-20 (BYOD Admin & Client UI plan — Phase 3, §2.1).

The Phase 3 engine change moves the per-tenant on/off out of the env canary list
and into the control plane, so an operator can toggle routing in-app with no
Render edit and no redeploy. ``BYOD_ENABLED`` (env) stays as the global kill.

Additive + idempotent (ADD COLUMN IF NOT EXISTS) and DARK by default
(NOT NULL DEFAULT FALSE): every existing row stays off, so behaviour is unchanged
until a row is explicitly enabled. During rollout the engine keeps the env-canary
list as an OR fallback for one release, so the current canary keeps routing while
this ships. DDL is the single source of truth in ``byod_store`` (imported here so
the migration and app code never drift).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401

from db.byod_store import ROUTING_ENABLED_ADD_COLUMN_SQL, ROUTING_ENABLED_DROP_COLUMN_SQL


revision: str = '0019'
down_revision: Union[str, Sequence[str], None] = '0018'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(ROUTING_ENABLED_ADD_COLUMN_SQL)


def downgrade() -> None:
    op.execute(ROUTING_ENABLED_DROP_COLUMN_SQL)
