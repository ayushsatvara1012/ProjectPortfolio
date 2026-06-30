"""Intelligent agent memory — per-visitor session scoping (visitor_id).

Revision ID: 0027
Revises: 0026
Created: 2026-06-30 (Intelligent Agent Memory plan — Phase 1d).

Adds a device-local `visitor_id` to agent_sessions so the widget history screen
lists only the sessions belonging to THIS visitor, never the whole company.

Without it, GET /api/sessions would return the company's most-recent sessions
across ALL visitors — leaking one buyer's conversation titles and message
previews to the next. The visitor_id is an opaque UUID minted in the visitor's
browser localStorage (keyed by api_key); it carries no PII and is the seam
Phase 2 will later link to a captured email for cross-device identity.

Indexes:
  - agent_sessions(company_id, visitor_id, last_active_at DESC) — history-list
    query is now scoped (company_id, visitor_id).

Additive + idempotent (ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS).
Safe dark rollout: legacy rows keep visitor_id = NULL and simply never appear in
any visitor's history list (they remain readable by direct session_id, and stay
intact for the ROI panel / BI scans).
"""
from typing import Sequence, Union

from alembic import op


revision: str = '0027'
down_revision: Union[str, Sequence[str], None] = '0026'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE agent_sessions
            ADD COLUMN IF NOT EXISTS visitor_id TEXT
    """)

    # History-list query is scoped (company_id, visitor_id) and ordered by recency.
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_sessions_company_visitor_active
            ON agent_sessions (company_id, visitor_id, last_active_at DESC)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_agent_sessions_company_visitor_active")
    op.execute("ALTER TABLE agent_sessions DROP COLUMN IF EXISTS visitor_id")
