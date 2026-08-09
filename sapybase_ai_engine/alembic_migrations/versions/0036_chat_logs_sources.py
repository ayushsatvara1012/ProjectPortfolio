"""chat_logs.sources: owner-facing source attribution (Slice D).

Revision ID: 0036
Revises: 0035
Created: 2026-08-08 (agent-conversation-gaps plan, Slice D, §12.3).

The owner asked directly: the dashboard conversation history should show which
source each answer came from, so a wrong answer can be audited without reading
raw transcripts with us. This column is the storage half of that.

  sources  JSONB  — an ordered list of the sources that produced this turn's
                    reply, or NULL on any row logged before this migration
                    (rendered "not recorded", never confused with a genuinely
                    empty list — see below). Shape, per entry:

                      {"kind": "kb", "label": <url>, "content_id": <uuid>,
                       "rank": <int>, "score": <float 0-10 or null>}
                      {"kind": "tool", "label": <tool name>,
                       "detail": <short human string>, "url": <str or null>}

                    A cache-hit turn performed no retrieval at all and logs an
                    explicit `[]`, distinct from NULL — the dashboard renders
                    that as "served from cache" (via the existing
                    `was_cache_hit` column), never as "no source found".

Pointer, not excerpt: only labels/ids/scores are stored, never chunk text —
the panel fetches a chunk's content on demand, tenant-scoped, at view time.
This is also why the column adds no new PII surface and needs no GDPR
deletion-path change: it inherits chat_logs retention automatically.

Control-plane only for now, matching the precedent set by 0031 (token
metering) and 0034 (feedback): BYOD tenant chat_logs
(``byod_dataplane.DATA_PLANE_SCHEMA_SQL``) does not carry this column yet —
``tenant_log_chat`` accepts a ``sources`` argument for signature parity with
``log_chat_to_db`` but does not persist it, so a BYOD-routed company's rows
render "not recorded" until a dedicated data-plane schema version adds this
column and a rolling per-tenant migration backfills it (out of scope here;
verified against the live registry that no chemical-vertical / Expresolv
traffic is BYOD-routed today, so this gap does not affect the transcripts
motivating this plan).

Additive + idempotent (ADD COLUMN IF NOT EXISTS), no default backfill — every
existing row stays NULL, which is the honest "not recorded" state. Safe no-op
+ stamp when it later runs via Alembic on deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0036'
down_revision: Union[str, Sequence[str], None] = '0035'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS sources JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE chat_logs DROP COLUMN IF EXISTS sources")
