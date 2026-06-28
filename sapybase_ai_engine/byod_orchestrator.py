"""BYOD data-plane migration orchestrator (RFC docs/rfc-byod.md Phase 6.2; §8.3,
A.8, rule 13, §10 "Migration runner crash").

When Sapybase ships a feature needing new tenant-side storage, the data-plane
schema must roll out to every BYOD tenant's own database — additively (§8.2,
expand->migrate->contract) and without a single broken request. This module is
the controlled rollout driver from A.8:

    list BYOD tenants where schema_version < target
    per tenant (bounded concurrency, skip open-breaker tenants):
        acquire a Postgres advisory lock ON THE TENANT DB
            (so two runners can't migrate the same DB at once)
        if reachable: apply pending data_plane migrations (additive, migrate role)
                      -> record the new schema_version on the control plane
        else:         leave it on the old version; it is retried next pass
        release the advisory lock

Hard guarantees (rule 13 / §10):
  * **Advisory-locked.** Each tenant DB is migrated under a Postgres advisory lock
    held on a dedicated migrate connection to *that* DB. A second concurrent runner
    fails ``pg_try_advisory_lock`` and records the tenant as *contended* (benign —
    the holder is migrating it; retry next pass), never double-applying.
  * **Idempotent.** The Alembic upgrade is a no-op when the tenant is already at
    head, and additive migrations are ``IF NOT EXISTS`` (rule 11). A tenant already
    at/above target is reported *current* without touching it.
  * **Version advances only on verified success.** The control-plane
    ``schema_version`` is recorded ONLY after the upgrade ran AND the tenant's
    Alembic head is re-read and confirmed to equal the target. A runner that
    crashes after upgrading but before recording recovers on the next pass: the
    upgrade no-ops, the head still verifies, and the version is recorded then.
  * **Failure isolation + retry.** An unreachable/erroring tenant raises out of its
    worker; the bounded-concurrency batch runner (``byod_jobs.run_tenant_batch``,
    E9/§16.4) isolates it as *failed*, keeps the rest of the fleet going, and the
    tenant simply stays on its old version until a later pass succeeds.

The control-plane accessors (list tenants, decrypt the migrate DSN, record the
version) are injected by the caller (main.py builds them over the control pool +
KMS), so this module does NOT import main.py and is unit-testable with fakes; the
per-tenant connect + Alembic upgrade are also injectable so the real machinery
(advisory lock + a real additive migration) can be exercised against throwaway
tenant Postgres DBs.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, List, Optional, Sequence, Tuple

import byod_jobs
from db import byod_schema

logger = logging.getLogger(__name__)

# Advisory-lock coordinates for the per-tenant migrate lock (rule 13). The lock is
# taken on the TENANT DB, so a single fixed (namespace, key) pair is enough — two
# runners contend only when they target the *same* physical database; different
# tenant DBs never share a lock space. Namespace 0x42594F44 == ASCII "BYOD"
# (matches the provisioning lock namespace in byod_admin); a distinct key keeps the
# migrate lock from ever aliasing another BYOD advisory lock on the same DB.
DATA_PLANE_LOCK_NAMESPACE = 0x42594F44
DATA_PLANE_MIGRATE_LOCK_KEY = 0x4D475254  # "MGRT" truncated to fit int4


# ── Per-tenant outcome / aggregate report ────────────────────────────────────────
class MigrationStatus:
    MIGRATED = "migrated"      # upgrade applied + verified at target; version recorded
    CURRENT = "current"        # already at/above target; no work, idempotent
    CONTENDED = "contended"    # another runner held the advisory lock; retry next pass
    SKIPPED = "skipped"        # skip predicate excluded it (open breaker); retry later
    FAILED = "failed"          # unreachable/erroring; stays on old version, retried


@dataclass(frozen=True)
class MigrationOutcome:
    company_id: Any
    status: str
    from_version: Optional[str] = None
    to_version: Optional[str] = None
    error: Optional[str] = None


@dataclass(frozen=True)
class MigrationReport:
    """Aggregate of a rollout pass. ``total`` ==
    migrated + current + contended + skipped + failed."""

    target: Optional[str]
    total: int
    migrated: int
    current: int
    contended: int
    skipped: int
    failed: int
    outcomes: List[MigrationOutcome] = field(default_factory=list)


class OrchestratorError(Exception):
    """A rollout-level error whose message is safe to log (no DSN/host)."""


class MigrationVerificationError(OrchestratorError):
    """The tenant's Alembic head did not reach the target after upgrade — the
    version is NOT recorded (rule 13: advance only on verified success)."""


# ── Alembic plumbing (production data_plane lineage) ─────────────────────────────
_ENGINE_ROOT = Path(__file__).resolve().parent
_DATAPLANE_INI = _ENGINE_ROOT / "alembic_dataplane.ini"


def _default_alembic_config():
    from alembic.config import Config  # lazy: alembic only needed on a real rollout

    return Config(str(_DATAPLANE_INI))


def data_plane_head(*, config: Optional[object] = None) -> Optional[str]:
    """The current head revision of the production data_plane Alembic lineage —
    the version the engine ships and rolls tenants up to. Reads the version scripts
    only (no DB, no env.py execution)."""
    from alembic.script import ScriptDirectory  # lazy

    cfg = config or _default_alembic_config()
    return ScriptDirectory.from_config(cfg).get_current_head()


def _default_upgrade(dsn: str) -> None:
    """Apply pending data_plane migrations to ``dsn`` (Alembic, migrate role).

    Runs with ``configure_logger=False`` because the rollout calls this
    concurrently across tenants and Alembic's default ``fileConfig`` logging setup
    mutates global state that is not thread-safe (see alembic_dataplane/env.py)."""
    from alembic import command  # lazy

    cfg = _default_alembic_config()
    cfg.set_main_option("sqlalchemy.url", dsn)
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")


def _default_connect(dsn: str):
    """Open an autocommit migrate connection to a tenant DB, re-validating the DSN
    on connect (rule 8: SSRF/DNS re-check every connect). Autocommit so the session
    advisory lock and the post-upgrade version read see committed state."""
    import psycopg2  # lazy

    from byod_dsn import validate_db_url

    validate_db_url(dsn)
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    return conn


# ── Per-tenant migration (advisory-locked, idempotent, verified) ─────────────────
def _read_head_version(cur) -> Optional[str]:
    """Read the tenant DB's Alembic head from ``alembic_version`` (None if the
    table doesn't exist yet — a tenant provisioned but never stamped)."""
    cur.execute("SELECT to_regclass('alembic_version')")
    if cur.fetchone()[0] is None:
        return None
    cur.execute("SELECT version_num FROM alembic_version")
    row = cur.fetchone()
    return row[0] if row else None


