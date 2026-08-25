"""company_knowledge.context: structure that labels a chunk without being billed.

Revision ID: 0039
Revises: 0038
Created: 2026-08-25 (entity-safe-ingestion plan Phase 2 / Q1).

A chunk cut out of a table or a long list is unreadable on its own: a row
without its header is an unlabelled tuple, and "35. Sodium metabisulphite"
says nothing about what it is a list of. The fix is to repeat the enclosing
heading, the table's header row, or the line introducing a list onto every
part - but the tenant wrote that structure once and must not be billed once
per chunk for it (plan Q1).

So it lives beside the content rather than inside it. ``content`` stays
exactly what was on the page and is what ``word_count`` bills; ``context``
carries the structural labels; the two are concatenated at retrieval and at
embedding time. Stored vector and billed text therefore differ deliberately.

No backfill. Existing rows were chunked by the character splitter and have no
structure to recover; NULL means "no context", which the retrieval path
already reads as the pre-migration behaviour. Sources get a context only when
re-ingested.

Additive + idempotent (ADD COLUMN IF NOT EXISTS). Safe no-op + stamp when it
later runs via Alembic on deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0039'
down_revision: Union[str, Sequence[str], None] = '0038'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE company_knowledge ADD COLUMN IF NOT EXISTS context TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE company_knowledge DROP COLUMN IF EXISTS context")
