"""Chemical vertical — Phase 4b (Transact): agent_requests.

Revision ID: 0023
Revises: 0022
Created: 2026-06-25 (Chemical Vertical AI Agent plan — Phase 4b, §10).

Phase 4b widens the transactional tier from "the agent prices a SKU" (4a) to
"the agent captures a commitment and routes it to a human in real time". The
first such commitment is a free-sample request (``request_sample``).

Rather than mint a dedicated table per future transact tool (sample, then later
consult, callback, …), this lays ONE generic record table:

  agent_requests  (the record any non-quote transact tool creates — owner-facing)
        -- ``kind`` discriminates the request type ('sample' today; 'consult',
           etc. land here later without a new migration). Carries the resolved
           product context (name/CAS/grade/pack_size), an optional quantity, the
           captured contact, a free-text note, and a status the owner works
           ('new' → …). Quotes keep their own richer ``quote_requests`` table
           (price snapshots); this is for the record-and-route tools.

Why generic, not dedicated: every record-and-route tool needs the same shape
(product + contact + status), and the owner dashboard renders them with one
panel. A ``kind`` column avoids a migration (and a new endpoint + panel) per
tool — the discipline of "the vertical is data", applied to records too.

company_id-scoped (FK ON DELETE CASCADE): these are the owner's leads, so every
read/write filters by tenant; no cross-tenant leak.

Additive + idempotent (CREATE TABLE / CREATE INDEX IF NOT EXISTS), so it is safe
to run against a DB where this was already applied by hand (the Test Web bot is
seeded out-of-band via Supabase MCP, same pattern as Phase 0/1/4a). It changes no
existing bot's behaviour: only a ``vertical='chemical'`` company with the
request_sample tool wired ever writes here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0023'
down_revision: Union[str, Sequence[str], None] = '0022'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # One generic record for every non-quote transact tool. `kind` discriminates.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_requests (
            id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            session_id     TEXT,
            kind           TEXT NOT NULL,
            product_name   TEXT,
            cas_number     TEXT,
            grade          TEXT,
            pack_size      TEXT,
            quantity       INTEGER,
            contact_name   TEXT,
            contact_email  TEXT,
            contact_phone  TEXT,
            note           TEXT,
            status         TEXT NOT NULL DEFAULT 'new',
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    # Owner dashboard lists newest-first, scoped to the tenant (optionally by kind).
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_agent_requests_company_created "
        "ON agent_requests (company_id, created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_agent_requests_company_created")
    op.execute("DROP TABLE IF EXISTS agent_requests")
