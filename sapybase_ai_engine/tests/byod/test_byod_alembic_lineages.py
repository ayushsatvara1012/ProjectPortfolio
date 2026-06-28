"""Phase 3.1 test gate: split Alembic into control_plane + data_plane lineages.

Exit criteria (RFC docs/rfc-byod.md §13 Phase 3, A.7):
    "Each lineage applies independently against a clean DB; no cross-plane
     tables."

Two layers:
  * Structural (no database) — the data_plane lineage is its own independent
    Alembic environment (separate ini / env / versions), rooted at an
    independent baseline whose revision id == DATA_PLANE_SCHEMA_VERSION and whose
    DDL is the single-source-of-truth byod_dataplane constant; the two lineages
    share no table names (no cross-plane tables).
  * Functional — against a *real* Postgres (ephemeral, clean): the data_plane
    lineage applies on its own to a clean DB, producing exactly the data-plane
    tables (no control-plane tables) and stamping alembic_version to the
    data-plane head; it reconciles a directly-provisioned DB idempotently; and
    the control-plane BYOD DDL on a clean DB likewise introduces no data-plane
    tables. Skips cleanly when no Postgres backend is available.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import psycopg2
import pytest

from alembic import command
from alembic.config import Config

import byod_dataplane
from byod_dataplane import (
    DATA_PLANE_SCHEMA_DROP_SQL,
    DATA_PLANE_SCHEMA_SQL,
    DATA_PLANE_SCHEMA_VERSION,
    DATA_PLANE_TABLES,
)
from db.byod_store import CONTROL_PLANE_SCHEMA_SQL, TABLE_NAME as CONTROL_TABLE_NAME

_ENGINE_ROOT = Path(__file__).resolve().parents[2]
_DATAPLANE_INI = _ENGINE_ROOT / "alembic_dataplane.ini"
_DATAPLANE_BASELINE = (
    _ENGINE_ROOT / "alembic_dataplane" / "versions" / "0001_data_plane_baseline.py"
)
_CONTROL_BASELINE = (
    _ENGINE_ROOT / "alembic_migrations" / "versions" / "0001_baseline.py"
)

# Control-plane tables that must NEVER appear in a freshly-migrated tenant DB.
_CONTROL_PLANE_TABLES = (CONTROL_TABLE_NAME, "companies", "users", "usage_tracking")


def _load_baseline():
    spec = importlib.util.spec_from_file_location(
        "byod_dataplane_baseline_0001", _DATAPLANE_BASELINE
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def _dataplane_alembic_config(dsn: str) -> Config:
    """An Alembic Config for the data_plane lineage targeting ``dsn``."""
    cfg = Config(str(_DATAPLANE_INI))
    # env.py reads an already-set sqlalchemy.url first (programmatic path).
    cfg.set_main_option("sqlalchemy.url", dsn)
    return cfg


def _regclass(cur, table: str):
    cur.execute("SELECT to_regclass(%s)", (table,))
    return cur.fetchone()[0]


# ── Structural: the lineages are independent and non-overlapping (no DB) ──────

class TestLineageWiring:
    def test_dataplane_environment_files_exist(self):
        # A genuinely separate Alembic environment, not a branch of the control one.
        assert _DATAPLANE_INI.exists(), _DATAPLANE_INI
        assert (_ENGINE_ROOT / "alembic_dataplane" / "env.py").exists()
        assert _DATAPLANE_BASELINE.exists(), _DATAPLANE_BASELINE

    def test_baseline_is_an_independent_root(self):
        m = _load_baseline()
        # Root of its own lineage — does NOT chain onto the control-plane tree.
        assert m.down_revision is None
        assert "data_plane" in (m.branch_labels or ())

    def test_revision_id_tracks_schema_version(self):
        # Head revision == the version recorded in the control-plane registry, so
        # the Alembic head and schema_version can never drift.
        m = _load_baseline()
        assert m.revision == DATA_PLANE_SCHEMA_VERSION

    def test_baseline_uses_single_source_of_truth_ddl(self):
        m = _load_baseline()
        assert m.DATA_PLANE_SCHEMA_SQL is DATA_PLANE_SCHEMA_SQL
        assert m.DATA_PLANE_SCHEMA_DROP_SQL is DATA_PLANE_SCHEMA_DROP_SQL

    def test_baselines_live_in_separate_lineage_directories(self):
        # Same revision id "0001" is fine: separate dirs, separate DBs, separate
        # alembic_version tables. They must not collide in one versions/ dir.
        assert _DATAPLANE_BASELINE.parent != _CONTROL_BASELINE.parent
        assert "alembic_dataplane" in str(_DATAPLANE_BASELINE)
        assert "alembic_migrations" in str(_CONTROL_BASELINE)


class TestNoCrossPlaneTables:
    def test_data_plane_tables_absent_from_control_plane_ddl(self):
        for table in DATA_PLANE_TABLES:
            assert table not in CONTROL_PLANE_SCHEMA_SQL, table

    def test_control_plane_table_absent_from_data_plane_ddl(self):
        assert CONTROL_TABLE_NAME not in DATA_PLANE_SCHEMA_SQL

    def test_drop_sql_only_targets_data_plane_tables(self):
        for table in DATA_PLANE_TABLES:
            assert table in DATA_PLANE_SCHEMA_DROP_SQL, table
        for table in _CONTROL_PLANE_TABLES:
            assert table not in DATA_PLANE_SCHEMA_DROP_SQL, table


# ── Functional: each lineage applies independently on a clean DB (real PG) ────
# `control_plane_db_dsn` is a fresh, *bare* (un-provisioned) ephemeral database —
# here it stands in for a clean tenant DB.

def test_data_plane_lineage_applies_to_clean_db(control_plane_db_dsn):
    """THE GATE: the data_plane lineage applies on its own to a clean DB,
    yielding exactly the data-plane tables and stamping the head — with NO
    control-plane tables present."""
    command.upgrade(_dataplane_alembic_config(control_plane_db_dsn), "head")

    conn = psycopg2.connect(control_plane_db_dsn)
    try:
        with conn.cursor() as cur:
            # Every data-plane table is present.
            for table in DATA_PLANE_TABLES:
                assert _regclass(cur, table) is not None, f"{table} missing"
            # No control-plane table leaked into the tenant DB.
            for table in _CONTROL_PLANE_TABLES:
                assert _regclass(cur, table) is None, f"cross-plane table {table}"
            # alembic_version stamped to the data-plane head == the registry version.
            cur.execute("SELECT version_num FROM alembic_version")
            assert cur.fetchone()[0] == DATA_PLANE_SCHEMA_VERSION
    finally:
        conn.close()


def test_data_plane_lineage_reconciles_directly_provisioned_db(control_plane_db_dsn):
    """A DB provisioned directly (Phase 2.3, schema but no alembic_version) is
    reconciled idempotently: `upgrade head` no-ops the CREATEs and just stamps."""
    # Simulate a directly-provisioned tenant DB (no alembic_version row).
    conn = psycopg2.connect(control_plane_db_dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(DATA_PLANE_SCHEMA_SQL)
    finally:
        conn.close()

    # Now bring it under Alembic — must not error on already-present objects.
    command.upgrade(_dataplane_alembic_config(control_plane_db_dsn), "head")

    conn = psycopg2.connect(control_plane_db_dsn)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT version_num FROM alembic_version")
            assert cur.fetchone()[0] == DATA_PLANE_SCHEMA_VERSION
            for table in DATA_PLANE_TABLES:
                assert _regclass(cur, table) is not None, f"{table} missing"
    finally:
        conn.close()


def test_data_plane_downgrade_removes_only_data_tables(control_plane_db_dsn):
    """Downgrade to base tears down the data-plane tables (reverse of the
    baseline), leaving a clean DB."""
    cfg = _dataplane_alembic_config(control_plane_db_dsn)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")

    conn = psycopg2.connect(control_plane_db_dsn)
    try:
        with conn.cursor() as cur:
            for table in DATA_PLANE_TABLES:
                assert _regclass(cur, table) is None, f"{table} not dropped"
    finally:
        conn.close()


def test_control_plane_ddl_introduces_no_data_plane_tables(control_plane_db_dsn):
    """The other direction: applying the control-plane BYOD DDL to a clean DB
    creates its control table and NO data-plane table (no cross-plane bleed)."""
    conn = psycopg2.connect(control_plane_db_dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            # The FK target stub + the control-plane registry DDL (what 0014 runs).
            cur.execute("CREATE TABLE IF NOT EXISTS companies (id UUID PRIMARY KEY)")
            cur.execute(CONTROL_PLANE_SCHEMA_SQL)
            assert _regclass(cur, CONTROL_TABLE_NAME) is not None
            for table in DATA_PLANE_TABLES:
                assert _regclass(cur, table) is None, f"cross-plane table {table}"
    finally:
        conn.close()
