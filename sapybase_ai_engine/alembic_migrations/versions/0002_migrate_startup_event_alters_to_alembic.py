"""Migrate the four self-healing ALTER TABLE calls out of startup_event into Alembic.

Revision ID: 0002
Revises: 0001
Created: 2026-04-26 (Step 4.5 of production-readiness plan).

== Why this migration exists ==

main.py's startup_event used to run four ALTER TABLE IF NOT EXISTS calls
on every boot:

    ALTER TABLE companies ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100)
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS webhook_url TEXT
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS handoff_redirect_url TEXT
    ALTER TABLE users     ADD COLUMN IF NOT EXISTS last_polar_event_at TIMESTAMPTZ

This pattern worked but left schema management split between two systems.
Now that Alembic exists (revision 0001), the self-healing block is being
removed from main.py and the column adds become this migration.

== IF NOT EXISTS is intentional ==

In production, all four columns ALREADY exist (added by the self-healing
block on previous boots). On a fresh database, none exist. Using
`IF NOT EXISTS` makes upgrade() idempotent in both cases:
    - prod: no-op
    - fresh DB: creates all four

Without the guard, running `alembic upgrade head` against prod would fail
on the first ADD COLUMN saying the column already exists.

== Downgrade is real but lossy ==

downgrade() drops all four columns. This is destructive — `last_polar_event_at`
in particular tracks Polar webhook ordering and losing it would re-open
the out-of-order race we closed in Step 2.2. Only run downgrade in dev.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0002'
down_revision: Union[str, Sequence[str], None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the four columns previously managed by startup_event.

    Idempotent on production (where they already exist) and correct on a
    fresh DB.
    """
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100)")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS webhook_url TEXT")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS handoff_redirect_url TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_polar_event_at TIMESTAMPTZ")


def downgrade() -> None:
    """Drop the four columns. DESTRUCTIVE — loses webhook ordering state."""
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_polar_event_at")
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS handoff_redirect_url")
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS webhook_url")
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS ai_model")
