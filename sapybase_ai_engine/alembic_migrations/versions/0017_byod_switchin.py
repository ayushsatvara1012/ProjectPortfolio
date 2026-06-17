"""Create byod_switchin_jobs + byod_switchin_progress — switch-IN migration state.

Revision ID: 0017
Revises: 0016
Created: 2026-06-16 (RFC docs/rfc-byod.md Phase 7.1 — §4.2, rule 17).

Control-plane bookkeeping for relocating a tenant's rows from the shared Sapybase
DB into its own BYO database when it switches onto BYOD. ``byod_switchin_jobs``
holds one row per tenant (status, the verified atomic cutover marker, and the
7-day ``retain_until`` rollback window); ``byod_switchin_progress`` holds the
per-table copy checkpoint (last copied id) that makes the move resumable + idempotent.

The exact DDL is the single source of truth in
``byod_switchin.CONTROL_PLANE_SCHEMA_SQL``, imported here so the migrated tables
and the switch-in/test code can never drift. Additive + idempotent (CREATE TABLE
IF NOT EXISTS), so re-running is safe. Dark by default: nothing populates these
tables until an operator runs a switch-in.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401

from byod_switchin import CONTROL_PLANE_SCHEMA_SQL, CONTROL_PLANE_SCHEMA_DROP_SQL


revision: str = '0017'
down_revision: Union[str, Sequence[str], None] = '0016'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(CONTROL_PLANE_SCHEMA_SQL)


def downgrade() -> None:
    op.execute(CONTROL_PLANE_SCHEMA_DROP_SQL)
