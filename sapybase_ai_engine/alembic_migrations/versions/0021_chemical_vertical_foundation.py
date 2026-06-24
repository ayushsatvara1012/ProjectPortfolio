"""Chemical vertical — Phase 0 foundation: companies.vertical + products table.

Revision ID: 0021
Revises: 0020
Created: 2026-06-23 (Chemical Vertical AI Agent plan — Phase 0, §8).

Lays the pack machinery's data seams WITHOUT changing any current bot's behaviour
(ships "dark", zero risk — same discipline as the BYOD rollout).

Two additive, idempotent changes:

  1. companies.vertical TEXT NULL
        -- Selects which vertical pack drives the agent. NULL = today's generic
           bot (every existing customer), so behaviour is identical until a
           company is explicitly set to a vertical (e.g. 'chemical'). The pack
           registry (packs/) reads this value; an unknown value safely falls back
           to the generic path.

  2. products TABLE  (company_id-scoped catalog)
        -- The structured chemical catalog that Phase 1's get_sds / Phase 2's
           get_product_spec look up. sds_ref holds an HTTPS URL into the factory's
           existing digital SDS library (decided 2026-06-23) — no file storage in
           Phase 0. company_id FK + indexes scope every lookup to one tenant (no
           cross-tenant SDS leakage). Lives in the shared control DB; the factory
           (customer zero) is NOT BYOD-routed.

Additive + idempotent (ADD COLUMN / CREATE TABLE / CREATE INDEX IF NOT EXISTS), so
it is safe to run against a DB where these were already applied by hand, and it
introduces no behaviour change on its own.

NOTE (prod drift): the prod control DB is stamped at alembic_version 0018 while
0019/0020 were applied out-of-band; `alembic upgrade head` will run 0019 → 0020 →
0021. 0019/0020 are idempotent no-ops there, then 0021 applies. This migration
holds the same IF-NOT-EXISTS line so re-runs are safe.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0021'
down_revision: Union[str, Sequence[str], None] = '0020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. The vertical selector. NULL = generic bot (unchanged behaviour).
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS vertical TEXT NULL")

    # 2. The chemical product catalog. company_id-scoped; sds_ref = HTTPS URL.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            cas_number  TEXT,
            grade       TEXT,
            packaging   TEXT,
            sds_ref     TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    # Lookup by CAS number within a tenant (get_sds' precise key).
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_products_company_cas "
        "ON products (company_id, cas_number)"
    )
    # Lookup by case-insensitive product name within a tenant (name fallback).
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_products_company_name "
        "ON products (company_id, lower(name))"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_products_company_name")
    op.execute("DROP INDEX IF EXISTS idx_products_company_cas")
    op.execute("DROP TABLE IF EXISTS products")
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS vertical")
