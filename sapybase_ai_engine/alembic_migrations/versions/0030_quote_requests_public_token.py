"""Chemical vertical — Phase 4 (hardening): quote_requests.public_token + expires_at.

Revision ID: 0030
Revises: 0029
Created: 2026-07-04 (Chemical-agent hardening plan — Phase 4 shareable quote link).

A priced/POR quote today lives only inside the chat that produced it — the buyer
can't forward it to procurement and the owner has no shareable artifact. Phase 4
mints an unguessable token per quote so ``/q/<token>`` renders a branded, read-only
quote page.

  public_token  TEXT, unique — the capability key for the public page. Unguessable
                (``secrets.token_urlsafe``), so the token itself is the tenant scope;
                no company_id is needed in the public URL. NULL on pre-Phase-4 rows.
  expires_at    TIMESTAMPTZ — validity horizon (created_at + 30 days, set at insert).
                The public endpoint 410s once past this; NULL = never-expiring legacy
                rows (never surfaced — only tokened rows have a page).

Additive + idempotent (ADD COLUMN / CREATE UNIQUE INDEX IF NOT EXISTS). The unique
index tolerates many NULLs (Postgres treats NULLs as distinct), so backfilling old
rows is unnecessary. Safe no-op + stamp when it later runs via Alembic on deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0030'
down_revision: Union[str, Sequence[str], None] = '0029'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS public_token TEXT")
    op.execute("ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_requests_public_token "
        "ON quote_requests (public_token)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_quote_requests_public_token")
    op.execute("ALTER TABLE quote_requests DROP COLUMN IF EXISTS expires_at")
    op.execute("ALTER TABLE quote_requests DROP COLUMN IF EXISTS public_token")
