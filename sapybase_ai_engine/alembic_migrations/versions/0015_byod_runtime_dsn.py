"""Add runtime (vaayu_runtime) DSN columns to byod_tenant_databases.

Revision ID: 0015
Revises: 0014
Created: 2026-06-15 (RFC docs/rfc-byod.md Phase 2.3 — §5.4 least-privilege roles).

Provisioning (Phase 2.3) creates a DML-only ``vaayu_runtime`` role on the tenant
DB and derives a runtime DSN the engine's request path uses (Phase 3), kept
separate from the privileged migrate DSN. These four columns hold that runtime
DSN, envelope-encrypted exactly like the migrate DSN (ciphertext only — §5.1).

Additive + idempotent (ADD COLUMN IF NOT EXISTS); the columns are nullable, so
existing rows are untouched until re-provisioned. DDL is the single source of
truth in ``byod_store`` (imported here so the migration and app code never drift).
Dark by default — nothing reads these until the Phase 3 engine cutover.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401

from byod_store import RUNTIME_DSN_ADD_COLUMNS_SQL, RUNTIME_DSN_DROP_COLUMNS_SQL


revision: str = '0015'
down_revision: Union[str, Sequence[str], None] = '0014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(RUNTIME_DSN_ADD_COLUMNS_SQL)


def downgrade() -> None:
    op.execute(RUNTIME_DSN_DROP_COLUMNS_SQL)