def migrate_tenant(
    migrate_dsn: str,
    *,
    target: str,
    connect: Callable[[str], Any] = _default_connect,
    upgrade: Callable[[str], None] = _default_upgrade,
    namespace: int = DATA_PLANE_LOCK_NAMESPACE,
    key: int = DATA_PLANE_MIGRATE_LOCK_KEY,
) -> Tuple[str, Optional[str], Optional[str]]:
    """Migrate ONE tenant DB to ``target`` under a Postgres advisory lock.

    Returns ``(status, from_version, to_version)`` where status is one of
    ``MIGRATED`` / ``CURRENT`` / ``CONTENDED``. Raises on an unreachable tenant
    (connect failure) or a verification failure — the caller's batch runner
    isolates that as a failed tenant; the version is NOT recorded.

    The lock is held on this dedicated connection only across the upgrade + verify,
    then released; the Alembic upgrade opens its own connection to the same DB
    (advisory locks gate only other advisory-lock callers, never DDL/DML)."""
    conn = connect(migrate_dsn)
    got = False
    try:
        cur = conn.cursor()
        try:
            cur.execute("SELECT pg_try_advisory_lock(%s, %s)", (namespace, key))
            got = bool(cur.fetchone()[0])
            from_version = _read_head_version(cur)
            if not got:
                # Another runner holds the lock and is migrating this DB. Benign:
                # don't touch it, don't record — it advances under the holder.
                return (MigrationStatus.CONTENDED, from_version, None)
            if byod_schema.version_meets(from_version, target):
                # Already at/above target — idempotent no-op, but a verified one.
                return (MigrationStatus.CURRENT, from_version, from_version)
            upgrade(migrate_dsn)
            applied = _read_head_version(cur)
            if not byod_schema.version_meets(applied, target):
                # Upgrade ran but the head did not reach target — do NOT record.
                raise MigrationVerificationError(
                    f"data-plane migration did not reach target {target!r} "
                    f"(head is {applied!r})"
                )
            return (MigrationStatus.MIGRATED, from_version, applied)
        finally:
            if got:
                cur.execute("SELECT pg_advisory_unlock(%s, %s)", (namespace, key))
            cur.close()
    finally:
        conn.close()


