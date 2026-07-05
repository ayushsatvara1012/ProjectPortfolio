"""Chemical vertical — Phase 6 (cost caching): prompt cache-read visibility.

Revision ID: 0032
Revises: 0031
Created: 2026-07-05 (Chemical-agent hardening plan — Phase 6, Slice B).

Explicit Gemini context caching (Phase 6 item 1) turned out not to be viable at
our prompt size: Gemini requires a 32,768-token minimum to create an explicit
cache, and our static system-prompt prefix (platform rules + agent directive +
tool schemas) measures ~2,300 tokens — far below that floor. Padding the prefix
just to qualify would cost more tokens than it saves.

Gemini 2.x models, however, apply IMPLICIT caching automatically (min ~1,024
tokens, which our prefix already clears) with no code changes on our side. The
Gemini API already returns a per-call "cache_read" token count in
``usage_metadata.input_token_details`` whenever a cached prefix is reused — we
were just never capturing it. This migration adds the column to record it, so
the BI panel can show whether implicit caching is already delivering savings
before we build anything further.

  cached_tokens INTEGER — prompt tokens billed at the Gemini cache-read discount
                for this turn (summed across tool-loop rounds). NULL on legacy
                rows, non-cache-hit turns report 0, and paths that don't surface
                usage (app-level cache hits, generic bot) stay NULL.

Additive + idempotent (ADD COLUMN IF NOT EXISTS). Safe no-op + stamp when it
later runs via Alembic on deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0032'
down_revision: Union[str, Sequence[str], None] = '0031'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS cached_tokens INTEGER")


def downgrade() -> None:
    op.execute("ALTER TABLE chat_logs DROP COLUMN IF EXISTS cached_tokens")
