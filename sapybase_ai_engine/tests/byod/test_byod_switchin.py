"""Phase 7.1 test gate: BYOD switch-IN data migration (byod_switchin).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 7.1):
    "Switch-IN: resumable, checkpointed export->import (shared->tenant); checksum
     verify; atomic cutover; 7-day retention. Migrate a populated tenant; interrupt
     & resume; checksums match; cutover only after verify." (§4.2, rule 17)

Two layers:
  * Structural (no DB) — the 0017 migration rev-chain + single-source DDL, status
    constants, and the table specs (pk first, content_tsv never copied, checksum
    columns are a subset of the copied columns).
  * Functional (real Postgres) — THE GATE: a populated tenant is migrated from a
    "shared" DB into a "tenant" DB; an interrupted run resumes and completes with no
    duplicates; verification compares row counts AND content checksums; the atomic
    cutover happens ONLY after every table verifies (a corrupted destination fails
    without cutover); a re-run after cutover is a no-op; and the shared copy is
    retained for the rollback window, then purgeable.
"""
from __future__ import annotations

import importlib.util
from datetime import timedelta
from pathlib import Path

import psycopg2
import pytest

import byod_dataplane
import byod_switchin
from byod_switchin import SwitchInStatus

from .tenant_harness import bare_ephemeral_database, make_embedding, vector_literal


# ── Structural (no DB) ───────────────────────────────────────────────────────────
_MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "alembic_migrations" / "versions" / "0017_byod_switchin.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("byod_switchin_0017", _MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def test_migration_chains_0016_single_head():
    m = _load_migration()
    assert m.revision == "0017"
    assert m.down_revision == "0016"


def test_migration_uses_single_source_ddl():
    m = _load_migration()
    # The migration must apply the SAME DDL constant the app/tests use (no drift).
    assert m.CONTROL_PLANE_SCHEMA_SQL is byod_switchin.CONTROL_PLANE_SCHEMA_SQL
    assert "byod_switchin_jobs" in byod_switchin.CONTROL_PLANE_SCHEMA_SQL
    assert "byod_switchin_progress" in byod_switchin.CONTROL_PLANE_SCHEMA_SQL


def test_table_specs_are_well_formed():
    names = {s.name for s in byod_switchin.SWITCHIN_TABLES}
    assert names == set(byod_dataplane.DATA_PLANE_TABLES)
    for spec in byod_switchin.SWITCHIN_TABLES:
        assert spec.columns[0] == spec.pk  # pk first → batch cursor + last_id
        # content_tsv is GENERATED and must never be copied.
        assert "content_tsv" not in spec.columns
        # checksum columns are a subset of the copied columns.
        assert set(spec.checksum_columns).issubset(set(spec.columns))
        # the embedding (vector) is copied but excluded from the checksum.
        if "embedding" in spec.columns:
            assert "embedding" not in spec.checksum_columns


def test_status_set_complete():
    assert {
        SwitchInStatus.PENDING, SwitchInStatus.COPYING, SwitchInStatus.VERIFYING,
        SwitchInStatus.VERIFIED, SwitchInStatus.CUTOVER, SwitchInStatus.FAILED,
        SwitchInStatus.PURGED,
    } == set(byod_switchin.SWITCHIN_STATUSES)


# ── Functional (real Postgres) ───────────────────────────────────────────────────
COMPANY_ID = "11111111-1111-1111-1111-111111111111"


def _apply(dsn, sql):
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    finally:
        conn.close()


def _seed_source(dsn, company_id, *, n_knowledge, n_chat, n_leads):
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            for i in range(n_knowledge):
                cur.execute(
                    "INSERT INTO company_knowledge (company_id, url, content, embedding, chunk_type) "
                    "VALUES (%s, %s, %s, %s::vector, 'child')",
                    (company_id, f"https://x/{i}", f"content {i}", vector_literal(make_embedding(i))),
                )
            for i in range(n_chat):
                cur.execute(
                    "INSERT INTO chat_logs (company_id, user_query, bot_response, confidence) "
                    "VALUES (%s, %s, %s, %s)",
                    (company_id, f"q{i}", f"a{i}", 0.5),
                )
            for i in range(n_leads):
                cur.execute(
                    "INSERT INTO lead_capture (company_id, email, context, score, status) "
                    "VALUES (%s, %s, %s, %s, 'new')",
                    (company_id, f"lead{i}@x.com", f"ctx {i}", i),
                )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def shared_and_tenant(tenant_db_server):
    """A 'shared' control-plane DB (companies stub + switch-in tables + the 3 source
    data tables, seeded) and an empty provisioned 'tenant' DB."""
    with bare_ephemeral_database(tenant_db_server) as shared_dsn, \
         bare_ephemeral_database(tenant_db_server) as tenant_dsn:
        # Shared DB: companies stub (for the FK) + switch-in control tables + source data.
        _apply(shared_dsn, "CREATE TABLE companies (id UUID PRIMARY KEY);")
        _apply(shared_dsn, f"INSERT INTO companies (id) VALUES ('{COMPANY_ID}');")
        _apply(shared_dsn, byod_dataplane.DATA_PLANE_SCHEMA_SQL)
        _apply(shared_dsn, byod_switchin.CONTROL_PLANE_SCHEMA_SQL)
        # Tenant DB: just the data-plane schema (empty).
        _apply(tenant_dsn, byod_dataplane.DATA_PLANE_SCHEMA_SQL)
        yield shared_dsn, tenant_dsn


