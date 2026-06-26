"""Chemical vertical — Phase 5 customise: companies.pack_overrides JSONB.

Revision ID: 0025
Revises: 0024
Created: 2026-06-25 (Chemical Vertical AI Agent plan — Phase 5 customise UI, §10).

A vertical pack ships sensible DEFAULTS (sample-form fields, hub cards, the sheet
sink) in code (``packs/chemical.py``). But every client's sample form differs — one
factory needs "application", another "delivery site" — and each client's data lands
in THEIR own Google Sheet. So an owner needs to override the pack per-bot from the
customise tab.

This column holds only that owner's DELTAS as JSON: e.g.
``{"sample_form": [...fields...], "sample_sink": {"url": "...", "secret": "..."}}``.
The engine merges ``pack_defaults | company_overrides`` at runtime — the pack file
stays the source of defaults, so we do NOT promote the whole pack to a table yet
(that's Phase 6). NULL = no overrides = pure pack defaults (every bot today).

Additive + idempotent (ADD COLUMN IF NOT EXISTS), dark (only a chemical bot whose
owner customises ever writes it), and a safe no-op when it later runs via Alembic.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0025'
down_revision: Union[str, Sequence[str], None] = '0024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS pack_overrides JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE companies DROP COLUMN IF EXISTS pack_overrides")
