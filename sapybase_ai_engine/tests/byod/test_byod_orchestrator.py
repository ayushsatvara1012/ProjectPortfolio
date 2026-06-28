"""Phase 6.2 test gate: BYOD data-plane migration orchestrator (byod_orchestrator).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 6.2):
    "Orchestrator: advisory-locked, idempotent, retrying rollout; record version on
     verified success. Ship a sample additive migration to the fleet; unreachable
     tenant retried; concurrent runners safe." (§8.3, A.8, rule 13, §10)

Two layers:
  * Pure (no DB) — the rollout tally/skip/isolation logic (records version only on
    verified success, isolates failures, skips open-breaker tenants, prefilters
    already-current tenants) with fakes, and migrate_tenant's advisory-lock /
    idempotency / verification logic against a fake connection.
  * Functional (real Postgres) — THE GATE: a real additive migration (a fixture
    data_plane lineage baseline 0001 -> sample 0002) rolled across a fleet of real
    tenant DBs under the real Postgres advisory lock: every tenant gets the new
    column + recorded version; an unreachable tenant is isolated + not advanced;
    a re-run is a no-op (idempotent); two concurrent runners never double-apply.
"""
from __future__ import annotations

import shutil
import threading
from contextlib import ExitStack
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg2
import pytest

import byod_dataplane
from services import byod_engine
import byod_orchestrator
from byod_orchestrator import MigrationStatus, MigrationVerificationError

from .tenant_harness import bare_ephemeral_database


# ── Pure: rollout tally / verified-success / isolation (no DB) ───────────────────
def _recorder():
    recorded = {}

    def record(cid, version):
        recorded[cid] = version

    return recorded, record


def test_rollout_all_migrated_records_each():
    recorded, record = _recorder()
    called = []

    def migrate(cid, dsn):
        called.append(cid)
        return (MigrationStatus.MIGRATED, "0001", "0002")

    report = byod_orchestrator.run_migration_rollout(
        list_tenants=lambda: [("a", "0001"), ("b", "0001"), ("c", "0001")],
        resolve_migrate_dsn=lambda cid: f"dsn-{cid}",
        record_version=record,
        target="0002",
        migrate=migrate,
        max_concurrency=2,
    )
    assert report.migrated == 3 and report.total == 3
    assert recorded == {"a": "0002", "b": "0002", "c": "0002"}
    assert sorted(called) == ["a", "b", "c"]


def test_rollout_prefilters_already_current_without_connecting():
    recorded, record = _recorder()
    called = []

    def migrate(cid, dsn):
        called.append(cid)
        return (MigrationStatus.MIGRATED, "0001", "0002")

    report = byod_orchestrator.run_migration_rollout(
        list_tenants=lambda: [("up", "0002"), ("behind", "0001"), ("ahead", "0003")],
        resolve_migrate_dsn=lambda cid: f"dsn-{cid}",
        record_version=record,
        target="0002",
        migrate=migrate,
    )
    # Tenants already at/above target are reported current WITHOUT a connection.
    assert called == ["behind"]
    assert report.current == 2 and report.migrated == 1
    # Pre-filtered current tenants are not re-recorded (already at version).
    assert recorded == {"behind": "0002"}


def test_rollout_isolates_unreachable_and_continues():
    recorded, record = _recorder()

    def migrate(cid, dsn):
        if cid == "bad":
            raise psycopg2.OperationalError('could not connect to host "db.internal"')
        return (MigrationStatus.MIGRATED, "0001", "0002")

    report = byod_orchestrator.run_migration_rollout(
        list_tenants=lambda: [("good1", "0001"), ("bad", "0001"), ("good2", "0001")],
        resolve_migrate_dsn=lambda cid: f"dsn-{cid}",
        record_version=record,
        target="0002",
        migrate=migrate,
        sanitize=byod_engine.sanitize_db_error,
    )
    assert report.migrated == 2 and report.failed == 1 and report.total == 3
    # The failed tenant is NOT advanced (stays on old version; retried next pass).
    assert "bad" not in recorded
    assert recorded == {"good1": "0002", "good2": "0002"}
    # The failure reason is sanitized — no host/DSN text leaks (E6).
    bad = next(o for o in report.outcomes if o.company_id == "bad")
    assert bad.status == MigrationStatus.FAILED
    assert "db.internal" not in (bad.error or "")


