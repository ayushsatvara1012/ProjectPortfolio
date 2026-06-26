"""Chemical vertical — Phase 4b form: agent_requests.form_data JSONB.

Revision ID: 0024
Revises: 0023
Created: 2026-06-25 (Chemical Vertical AI Agent plan — Phase 4b form, §10).

The sample request became a structured FORM whose fields are CONFIG (customizable
per client in the customise section, to mirror their existing Google Form). The
typed columns (product_name/grade/quantity/contact_*) power the dashboard panel,
but they can't hold an arbitrary, client-defined field set — so we add a
``form_data`` JSONB column carrying the FULL submission verbatim. That's what the
outbound spreadsheet webhook ships, so the client's sheet columns line up exactly
with their form, no matter how they customise it.

Additive + idempotent (ADD COLUMN IF NOT EXISTS), dark (only a chemical company's
form submit ever writes it), and a safe no-op when it later runs via Alembic.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0024'
down_revision: Union[str, Sequence[str], None] = '0023'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE agent_requests ADD COLUMN IF NOT EXISTS form_data JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE agent_requests DROP COLUMN IF EXISTS form_data")
