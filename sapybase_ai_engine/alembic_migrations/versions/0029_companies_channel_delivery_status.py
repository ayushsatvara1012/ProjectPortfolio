"""Chemical vertical — Phase 3.4 (hardening): companies.channel_delivery_status JSONB.

Revision ID: 0029
Revises: 0028
Created: 2026-07-04 (Chemical-agent hardening plan — Phase 3.4 sink onboarding).

An owner who wires a spreadsheet sink (Google Apps Script / Zapier / Power Automate)
has no way to tell whether it actually works — a bad deploy fails silently. The
"Send test row" button records the outcome here so the settings UI can show a
green/red status per channel instead of leaving the owner guessing.

Shape (per channel key — 'sink' today; 'slack'/'email' later):
``{"sink": {"ok": true, "detail": "2xx", "at": "2026-07-04T..."}}``. NULL / '{}' =
never tested. Generic JSONB so new channels need no further migration.

Additive + idempotent (ADD COLUMN IF NOT EXISTS), dark (only written when an owner
clicks "Send test row"), and a safe no-op when it later runs via Alembic.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0029'
down_revision: Union[str, Sequence[str], None] = '0028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS channel_delivery_status JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS channel_delivery_status")
