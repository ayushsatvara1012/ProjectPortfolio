"""Contextual teaser (Phase 1): companies.teaser_config + teaser_events table.

Revision ID: 0033
Revises: 0032
Created: 2026-07-11 (Contextual teaser plan — Phase 1 static teaser).

teaser_config JSONB on companies holds the owner-authored teaser bubble copy:
``{"enabled": bool, "title": str, "subtext": str, "delay_ms": int}``.
NULL = all defaults (enabled, "Hi, I'm {botName}" copy, 5s delay). Phase 2
adds a ``rules`` array to the same column — no further schema change needed.

teaser_events is the analytics sink (decided during Phase 1 — no generic
widget-event pipeline exists): one row per impression / dismiss / click so
the owner dashboard can later show whether the teaser converts and which
rule fired. No PII — company_id + event + optional rule_id only.

Additive + idempotent (IF NOT EXISTS everywhere). Safe no-op + stamp when it
later runs via Alembic on deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0033'
down_revision: Union[str, Sequence[str], None] = '0032'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS teaser_config JSONB")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS teaser_events (
            id BIGSERIAL PRIMARY KEY,
            company_id UUID NOT NULL,
            event TEXT NOT NULL CHECK (event IN ('impression', 'dismiss', 'click')),
            rule_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_teaser_events_company_created "
        "ON teaser_events (company_id, created_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_teaser_events_company_created")
    op.execute("DROP TABLE IF EXISTS teaser_events")
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS teaser_config")
