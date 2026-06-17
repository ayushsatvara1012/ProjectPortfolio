"""Create byod_switchout_jobs + byod_switchout_progress — switch-OUT migration state.

Revision ID: 0018
Revises: 0017
Created: 2026-06-16 (RFC docs/rfc-byod.md Phase 7.2 — §16.6, rule 17).

Control-plane bookkeeping for the reverse migration: moving a tenant's rows back
from its own BYO database into the shared Sapybase DB when it leaves BYOD.
``byod_switchout_jobs`` holds one row per tenant (status + the verified cutover
marker recorded when the engine stops connecting to the tenant DB);
``byod_switchout_progress`` holds the per-table copy checkpoint that makes the
reverse move resumable + idempotent. The client's own database is never written by
switch-out — only read.

The exact DDL is the single source of truth in
``byod_switchout.CONTROL_PLANE_SCHEMA_SQL``, imported here so the migrated tables
and the switch-out/test code can never drift. Additive + idempotent (CREATE TABLE
IF NOT EXISTS). Dark by default: nothing populates these tables until an operator
runs a switch-out.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401

from byod_switchout import CONTROL_PLANE_SCHEMA_SQL, CONTROL_PLANE_SCHEMA_DROP_SQL


revision: str = '0018'
down_revision: Union[str, Sequence[str], None] = '0017'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(CONTROL_PLANE_SCHEMA_SQL)


def downgrade() -> None:
    op.execute(CONTROL_PLANE_SCHEMA_DROP_SQL)
