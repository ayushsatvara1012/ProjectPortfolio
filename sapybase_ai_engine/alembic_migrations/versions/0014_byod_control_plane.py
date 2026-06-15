"""Create byod_tenant_databases — BYOD control-plane encrypted-DSN store + routing.

Revision ID: 0014
Revises: 0013
Created: 2026-06-14 (RFC docs/rfc-byod.md Phase 1.2 — §2 two-plane model).

Adds the **control-plane** registry for Build-Your-Own-Database tenants. One row
per BYOD company_id holds the envelope-encrypted DSN (ciphertext only — RFC §5.1),
the company_id→tenant-DB routing pointer, the tenant DB's data-plane schema_version
(§8.1), and the provisioning status (§4 / §10). It lives on Sapybase's own Postgres
(the trusted plane) and never on the client's database.

The exact DDL is the single source of truth in ``byod_store.CONTROL_PLANE_SCHEMA_SQL``,
imported here so the migrated table and the store/test code can never drift. Fully
additive and idempotent (CREATE TABLE/INDEX IF NOT EXISTS), so re-running is safe.

Dark by default: nothing in the engine connects to a tenant DB yet (Phase 3), and
with the byo_database flag off, behavior is byte-for-byte unchanged. This migration
only provisions storage on the control plane.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401

from byod_store import CONTROL_PLANE_SCHEMA_SQL, CONTROL_PLANE_SCHEMA_DROP_SQL


revision: str = '0014'
down_revision: Union[str, Sequence[str], None] = '0013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(CONTROL_PLANE_SCHEMA_SQL)


def downgrade() -> None:
    op.execute(CONTROL_PLANE_SCHEMA_DROP_SQL)
