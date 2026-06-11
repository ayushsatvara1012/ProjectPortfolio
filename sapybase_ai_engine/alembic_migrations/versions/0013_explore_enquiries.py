"""Create explore_enquiries — Explore plan signup enquiry queue.

Revision ID: 0013
Revises: 0012
Created: 2026-06-10 (Explore plan §3 — personal-email applicants request access).

Business emails get an instant $0 Explore subscription (no row here). Personal/
free emails (gmail.com, etc.) cannot self-serve — they submit an enquiry that a
super-admin manually approves before access is granted. Disposable/invalid
emails are rejected at the endpoint and never persisted.

status lifecycle:  pending → approved | rejected

This supersedes the historical-reference migrations/v24_explore_enquiries.sql
(which is not applied directly — Alembic is the source of truth). Fully
additive and idempotent (CREATE TABLE/INDEX IF NOT EXISTS), so it is safe to
run against a DB where the table was already created by hand.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


revision: str = '0013'
down_revision: Union[str, Sequence[str], None] = '0012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS explore_enquiries (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email         TEXT NOT NULL,
            name          TEXT,
            company_name  TEXT,
            use_case      TEXT,
            email_class   TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'pending',
            source_ip     INET,
            user_agent    TEXT,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            reviewed_at   TIMESTAMPTZ,
            reviewed_by   TEXT,
            review_note   TEXT
        )
        """
    )
    # Admin queue: list pending enquiries newest-first.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_explore_enquiries_status "
        "ON explore_enquiries (status, created_at DESC)"
    )
    # One *pending* enquiry per email — re-submits while under review are deduped.
    # Approved/rejected rows are kept for history and don't block this.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_explore_enquiries_pending_email "
        "ON explore_enquiries (lower(email)) WHERE status = 'pending'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_explore_enquiries_pending_email")
    op.execute("DROP INDEX IF EXISTS idx_explore_enquiries_status")
    op.execute("DROP TABLE IF EXISTS explore_enquiries")
