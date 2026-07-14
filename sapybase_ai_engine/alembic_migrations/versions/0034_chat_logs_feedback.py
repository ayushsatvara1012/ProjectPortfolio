"""Vertical intelligence: chat_logs.client_message_id + feedback (thumbs up/down).

Revision ID: 0034
Revises: 0033
Created: 2026-07-14 (Vertical intelligence + chemical data-precision plan — Phase 2a).

Introduces the first explicit visitor feedback signal (today the bot only has
implicit signals: ``is_unanswered`` and ``confidence``). ``log_chat_to_db``
(main.py) is a fire-and-forget ``BackgroundTasks`` insert — the HTTP response
never gets the inserted row's ``id`` back, by design, so chat latency isn't
blocked on the log write — so a message needs a client-generated id to be
addressable for feedback after the fact.

  client_message_id  UUID     — widget-generated id for the bot's reply this
                                 row logs. NULL on legacy rows and any caller
                                 that doesn't send one (feedback simply can't
                                 attach to those turns).
  feedback            SMALLINT — 1 (thumbs up) / -1 (thumbs down). NULL = no
                                 feedback given. Idempotent to set (a visitor
                                 can change their mind), enforced by the CHECK.

Control-plane only for now, matching the precedent set by 0031 (token
metering): BYOD tenant chat_logs (``byod_dataplane.DATA_PLANE_SCHEMA_SQL``)
does not carry this column yet — the feedback endpoint degrades soft for
BYOD-routed companies rather than growing the data-plane lineage here.

Additive + idempotent (ADD COLUMN IF NOT EXISTS). Safe no-op + stamp when it
later runs via Alembic on deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0034'
down_revision: Union[str, Sequence[str], None] = '0033'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS client_message_id UUID")
    op.execute(
        "ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS feedback SMALLINT "
        "CHECK (feedback IN (1, -1))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_logs_client_message_id "
        "ON chat_logs (company_id, client_message_id) WHERE client_message_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_chat_logs_client_message_id")
    op.execute("ALTER TABLE chat_logs DROP COLUMN IF EXISTS feedback")
    op.execute("ALTER TABLE chat_logs DROP COLUMN IF EXISTS client_message_id")
