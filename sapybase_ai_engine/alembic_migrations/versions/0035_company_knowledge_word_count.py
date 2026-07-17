"""company_knowledge.word_count: real word-count storage unit.

Revision ID: 0035
Revises: 0034
Created: 2026-07-16 (Word-based storage limit plan).

The knowledge-base plan limit moves from a raw RAG chunk count (an ingestion
mechanics detail, ~300 chars/chunk) to a real word count. This column stores
the word count of each ``company_knowledge`` row (``len(content.split())``),
computed at ingest time going forward. Existing rows are backfilled here,
in-DB, via a Postgres word-count expression — a one-shot, idempotent UPDATE,
not an app-level script.

``chunk_type='child'/'parent'`` stays the internal RAG storage grain
(untouched); ``word_count`` is the quota metric layered on top, summed over
child rows by the enforcement code in main.py.

Additive + idempotent (ADD COLUMN IF NOT EXISTS, backfill gated on IS NULL).
Safe no-op + stamp when it later runs via Alembic on deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0035'
down_revision: Union[str, Sequence[str], None] = '0034'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE company_knowledge ADD COLUMN IF NOT EXISTS word_count INTEGER")
    op.execute(
        "UPDATE company_knowledge "
        "SET word_count = GREATEST(1, array_length(regexp_split_to_array(trim(content), '\\s+'), 1)) "
        "WHERE word_count IS NULL AND content IS NOT NULL AND trim(content) <> ''"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE company_knowledge DROP COLUMN IF EXISTS word_count")