def _counts(dsn, company_id):
    conn = psycopg2.connect(dsn)
    try:
        out = {}
        with conn.cursor() as cur:
            for t in byod_dataplane.DATA_PLANE_TABLES:
                cur.execute(f"SELECT count(*) FROM {t} WHERE company_id = %s", (company_id,))
                out[t] = cur.fetchone()[0]
        return out
    finally:
        conn.close()


def test_switchin_migrates_populated_tenant_and_cuts_over(shared_and_tenant):
    """THE GATE (happy path): every table copied, checksums match, atomic cutover
    only after verification, retention window recorded."""
    shared_dsn, tenant_dsn = shared_and_tenant
    _seed_source(shared_dsn, COMPANY_ID, n_knowledge=4, n_chat=3, n_leads=2)

    shared = psycopg2.connect(shared_dsn)
    tenant = psycopg2.connect(tenant_dsn)
    try:
        result = byod_switchin.run_switchin(
            company_id=COMPANY_ID, source_conn=shared, dest_conn=tenant, control_conn=shared,
            batch_size=2,
        )
    finally:
        shared.close()
        tenant.close()

    assert result.status == SwitchInStatus.CUTOVER
    assert result.cutover_at is not None and result.retain_until is not None
    # ~7-day retention window.
    assert (result.retain_until - result.cutover_at) == timedelta(days=byod_switchin.RETENTION_DAYS)
    assert all(t.verified for t in result.tables)
    # Rows actually landed on the tenant DB and match the shared source.
    assert _counts(tenant_dsn, COMPANY_ID) == {"company_knowledge": 4, "chat_logs": 3, "lead_capture": 2}
    assert _counts(shared_dsn, COMPANY_ID) == _counts(tenant_dsn, COMPANY_ID)


def test_switchin_interrupt_and_resume(shared_and_tenant):
    """An interrupted run leaves resumable checkpoints; the next run completes with
    NO duplicates (idempotent re-apply of the partially-committed batch)."""
    shared_dsn, tenant_dsn = shared_and_tenant
    _seed_source(shared_dsn, COMPANY_ID, n_knowledge=5, n_chat=0, n_leads=0)

    # Crash after the 2nd batch's destination commit, before its checkpoint.
    def fault(table, batch_index):
        if table == "company_knowledge" and batch_index == 1:
            raise RuntimeError("simulated crash mid-copy")

    shared = psycopg2.connect(shared_dsn)
    tenant = psycopg2.connect(tenant_dsn)
    try:
        with pytest.raises(byod_switchin.SwitchInError):
            byod_switchin.run_switchin(
                company_id=COMPANY_ID, source_conn=shared, dest_conn=tenant,
                control_conn=shared, batch_size=1, fault=fault,
            )
        # Job recorded FAILED but the copied rows + checkpoint persist.
        with shared.cursor() as cur:
            cur.execute("SELECT status FROM byod_switchin_jobs WHERE company_id = %s", (COMPANY_ID,))
            assert cur.fetchone()[0] == SwitchInStatus.FAILED
        partial = _counts(tenant_dsn, COMPANY_ID)["company_knowledge"]
        assert 0 < partial < 5  # some, not all

        # Resume (no fault) → completes and cuts over, no duplicates.
        result = byod_switchin.run_switchin(
            company_id=COMPANY_ID, source_conn=shared, dest_conn=tenant,
            control_conn=shared, batch_size=1,
        )
    finally:
        shared.close()
        tenant.close()

    assert result.status == SwitchInStatus.CUTOVER
    assert _counts(tenant_dsn, COMPANY_ID)["company_knowledge"] == 5  # exactly, no dups