def test_rollout_does_not_record_contended():
    recorded, record = _recorder()
    report = byod_orchestrator.run_migration_rollout(
        list_tenants=lambda: [("a", "0001")],
        resolve_migrate_dsn=lambda cid: f"dsn-{cid}",
        record_version=record,
        target="0002",
        migrate=lambda cid, dsn: (MigrationStatus.CONTENDED, "0001", None),
    )
    assert report.contended == 1 and report.migrated == 0
    assert recorded == {}  # another runner owns it; we never advance the version


def test_rollout_skips_open_breaker_tenants():
    recorded, record = _recorder()
    called = []

    def migrate(cid, dsn):
        called.append(cid)
        return (MigrationStatus.MIGRATED, "0001", "0002")

    report = byod_orchestrator.run_migration_rollout(
        list_tenants=lambda: [("ok", "0001"), ("broken", "0001")],
        resolve_migrate_dsn=lambda cid: f"dsn-{cid}",
        record_version=record,
        target="0002",
        migrate=migrate,
        skip=lambda cid: cid == "broken",
    )
    assert report.skipped == 1 and report.migrated == 1
    assert called == ["ok"]  # the open-breaker tenant's worker never ran
    assert "broken" not in recorded


def test_rollout_missing_credential_is_failed():
    recorded, record = _recorder()
    report = byod_orchestrator.run_migration_rollout(
        list_tenants=lambda: [("a", "0001")],
        resolve_migrate_dsn=lambda cid: None,  # no migrate DSN on file
        record_version=record,
        target="0002",
        migrate=lambda cid, dsn: (MigrationStatus.MIGRATED, "0001", "0002"),
    )
    assert report.failed == 1 and recorded == {}


def test_rollout_empty_fleet_is_all_zero():
    recorded, record = _recorder()
    report = byod_orchestrator.run_migration_rollout(
        list_tenants=lambda: [],
        resolve_migrate_dsn=lambda cid: "dsn",
        record_version=record,
        target="0002",
        migrate=lambda cid, dsn: (MigrationStatus.MIGRATED, "0001", "0002"),
    )
    assert report.total == 0 and report.migrated == 0 and recorded == {}


def test_production_data_plane_head_is_known():
    # The orchestrator's default target = the production data_plane Alembic head;
    # today that is the baseline shipped in Phase 3.1.
    assert byod_orchestrator.data_plane_head() == byod_dataplane.DATA_PLANE_SCHEMA_VERSION


# ── Pure: migrate_tenant advisory-lock / idempotency / verification (fake conn) ──
class _FakeCursor:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=None):
        s = sql.lower()
        c = self._conn
        if "pg_try_advisory_lock" in s:
            c._result = (c.acquire,)
            if c.acquire:
                c.locked = True
        elif "pg_advisory_unlock" in s:
            c.unlocked = True
            c._result = (True,)
        elif "to_regclass" in s:
            c._result = ("alembic_version" if c.version is not None else None,)
        elif "version_num from alembic_version" in s:
            c._result = (c.version,) if c.version is not None else None
        else:  # pragma: no cover - defensive
            c._result = None

    def fetchone(self):
        return self._conn._result

    def close(self):
        pass


class _FakeConn:
    """A fake migrate connection: a settable advisory-lock result + a mutable
    alembic_version that an injected `upgrade` can bump."""

    def __init__(self, *, acquire=True, version="0001"):
        self.acquire = acquire
        self.version = version
        self.locked = False
        self.unlocked = False
        self.closed = False
        self._result = None

    def cursor(self):
        return _FakeCursor(self)

    def close(self):
        self.closed = True


def test_migrate_tenant_acquires_upgrades_verifies_and_unlocks():
    conn = _FakeConn(acquire=True, version="0001")
    upgraded = []

    def upgrade(dsn):
        upgraded.append(dsn)
        conn.version = "0002"  # the migration advanced the head

    status, frm, to = byod_orchestrator.migrate_tenant(
        "dsn", target="0002", connect=lambda dsn: conn, upgrade=upgrade
    )
    assert (status, frm, to) == (MigrationStatus.MIGRATED, "0001", "0002")
    assert upgraded == ["dsn"]
    assert conn.locked and conn.unlocked and conn.closed


def test_migrate_tenant_already_current_is_noop():
    conn = _FakeConn(acquire=True, version="0002")
    called = []
    status, frm, to = byod_orchestrator.migrate_tenant(
        "dsn", target="0002", connect=lambda dsn: conn,
        upgrade=lambda dsn: called.append(dsn),
    )
    assert (status, frm, to) == (MigrationStatus.CURRENT, "0002", "0002")
    assert called == []  # idempotent: no upgrade when already at/above target
    assert conn.unlocked  # lock still released


