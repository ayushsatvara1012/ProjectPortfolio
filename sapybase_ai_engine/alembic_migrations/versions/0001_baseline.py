"""baseline — stamp the current production schema as revision 0001.

Created: 2026-04-26 (Step 4.4 of production-readiness plan).

This migration is INTENTIONALLY EMPTY. It does not create or alter any
schema. It exists solely to give Alembic a starting point so that all
FUTURE schema changes are tracked through Alembic from this point forward.

== How we got here ==

Before Alembic, schema changes were applied via:
  1. Hand-written SQL files in sapybase_ai_engine/migrations/v8-v22.sql,
     applied manually via psql against the production database.
  2. Self-healing ALTER TABLE IF NOT EXISTS calls in main.py's
     startup_event for recent additive columns (ai_model, webhook_url,
     handoff_redirect_url, last_polar_event_at).

There was no `alembic_version` table, so the database had no recorded
notion of "what migration version am I on." This baseline fixes that
without re-running any of the historical SQL.

== What is assumed to exist ==

The schema audit at migrations/SCHEMA_AUDIT_2026-04-26.md is the source
of truth for what existed in production at the moment this baseline was
stamped. Key tables, all assumed present:

    - users (with last_polar_event_at column added by self-healing block)
    - companies (with ai_model, webhook_url, handoff_redirect_url, hide_branding)
    - company_knowledge (with parent_id + chunk_type for parent-child chunking)
    - usage_tracking (with company_id for per-bot tracking)
    - exact_query_cache
    - admin_audit_log
    - processed_webhooks (used for both Clerk and Polar webhook idempotency)
    - chat_logs, lead_capture, insight_reports, roi_benchmarks (analytics)
    - allowed_domains (legacy, predates multi-bot — TODO: investigate if dead)

Extensions: vector (pgvector v0.8), uuid-ossp, pgcrypto, plus Supabase's
pg_graphql / pg_stat_statements / supabase_vault.

The audit also flagged that the v22_eval_pipeline.sql file defines an
`eval_runs` table that is NOT present in production. The eval feature is
internal-only; if it's ever needed, ship a separate migration to create it.

== Why upgrade() and downgrade() are empty ==

`upgrade()` is empty because production already has all of the above. We
stamp the database as already at this revision via `alembic stamp head`
without running anything — see Step 4.4 of the runbook.

`downgrade()` is empty because there is nothing to undo. A genuine "drop
the entire schema" downgrade would be destructive and pointless; if you
need a clean DB, restore from a Postgres backup instead.

== Going forward ==

Every new schema change MUST ship as a new revision file in this directory.
Run `alembic revision -m "short description"` to create one. The
self-healing ALTER TABLE block in main.py's startup_event is being
removed in revision 0002 — Alembic owns schema from this point on.
"""
from typing import Sequence, Union

from alembic import op  # noqa: F401  (kept for future revisions copy-pasting from this template)
import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Baseline — no-op. Production schema is assumed to already match.

    See module docstring for rationale.
    """
    pass


def downgrade() -> None:
    """No-op. There is nothing meaningful to downgrade past the baseline.

    Restore from a Postgres backup if you need a pre-migration state.
    """
    pass
