"""Chemical vertical — Phase 4a (Transact): product_skus + quote_requests.

Revision ID: 0022
Revises: 0021
Created: 2026-06-25 (Chemical Vertical AI Agent plan — Phase 4, §10).

Phase 4 crosses the read-only line: the agent now *writes*. This migration lays
the two seams the first transactional tool (``request_quote``) needs:

  1. product_skus  (the SKU-level price list)
        -- One row per priced pack: (product, grade, pack_size). Pricing lives one
           level BELOW `products` (which is keyed at product/grade) because the
           same product/grade has many pack sizes, each its own price + GST.
           list_price NULL  ==  is_por TRUE  ==  "Price On Request" (bulk packs in
           the real Expresolv catalog have no list price by design -> route-to-human).
           gst_rate is PER ROW (18 / 12 / 0 all occur). currency is INR.
           NOTE: pack_code is NOT unique in the source data (real data-entry dups),
           so there is deliberately no UNIQUE constraint on it — the resolver treats
           >1 distinct price for one (product,grade,pack) as ambiguous and escalates
           rather than guessing.

  2. quote_requests  (the record a quote/POR creates — owner-facing)
        -- Snapshots price + gst at quote time so a later price edit never rewrites
           a past quote. Holds contact + status (new/sent/won/lost) for the owner
           dashboard. POR rows (is_por TRUE) carry NULL unit_price/subtotal — a
           human sends the number.

Both are company_id-scoped (FK ON DELETE CASCADE) — pricing is commercially
sensitive, so every read/write filters by tenant; no cross-tenant leak.

Additive + idempotent (CREATE TABLE / CREATE INDEX IF NOT EXISTS), so it is safe
to run against a DB where these were already applied by hand (the Test Web bot's
catalog is seeded out-of-band via Supabase MCP, same pattern as Phase 0/1). It
changes no existing bot's behaviour: only a `vertical='chemical'` company with the
request_quote tool wired ever touches these tables.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0022'
down_revision: Union[str, Sequence[str], None] = '0021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. The SKU-level price list. list_price NULL = POR (price on request).
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS product_skus (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            product_name   TEXT NOT NULL,
            cas_number     TEXT,
            grade          TEXT,
            pack_code      TEXT,
            pack_size      TEXT,
            pack_size_norm TEXT,
            list_price     NUMERIC(12, 2),
            gst_rate       NUMERIC(5, 2),
            hsn_code       TEXT,
            is_por         BOOLEAN NOT NULL DEFAULT FALSE,
            currency       TEXT NOT NULL DEFAULT 'INR',
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    # Resolve a quote: product (name/CAS) -> grade -> pack, all within a tenant.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_product_skus_company_name "
        "ON product_skus (company_id, lower(product_name))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_product_skus_company_cas "
        "ON product_skus (company_id, cas_number)"
    )

    # 2. The quote record (owner-facing). Snapshot of the priced SKU + contact.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS quote_requests (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            session_id     TEXT,
            product_name   TEXT,
            cas_number     TEXT,
            grade          TEXT,
            pack_size      TEXT,
            pack_code      TEXT,
            quantity       INTEGER,
            unit_price     NUMERIC(12, 2),
            subtotal       NUMERIC(14, 2),
            gst_rate       NUMERIC(5, 2),
            currency       TEXT NOT NULL DEFAULT 'INR',
            is_por         BOOLEAN NOT NULL DEFAULT FALSE,
            contact_name   TEXT,
            contact_email  TEXT,
            contact_phone  TEXT,
            status         TEXT NOT NULL DEFAULT 'new',
            notes          TEXT,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    # Owner dashboard lists newest-first, scoped to the tenant.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_quote_requests_company_created "
        "ON quote_requests (company_id, created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_quote_requests_company_created")
    op.execute("DROP TABLE IF EXISTS quote_requests")
    op.execute("DROP INDEX IF EXISTS idx_product_skus_company_cas")
    op.execute("DROP INDEX IF EXISTS idx_product_skus_company_name")
    op.execute("DROP TABLE IF EXISTS product_skus")