# ── Fleet rollout ────────────────────────────────────────────────────────────────
def run_migration_rollout(
    *,
    list_tenants: Callable[[], Sequence[Tuple[Any, Optional[str]]]],
    resolve_migrate_dsn: Callable[[Any], Optional[str]],
    record_version: Callable[[Any, str], None],
    target: Optional[str] = None,
    migrate: Optional[Callable[[Any, str], Tuple[str, Optional[str], Optional[str]]]] = None,
    max_concurrency: int = 1,
    skip: Optional[Callable[[Any], bool]] = None,
    sanitize: Optional[Callable[[BaseException], str]] = None,
) -> MigrationReport:
    """Roll the data-plane schema across the BYOD fleet to ``target`` (A.8).

    Injected control-plane seams (so this never imports main.py):
      * ``list_tenants()`` -> ``[(company_id, current_schema_version), ...]``.
      * ``resolve_migrate_dsn(company_id)`` -> the decrypted **migrate** (DDL-capable)
        DSN, or None if the credential is missing (treated as a failure).
      * ``record_version(company_id, version)`` -> persist the new schema_version on
        the control plane (caller commits). Called ONLY on verified success.

    Tenants already at/above ``target`` are reported ``current`` without connecting.
    The rest run through ``byod_jobs.run_tenant_batch`` for open-breaker skipping
    (``skip``) and per-tenant failure isolation (E9/§16.4).

    ``max_concurrency`` defaults to **1** because the default Alembic ``migrate``
    applies migrations through Alembic's process-global ``op``/``context`` proxies,
    which are NOT safe to run concurrently in-process (concurrent ``command.upgrade``
    calls corrupt each other's migration context). A rollout is an infrequent ops
    job, so serial apply is correct; each tenant is still bounded by its connect /
    statement timeouts and isolated on failure, so one slow/broken DB doesn't wedge
    the rest. (A future subprocess- or asyncpg-based ``migrate`` could safely raise
    this.) ``target`` defaults to the production data_plane Alembic head; ``migrate``
    defaults to :func:`migrate_tenant` (overridable to drive a fixture lineage)."""
    target = target or data_plane_head()
    if not target:
        raise OrchestratorError("no data-plane migration target resolved")
    if sanitize is None:
        from byod_engine import sanitize_db_error

        sanitize = sanitize_db_error
    if migrate is None:
        def migrate(company_id, dsn):  # noqa: ARG001 — company_id kept for symmetry
            return migrate_tenant(dsn, target=target)

    tenants = list(list_tenants())
    outcomes: List[MigrationOutcome] = []
    pending: List[Any] = []
    for company_id, version in tenants:
        if byod_schema.version_meets(version, target):
            outcomes.append(
                MigrationOutcome(company_id, MigrationStatus.CURRENT, version, version)
            )
        else:
            pending.append(company_id)

    def _worker(company_id):
        dsn = resolve_migrate_dsn(company_id)
        if not dsn:
            raise OrchestratorError("tenant has no migrate credential configured")
        status, from_version, to_version = migrate(company_id, dsn)
        if status in (MigrationStatus.MIGRATED, MigrationStatus.CURRENT):
            # Verified success — advance the control-plane version (rule 13).
            record_version(company_id, to_version)
        return (status, from_version, to_version)

    report = byod_jobs.run_tenant_batch(
        pending,
        _worker,
        max_concurrency=max_concurrency,
        skip=skip,
        sanitize=sanitize,
    )

    for o in report.outcomes:
        if o.skipped:
            outcomes.append(MigrationOutcome(o.company_id, MigrationStatus.SKIPPED))
        elif o.ok:
            status, from_version, to_version = o.value
            outcomes.append(
                MigrationOutcome(o.company_id, status, from_version, to_version)
            )
        else:
            outcomes.append(
                MigrationOutcome(o.company_id, MigrationStatus.FAILED, error=o.error)
            )

    counts = {
        MigrationStatus.MIGRATED: 0,
        MigrationStatus.CURRENT: 0,
        MigrationStatus.CONTENDED: 0,
        MigrationStatus.SKIPPED: 0,
        MigrationStatus.FAILED: 0,
    }
    for o in outcomes:
        counts[o.status] += 1
    return MigrationReport(
        target=target,
        total=len(outcomes),
        migrated=counts[MigrationStatus.MIGRATED],
        current=counts[MigrationStatus.CURRENT],
        contended=counts[MigrationStatus.CONTENDED],
        skipped=counts[MigrationStatus.SKIPPED],
        failed=counts[MigrationStatus.FAILED],
        outcomes=outcomes,
    )
