"""Chemical vertical — Phase 6 (cost caching): chat_logs token metering.

Revision ID: 0031
Revises: 0030
Created: 2026-07-05 (Chemical-agent hardening plan — Phase 6, Slice A metering).

Before optimizing token cost we must measure it. Each chat turn already logs one
``chat_logs`` row (with ``was_cache_hit``); this adds the per-turn Gemini token
counts so the vertical BI endpoint can show cost-per-conversation trending and we
can decide which cache tier (context cache vs answer cache) is worth building.

  input_tokens   INTEGER — prompt tokens the model billed for this turn (summed
                 across the agent's tool-loop rounds). NULL on legacy rows and on
                 paths that don't surface usage (cache hits, generic bot for now).
  output_tokens  INTEGER — completion tokens generated this turn. Same NULL rules.

Additive + idempotent (ADD COLUMN IF NOT EXISTS). Safe no-op + stamp when it later
runs via Alembic on deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0031'
down_revision: Union[str, Sequence[str], None] = '0030'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS input_tokens INTEGER")
    op.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS output_tokens INTEGER")


def downgrade() -> None:
    op.execute("ALTER TABLE chat_logs DROP COLUMN IF EXISTS output_tokens")
    op.execute("ALTER TABLE chat_logs DROP COLUMN IF EXISTS input_tokens")
