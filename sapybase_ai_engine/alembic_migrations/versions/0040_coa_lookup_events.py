"""coa_lookup_events — shape-only COA analytics (coa-split-lookup-fields-plan Phase 5).

Revision ID: 0040
Revises: 0039
Created: 2026-08-27.

Numbered 0040, not the next-after-0038 0039 it was drafted as: the control DB's
`alembic_version` was already stamped 0039 by a `0039_company_knowledge_context`
migration (added `company_knowledge.context`, applied directly 2026-08-25) that has
no corresponding file anywhere in this git repo — an untracked prior migration, not
this one. Renumbered to 0040 to chain after it rather than collide with it. That gap
is a separate, pre-existing issue and is not fixed here.

COA queries are confidential (docs/coa-confidential-access-plan.md) and `get_coa`
is `restricted=True`, so this table never carries an identifier, a filename, or a
count — only the SHAPE of a lookup: which of the two boxes were filled, which pass
released a certificate (or that nothing did), and whether a visitor who reached the
panel clicked through to a human. That is what makes "did splitting the fields
actually help?" answerable in three weeks instead of a second round of anecdotes.

Mirrors 0033's `teaser_events`: no generic widget-event pipeline exists, so each
analytics-worthy feature gets its own narrow, CHECK-constrained sink rather than a
free-text `event` column that could grow into one.

Additive + idempotent (IF NOT EXISTS everywhere). Safe no-op + stamp when it later
runs via Alembic on deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0040'
down_revision: Union[str, Sequence[str], None] = '0039'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS coa_lookup_events (
            id BIGSERIAL PRIMARY KEY,
            company_id UUID NOT NULL,
            source TEXT NOT NULL CHECK (source IN ('panel', 'chat')),
            outcome TEXT NOT NULL CHECK (outcome IN ('strict', 'tolerant', 'refused', 'contact_support')),
            fields TEXT CHECK (fields IN ('product_only', 'batch_only', 'both')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_coa_lookup_events_company_created "
        "ON coa_lookup_events (company_id, created_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_coa_lookup_events_company_created")
    op.execute("DROP TABLE IF EXISTS coa_lookup_events")