def test_migrate_tenant_contended_does_not_upgrade_or_unlock():
    conn = _FakeConn(acquire=False, version="0001")
    called = []
    status, frm, to = byod_orchestrator.migrate_tenant(
        "dsn", target="0002", connect=lambda dsn: conn,
        upgrade=lambda dsn: called.append(dsn),
    )
    assert status == MigrationStatus.CONTENDED and to is None
    assert called == []
    assert conn.unlocked is False  # never held the lock, so nothing to release
    assert conn.closed


def test_migrate_tenant_verification_failure_raises_and_unlocks():
    conn = _FakeConn(acquire=True, version="0001")
    # upgrade "runs" but the head never reaches target -> must NOT report success.
    with pytest.raises(MigrationVerificationError):
        byod_orchestrator.migrate_tenant(
            "dsn", target="0002", connect=lambda dsn: conn, upgrade=lambda dsn: None
        )
    assert conn.unlocked and conn.closed  # lock released even on failure (finally)


# ── Functional: real additive migration across a real fleet (THE GATE) ───────────
_REAL_BASELINE = (
    Path(__file__).resolve().parents[2] / "alembic_dataplane" / "versions"
    / "0001_data_plane_baseline.py"
)
_REAL_DATAPLANE_INI = Path(__file__).resolve().parents[2] / "alembic_dataplane.ini"

# A sample EXPAND-only migration (rule 11): add a nullable column, IF NOT EXISTS so
# re-running is a no-op. This is the "sample additive migration" the gate ships.
_SAMPLE_0002 = '''\
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS sentiment_score double precision"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE chat_logs DROP COLUMN IF EXISTS sentiment_score")
'''


def _raw_connect(dsn):
    """Autocommit connect WITHOUT the SSRF re-check (tenant DBs are on loopback in
    tests, which validate_db_url rejects — mirrors the dsn_provider seam used across
    the BYOD suite)."""
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    return conn


@pytest.fixture
def fixture_versions(tmp_path):
    """A throwaway data_plane lineage: the real baseline (0001) + the sample
    additive 0002, in their own versions dir. Pointed at via Alembic's
    version_locations so the REAL env.py (engine-root on sys.path) still drives it,
    without touching the production lineage."""
    versions = tmp_path / "versions"
    versions.mkdir()
    shutil.copy(_REAL_BASELINE, versions / "0001_data_plane_baseline.py")
    (versions / "0002_sample_additive.py").write_text(_SAMPLE_0002)
    return versions


def _make_fixture_upgrade(versions):
    from alembic import command
    from alembic.config import Config

    def upgrade(dsn):
        cfg = Config(str(_REAL_DATAPLANE_INI))
        cfg.set_main_option("version_locations", str(versions))
        cfg.set_main_option("sqlalchemy.url", dsn)
        cfg.attributes["configure_logger"] = False  # thread-safe concurrent rollout
        command.upgrade(cfg, "head")

    return upgrade


def _provision_baseline(dsn):
    """Lay down the data-plane schema directly (no alembic_version stamp) — a tenant
    provisioned at the baseline, exactly as Phase 2.3 provisioning leaves it."""
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(byod_dataplane.DATA_PLANE_SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


def _has_column(dsn, table, column):
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = %s AND column_name = %s",
                (table, column),
            )
            return cur.fetchone() is not None
    finally:
        conn.close()


def _alembic_version(dsn):
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT version_num FROM alembic_version")
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def test_rollout_ships_sample_migration_to_fleet(tenant_db_server, fixture_versions):
    """THE GATE: a real additive migration rolls across a fleet of real tenant DBs;
    every tenant gets the new column + a recorded, verified version."""
    upgrade = _make_fixture_upgrade(fixture_versions)
    with ExitStack() as stack:
        dsns = {}
        for name in ("t1", "t2", "t3"):
            dsn = stack.enter_context(bare_ephemeral_database(tenant_db_server))
            _provision_baseline(dsn)
            dsns[name] = dsn

        recorded, record = _recorder()
        report = byod_orchestrator.run_migration_rollout(
            list_tenants=lambda: [(c, "0001") for c in dsns],
            resolve_migrate_dsn=lambda cid: dsns[cid],
            record_version=record,
            target="0002",
            migrate=lambda cid, dsn: byod_orchestrator.migrate_tenant(
                dsn, target="0002", connect=_raw_connect, upgrade=upgrade
            ),
        )

        assert report.migrated == 3 and report.failed == 0 and report.contended == 0
        assert recorded == {"t1": "0002", "t2": "0002", "t3": "0002"}
        for dsn in dsns.values():
            assert _has_column(dsn, "chat_logs", "sentiment_score")
            assert _alembic_version(dsn) == "0002"


