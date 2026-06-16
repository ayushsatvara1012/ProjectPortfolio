"""data_plane baseline — lay down the BYOD tenant (data-plane) schema.

Revision ID: 0001  (== byod_dataplane.DATA_PLANE_SCHEMA_VERSION)
Revises: None (root of the independent data_plane lineage)
Created: 2026-06-15 (RFC docs/rfc-byod.md Phase 3.1 — A.7 Alembic lineage split).

This is the root of the **data_plane** Alembic lineage, which runs on each
client's BYO Postgres — NOT on Sapybase's control-plane DB (that is the separate
``control_plane`` lineage in ``alembic_migrations/``). The two lineages target
two physically different databases and never share a revision tree or an
``alembic_version`` table.

Unlike the control-plane ``0001`` baseline (which is empty, because production
pre-existed Alembic), this baseline is a *real* create: a tenant DB starts clean,
so we lay down the full data-plane schema here. The DDL is imported wholesale
from :data:`byod_dataplane.DATA_PLANE_SCHEMA_SQL` — the single source of truth
the engine's provisioning path and the Phase-0 test harness also use — so the
formal lineage and the directly-provisioned schema can never drift.

The revision id is sourced from :data:`byod_dataplane.DATA_PLANE_SCHEMA_VERSION`
so the Alembic head and the value recorded in the control-plane schema_version
registry (§8.1) are guaranteed to agree.

Idempotent by construction: the DDL is all ``CREATE ... IF NOT EXISTS`` (rule 11,
expand-only). This matters because a tenant DB provisioned directly via
``byod_dataplane.provision_tenant_database`` (Phase 2.3) has the schema but no
``alembic_version`` row; running ``alembic upgrade head`` against it then
reconciles cleanly — the baseline upgrade is a no-op and only stamps the version.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401

from byod_dataplane import (
    DATA_PLANE_SCHEMA_DROP_SQL,
    DATA_PLANE_SCHEMA_SQL,
    DATA_PLANE_SCHEMA_VERSION,
)


# revision identifiers, used by Alembic. Sourced from the authoritative version
# constant so the lineage head and the registry version cannot drift.
revision: str = DATA_PLANE_SCHEMA_VERSION
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = ("data_plane",)
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(DATA_PLANE_SCHEMA_SQL)


def downgrade() -> None:
    op.execute(DATA_PLANE_SCHEMA_DROP_SQL)
