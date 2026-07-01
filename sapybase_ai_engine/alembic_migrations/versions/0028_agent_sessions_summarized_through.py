"""Intelligent agent memory — rolling summary progress tracking.

Revision ID: 0028
Revises: 0027
Created: 2026-06-30 (Intelligent Agent Memory plan — Phase 1b fix).

Phase 1b's summary was a one-shot snapshot: `maybe_summarize_session` skipped
regeneration once `summary` was non-null, so long-running conversations lost
the turns that aged out of the verbatim window AFTER the first summarization.
`summarized_through` tracks how many messages are already folded into
`summary`, so the summarizer can fold in only the newly-aged-out slice on
each pass (bounded token cost) and keep the summary genuinely rolling.

Additive + idempotent (ADD COLUMN IF NOT EXISTS). Safe dark rollout: existing
rows default to 0, so their next summarization pass re-summarizes from the
start once — a one-time correction, not a behavior change for new sessions.
"""
from typing import Sequence, Union

from alembic import op


revision: str = '0028'
down_revision: Union[str, Sequence[str], None] = '0027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE agent_sessions
            ADD COLUMN IF NOT EXISTS summarized_through INTEGER NOT NULL DEFAULT 0
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE agent_sessions DROP COLUMN IF EXISTS summarized_through")