def test_rollout_isolates_unreachable_tenant(tenant_db_server, fixture_versions):
    """An unreachable tenant is isolated (failed) and NOT advanced; the rest of the
    fleet still migrates — and is retried on a later pass."""
    upgrade = _make_fixture_upgrade(fixture_versions)
    with ExitStack() as stack:
        good = {}
        for name in ("g1", "g2"):
            dsn = stack.enter_context(bare_ephemeral_database(tenant_db_server))
            _provision_baseline(dsn)
            good[name] = dsn
        # A DSN to a database that does not exist -> connect fails (unreachable).
        parts = urlsplit(good["g1"])
        bad_dsn = urlunsplit(
            (parts.scheme, parts.netloc, "/byod_nonexistent_db", parts.query, parts.fragment)
        )
        all_dsns = {**good, "bad": bad_dsn}

        recorded, record = _recorder()
        report = byod_orchestrator.run_migration_rollout(
            list_tenants=lambda: [(c, "0001") for c in all_dsns],
            resolve_migrate_dsn=lambda cid: all_dsns[cid],
            record_version=record,
            target="0002",
            migrate=lambda cid, dsn: byod_orchestrator.migrate_tenant(
                dsn, target="0002", connect=_raw_connect, upgrade=upgrade
            ),
            sanitize=byod_engine.sanitize_db_error,
        )

        assert report.migrated == 2 and report.failed == 1
        assert "bad" not in recorded and set(recorded) == {"g1", "g2"}
        for dsn in good.values():
            assert _has_column(dsn, "chat_logs", "sentiment_score")


def test_rollout_is_idempotent_on_rerun(tenant_db_server, fixture_versions):
    """Re-running after a successful rollout is a no-op: the DB is already at head,
    the column is not duplicated, and the tenant is reported current."""
    upgrade = _make_fixture_upgrade(fixture_versions)
    with ExitStack() as stack:
        dsn = stack.enter_context(bare_ephemeral_database(tenant_db_server))
        _provision_baseline(dsn)

        # First migrate to 0002.
        s1, _, _ = byod_orchestrator.migrate_tenant(
            dsn, target="0002", connect=_raw_connect, upgrade=upgrade
        )
        assert s1 == MigrationStatus.MIGRATED
        # Second pass: the DB is at head already (even though a stale control-plane
        # version might say 0001) -> CURRENT, upgrade not re-applied.
        s2, frm2, to2 = byod_orchestrator.migrate_tenant(
            dsn, target="0002", connect=_raw_connect, upgrade=upgrade
        )
        assert (s2, frm2, to2) == (MigrationStatus.CURRENT, "0002", "0002")
        assert _alembic_version(dsn) == "0002"


def test_concurrent_runners_never_double_apply(tenant_db_server, fixture_versions):
    """Two runners migrate the SAME tenant DB at once: the real Postgres advisory
    lock means exactly one applies it and the other is contended — never a double
    apply, never an error (rule 13: concurrent runners safe)."""
    versions = fixture_versions
    barrier = threading.Barrier(2)

    def slow_upgrade(dsn):
        # Hold the advisory lock across a slow upgrade so the other runner's
        # pg_try_advisory_lock is guaranteed to find it held.
        import time

        from alembic import command
        from alembic.config import Config

        cfg = Config(str(_REAL_DATAPLANE_INI))
        cfg.set_main_option("version_locations", str(versions))
        cfg.set_main_option("sqlalchemy.url", dsn)
        cfg.attributes["configure_logger"] = False
        time.sleep(0.4)
        command.upgrade(cfg, "head")

    with ExitStack() as stack:
        dsn = stack.enter_context(bare_ephemeral_database(tenant_db_server))
        _provision_baseline(dsn)

        results = {}
        errors = {}

        def runner(tag):
            try:
                barrier.wait()
                results[tag] = byod_orchestrator.migrate_tenant(
                    dsn, target="0002", connect=_raw_connect, upgrade=slow_upgrade
                )
            except Exception as exc:  # pragma: no cover - failure is the assertion
                errors[tag] = exc

        threads = [threading.Thread(target=runner, args=(i,)) for i in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, errors
        statuses = sorted(s for (s, _f, _t) in results.values())
        assert statuses == [MigrationStatus.CONTENDED, MigrationStatus.MIGRATED]
        assert _alembic_version(dsn) == "0002"
        assert _has_column(dsn, "chat_logs", "sentiment_score")
