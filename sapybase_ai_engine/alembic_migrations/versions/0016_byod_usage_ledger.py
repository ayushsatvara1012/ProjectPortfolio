"""Create byod_usage_ledger — BYOD idempotent-metering outbox/dedup ledger.

Revision ID: 0016
Revises: 0015
Created: 2026-06-15 (RFC docs/rfc-byod.md Phase 3.3 — §16.1 / rules E1, E2).

One row per *metered* BYOD message, keyed by ``(company_id, idempotency_key)``.
This is the control-plane dedup ledger (outbox) that makes usage metering
idempotent: a message is metered only after its tenant-DB ``chat_log`` store is
confirmed, and a retry with the same key conflicts here and increments nothing.
The reconciler diffs this against the tenant's confirmed ``chat_logs`` ids to
repair any counter lagging a confirmed store (§16.1).

The exact DDL is the single source of truth in
``byod_metering.LEDGER_SCHEMA_SQL``, imported here so the migrated table and the
metering/test code can never drift. Additive + idempotent (CREATE TABLE/INDEX IF
NOT EXISTS), so re-running is safe. Dark by default: nothing meters through the
ledger until the Phase-3.2/3.3 engine cutover routes a canary tenant.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401

from byod_metering import LEDGER_SCHEMA_SQL, LEDGER_SCHEMA_DROP_SQL


revision: str = '0016'
down_revision: Union[str, Sequence[str], None] = '0015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(LEDGER_SCHEMA_SQL)


def downgrade() -> None:
    op.execute(LEDGER_SCHEMA_DROP_SQL)
