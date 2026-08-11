"""chat_logs.turn_state: the turn's actual outcome, stored (audit D3/D4).

Revision ID: 0037
Revises: 0036
Created: 2026-08-11 (agent-runtime-restructure plan, Phase 5).

  turn_state  TEXT  — one of the six §1.2 outcomes: answered / partial /
                      need_one_thing / no_data / out_of_scope / system_error.
                      NULL on every row logged before this migration.

Why a new column rather than only fixing the old ones. `is_unanswered` was
`len(retrieved_docs) == 0 OR one of three English substrings`, which is inverted
for the traffic that matters most: a correct tool-sourced price retrieves no
documents and logged as unanswered, while a confident fabrication over good
retrieval logged as answered and confident. `/api/fixes-needed`, the conversations
unanswered filter, the weekly digest and the session BI panel all read those two
columns, so silently changing what they mean is how an owner's dashboard starts
lying in a new direction instead of the old one. The audit's own instruction was
to version the metric; this column is that version.

`is_unanswered` and `confidence` keep being written - now derived from this same
outcome, so they are correct rather than inverted - and the dashboards can migrate
onto `turn_state` deliberately, one surface at a time.

Control-plane only, matching 0031 (token metering), 0034 (feedback) and 0036
(sources): BYOD tenant chat_logs do not carry this column, and `tenant_log_chat`
accepts the argument for signature parity without persisting it. Verified when
0036 shipped that no chemical-vertical traffic is BYOD-routed.

Additive + idempotent (ADD COLUMN IF NOT EXISTS), no backfill - existing rows stay
NULL, the honest "not recorded" state. Safe no-op + stamp when it later runs via
Alembic on deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0037'
down_revision: Union[str, Sequence[str], None] = '0036'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS turn_state TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE chat_logs DROP COLUMN IF EXISTS turn_state")
