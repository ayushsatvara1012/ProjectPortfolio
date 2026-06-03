"""Add confidence (groundedness) score to chat_logs.

Revision ID: 0004
Revises: 0003
Created: 2026-06-02 (Track 3 item 10 — per-answer groundedness signal).

== What this migration does ==

Adds a nullable `confidence REAL` column to `chat_logs`. It stores a 0.0–1.0
groundedness score for each answered chat, derived (with NO extra LLM call) from
the reranker's relevance score for the best supporting chunk:

  * 0.0       -> bot fell back / had no relevant knowledge (not grounded)
  * 0.1–1.0   -> best supporting chunk's rerank score / 10
  * NULL      -> unknown (cache hit, or reranker skipped/failed)

This powers dashboard "answer quality" insights and feeds the fixes-needed loop.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0004'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS confidence REAL NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE chat_logs DROP COLUMN IF EXISTS confidence")
