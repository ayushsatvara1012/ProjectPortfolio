"""Intelligent agent memory — agent_sessions + agent_messages tables.

Revision ID: 0026
Revises: 0025
Created: 2026-06-30 (Intelligent Agent Memory plan — Phase 1a).

Persistent session memory for the vertical AI agent. Replaces the stateless
4-message cache window: every turn is now stored server-side, enabling hybrid
context (last ~8 turns verbatim + rolling summary for older turns).

Tables live in the control DB (same lineage as migrations 0001–0025). Every
row is company_id-scoped; no cross-tenant reads are possible. The `session_id`
column is the widget's existing session_id (already passed, previously unused).

Indexes:
  - agent_sessions(company_id, last_active_at DESC) — history-list query
  - agent_messages(session_id, ts)                  — ordered message load
  - agent_messages(company_id)                      — tenant purge / BI scans

Additive + idempotent (CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS).
Safe dark rollout: nothing reads these tables until Phase 1b write path is live.
"""
from typing import Sequence, Union

from alembic import op


revision: str = '0026'
down_revision: Union[str, Sequence[str], None] = '0025'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_sessions (
            session_id      TEXT        PRIMARY KEY,
            company_id      TEXT        NOT NULL,
            title           TEXT,
            summary         TEXT,
            lead_profile    JSONB,
            state           JSONB,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_messages (
            id              BIGSERIAL   PRIMARY KEY,
            session_id      TEXT        NOT NULL
                                REFERENCES agent_sessions (session_id)
                                ON DELETE CASCADE,
            company_id      TEXT        NOT NULL,
            role            TEXT        NOT NULL,
            content         TEXT,
            tool_calls      JSONB,
            observations    JSONB,
            actions         JSONB,
            ts              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # History-list query: list sessions for a company ordered by recency.
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_sessions_company_active
            ON agent_sessions (company_id, last_active_at DESC)
    """)

    # Message load: fetch all messages for a session in order.
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_messages_session_ts
            ON agent_messages (session_id, ts)
    """)

    # Tenant-scoped purge / BI scans on messages directly.
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_messages_company
            ON agent_messages (company_id)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS agent_messages")
    op.execute("DROP TABLE IF EXISTS agent_sessions")