def test_switchin_does_not_cut_over_when_verification_fails(shared_and_tenant):
    """Cutover only after verify: a destination row that conflicts with the source
    (same id, different content) survives the ON CONFLICT copy, so the CHECKSUM
    mismatches even though counts match -> FAILED, no cutover."""
    shared_dsn, tenant_dsn = shared_and_tenant
    _seed_source(shared_dsn, COMPANY_ID, n_knowledge=3, n_chat=0, n_leads=0)

    # Pre-seed the tenant with a row whose id matches a source row but content differs.
    src = psycopg2.connect(shared_dsn)
    try:
        with src.cursor() as cur:
            cur.execute(
                "SELECT id FROM company_knowledge WHERE company_id = %s ORDER BY id LIMIT 1",
                (COMPANY_ID,),
            )
            clash_id = cur.fetchone()[0]
    finally:
        src.close()
    tdb = psycopg2.connect(tenant_dsn)
    try:
        with tdb.cursor() as cur:
            cur.execute(
                "INSERT INTO company_knowledge (id, company_id, content, chunk_type) "
                "VALUES (%s, %s, 'TAMPERED', 'child')",
                (clash_id, COMPANY_ID),
            )
        tdb.commit()
    finally:
        tdb.close()

    shared = psycopg2.connect(shared_dsn)
    tenant = psycopg2.connect(tenant_dsn)
    try:
        with pytest.raises(byod_switchin.SwitchInError):
            byod_switchin.run_switchin(
                company_id=COMPANY_ID, source_conn=shared, dest_conn=tenant,
                control_conn=shared, batch_size=10,
            )
        with shared.cursor() as cur:
            cur.execute(
                "SELECT status, cutover_at FROM byod_switchin_jobs WHERE company_id = %s",
                (COMPANY_ID,),
            )
            status, cutover_at = cur.fetchone()
    finally:
        shared.close()
        tenant.close()

    assert status == SwitchInStatus.FAILED
    assert cutover_at is None  # never declared authoritative on an unverified copy


def test_switchin_idempotent_after_cutover(shared_and_tenant):
    """A re-run after cutover is a safe no-op (does not re-copy or move the marker)."""
    shared_dsn, tenant_dsn = shared_and_tenant
    _seed_source(shared_dsn, COMPANY_ID, n_knowledge=2, n_chat=1, n_leads=0)

    shared = psycopg2.connect(shared_dsn)
    tenant = psycopg2.connect(tenant_dsn)
    try:
        first = byod_switchin.run_switchin(
            company_id=COMPANY_ID, source_conn=shared, dest_conn=tenant, control_conn=shared,
        )
        second = byod_switchin.run_switchin(
            company_id=COMPANY_ID, source_conn=shared, dest_conn=tenant, control_conn=shared,
        )
    finally:
        shared.close()
        tenant.close()

    assert first.status == SwitchInStatus.CUTOVER
    assert second.status == SwitchInStatus.CUTOVER
    assert second.cutover_at == first.cutover_at  # marker unchanged, no re-cutover
    assert _counts(tenant_dsn, COMPANY_ID)["company_knowledge"] == 2  # no duplicate copy


def test_retention_purge_respects_window(shared_and_tenant):
    """The shared copy is kept for the rollback window, then purgeable; the purge
    deletes only the shared rows (the client DB is untouched)."""
    shared_dsn, tenant_dsn = shared_and_tenant
    _seed_source(shared_dsn, COMPANY_ID, n_knowledge=2, n_chat=2, n_leads=1)

    shared = psycopg2.connect(shared_dsn)
    tenant = psycopg2.connect(tenant_dsn)
    try:
        result = byod_switchin.run_switchin(
            company_id=COMPANY_ID, source_conn=shared, dest_conn=tenant, control_conn=shared,
        )
        retain_until = result.retain_until

        # Inside the window → no purge, shared copy intact.
        before = byod_switchin.purge_shared_copy(
            shared, shared, COMPANY_ID, now=retain_until - timedelta(seconds=1)
        )
        assert before is False
        assert _counts(shared_dsn, COMPANY_ID)["company_knowledge"] == 2
        with shared.cursor() as cur:
            assert byod_switchin.list_purgeable(cur, retain_until - timedelta(seconds=1)) == []

        # After the window → purge the shared copy; the tenant copy is untouched.
        after = byod_switchin.purge_shared_copy(
            shared, shared, COMPANY_ID, now=retain_until + timedelta(seconds=1)
        )
        assert after is True
        assert _counts(shared_dsn, COMPANY_ID) == {"company_knowledge": 0, "chat_logs": 0, "lead_capture": 0}
        with shared.cursor() as cur:
            cur.execute("SELECT status FROM byod_switchin_jobs WHERE company_id = %s", (COMPANY_ID,))
            assert cur.fetchone()[0] == SwitchInStatus.PURGED
    finally:
        shared.close()
        tenant.close()

    assert _counts(tenant_dsn, COMPANY_ID) == {"company_knowledge": 2, "chat_logs": 2, "lead_capture": 1}
