"""Phase 7.2 test gate: BYOD switch-OUT reverse migration (byod_switchout).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 7.2):
    "Switch-OUT: reverse migration (tenant->shared) or documented loss. Reverse path
     verified; client DB untouched on exit." (§16.6, rule 17)

Two layers:
  * Structural (no DB) — the 0018 migration rev-chain + single-source DDL and the
    status set.
  * Functional (real Postgres) — THE GATE: a populated tenant DB is reverse-migrated
    into a "shared" DB; the move is verified (count + checksum) and the engine is
    re-pointed at shared (offboard) ONLY after verification; an interrupted run
    resumes with no duplicates; a verification mismatch fails without offboarding;
    and in EVERY path the client's own database is never modified. The documented-
    loss path offboards without copying and never opens the tenant DB.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import psycopg2
import pytest

import byod_dataplane
import byod_switchout
from byod_switchout import SwitchOutStatus

from .tenant_harness import bare_ephemeral_database, make_embedding, vector_literal


# ── Structural (no DB) ───────────────────────────────────────────────────────────
_MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "alembic_migrations" / "versions" / "0018_byod_switchout.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("byod_switchout_0018", _MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def test_migration_chains_0017_single_head():
    m = _load_migration()
    assert m.revision == "0018"
    assert m.down_revision == "0017"


def test_migration_uses_single_source_ddl():
    m = _load_migration()
    assert m.CONTROL_PLANE_SCHEMA_SQL is byod_switchout.CONTROL_PLANE_SCHEMA_SQL
    assert "byod_switchout_jobs" in byod_switchout.CONTROL_PLANE_SCHEMA_SQL
    assert "byod_switchout_progress" in byod_switchout.CONTROL_PLANE_SCHEMA_SQL


def test_status_set_complete():
    assert {
        SwitchOutStatus.PENDING, SwitchOutStatus.COPYING, SwitchOutStatus.VERIFYING,
        SwitchOutStatus.VERIFIED, SwitchOutStatus.CUTOVER, SwitchOutStatus.FAILED,
        SwitchOutStatus.DECLINED,
    } == set(byod_switchout.SWITCHOUT_STATUSES)


# ── Functional (real Postgres) ───────────────────────────────────────────────────
COMPANY_ID = "22222222-2222-2222-2222-222222222222"


def _apply(dsn, sql):
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    finally:
        conn.close()


def _seed_tenant(dsn, company_id, *, n_knowledge, n_chat, n_leads):
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


@pytest.fixture
def tenant_and_shared(tenant_db_server):
    """A 'tenant' BYO DB (populated, the read-only source) and a 'shared' control DB
    (companies stub + switch-out tables + empty destination data tables)."""
    with bare_ephemeral_database(tenant_db_server) as tenant_dsn, \
         bare_ephemeral_database(tenant_db_server) as shared_dsn:
        _apply(tenant_dsn, byod_dataplane.DATA_PLANE_SCHEMA_SQL)
        _apply(shared_dsn, "CREATE TABLE companies (id UUID PRIMARY KEY);")
        _apply(shared_dsn, f"INSERT INTO companies (id) VALUES ('{COMPANY_ID}');")
        _apply(shared_dsn, byod_dataplane.DATA_PLANE_SCHEMA_SQL)
        _apply(shared_dsn, byod_switchout.CONTROL_PLANE_SCHEMA_SQL)
        yield tenant_dsn, shared_dsn


def test_switchout_reverse_migrates_and_offboards_after_verify(tenant_and_shared):
    """THE GATE: reverse-copy verified, engine re-pointed at shared (offboard) only
    after verification, and the client's DB is left completely untouched."""
    tenant_dsn, shared_dsn = tenant_and_shared
    _seed_tenant(tenant_dsn, COMPANY_ID, n_knowledge=4, n_chat=3, n_leads=2)
    before = _counts(tenant_dsn, COMPANY_ID)

    offboarded = []
    tenant = psycopg2.connect(tenant_dsn)
    shared = psycopg2.connect(shared_dsn)
    try:
        result = byod_switchout.run_switchout(
            company_id=COMPANY_ID, tenant_conn=tenant, shared_conn=shared,
            offboard=lambda cc, cid: offboarded.append(cid), batch_size=2,
        )
    finally:
        tenant.close()
        shared.close()

    assert result.status == SwitchOutStatus.CUTOVER
    assert offboarded == [COMPANY_ID]  # offboard (cutover) happened, exactly once
    assert all(t.verified for t in result.tables)
    # Shared DB now holds the data, matching the tenant.
    assert _counts(shared_dsn, COMPANY_ID) == {"company_knowledge": 4, "chat_logs": 3, "lead_capture": 2}
    # CLIENT DB UNTOUCHED — counts unchanged after switch-out.
    assert _counts(tenant_dsn, COMPANY_ID) == before


def test_switchout_no_offboard_when_verification_fails(tenant_and_shared):
    """A conflicting destination row (same id, different content) makes the checksum
    mismatch -> FAILED, NO offboard/cutover, and the client DB stays untouched."""
    tenant_dsn, shared_dsn = tenant_and_shared
    _seed_tenant(tenant_dsn, COMPANY_ID, n_knowledge=3, n_chat=0, n_leads=0)
    before = _counts(tenant_dsn, COMPANY_ID)

    # Pre-seed shared with a row whose id matches a tenant row but content differs.
    tc = psycopg2.connect(tenant_dsn)
    try:
        with tc.cursor() as cur:
            cur.execute(
                "SELECT id FROM company_knowledge WHERE company_id = %s ORDER BY id LIMIT 1",
                (COMPANY_ID,),
            )
            clash_id = cur.fetchone()[0]
    finally:
        tc.close()
    _apply(
        shared_dsn,
        "INSERT INTO company_knowledge (id, company_id, content, chunk_type) "
        f"VALUES ('{clash_id}', '{COMPANY_ID}', 'TAMPERED', 'child')",
    )

    offboarded = []
    tenant = psycopg2.connect(tenant_dsn)
    shared = psycopg2.connect(shared_dsn)
    try:
        with pytest.raises(byod_switchout.SwitchOutError):
            byod_switchout.run_switchout(
                company_id=COMPANY_ID, tenant_conn=tenant, shared_conn=shared,
                offboard=lambda cc, cid: offboarded.append(cid), batch_size=10,
            )
        with shared.cursor() as cur:
            cur.execute(
                "SELECT status, cutover_at FROM byod_switchout_jobs WHERE company_id = %s",
                (COMPANY_ID,),
            )
            status, cutover_at = cur.fetchone()
    finally:
        tenant.close()
        shared.close()

    assert status == SwitchOutStatus.FAILED
    assert cutover_at is None
    assert offboarded == []  # never offboard an unverified copy
    assert _counts(tenant_dsn, COMPANY_ID) == before  # client DB untouched


def test_switchout_interrupt_and_resume(tenant_and_shared):
    """An interrupted reverse copy resumes and completes with no duplicates; the
    client DB is never modified across the failed run + the resume."""
    tenant_dsn, shared_dsn = tenant_and_shared
    _seed_tenant(tenant_dsn, COMPANY_ID, n_knowledge=5, n_chat=0, n_leads=0)
    before = _counts(tenant_dsn, COMPANY_ID)

    def fault(table, batch_index):
        if table == "company_knowledge" and batch_index == 1:
            raise RuntimeError("simulated crash mid-copy")

    offboarded = []
    tenant = psycopg2.connect(tenant_dsn)
    shared = psycopg2.connect(shared_dsn)
    try:
        with pytest.raises(byod_switchout.SwitchOutError):
            byod_switchout.run_switchout(
                company_id=COMPANY_ID, tenant_conn=tenant, shared_conn=shared,
                offboard=lambda cc, cid: offboarded.append(cid), batch_size=1, fault=fault,
            )
        assert offboarded == []  # crashed before verify/cutover
        result = byod_switchout.run_switchout(
            company_id=COMPANY_ID, tenant_conn=tenant, shared_conn=shared,
            offboard=lambda cc, cid: offboarded.append(cid), batch_size=1,
        )
    finally:
        tenant.close()
        shared.close()

    assert result.status == SwitchOutStatus.CUTOVER
    assert offboarded == [COMPANY_ID]
    assert _counts(shared_dsn, COMPANY_ID)["company_knowledge"] == 5  # no dups
    assert _counts(tenant_dsn, COMPANY_ID) == before  # client DB untouched


def test_switchout_idempotent_after_cutover(tenant_and_shared):
    """A re-run after cutover is a no-op (no re-copy, no second offboard)."""
    tenant_dsn, shared_dsn = tenant_and_shared
    _seed_tenant(tenant_dsn, COMPANY_ID, n_knowledge=2, n_chat=1, n_leads=0)

    offboarded = []
    tenant = psycopg2.connect(tenant_dsn)
    shared = psycopg2.connect(shared_dsn)
    try:
        first = byod_switchout.run_switchout(
            company_id=COMPANY_ID, tenant_conn=tenant, shared_conn=shared,
            offboard=lambda cc, cid: offboarded.append(cid),
        )
        second = byod_switchout.run_switchout(
            company_id=COMPANY_ID, tenant_conn=tenant, shared_conn=shared,
            offboard=lambda cc, cid: offboarded.append(cid),
        )
    finally:
        tenant.close()
        shared.close()

    assert first.status == SwitchOutStatus.CUTOVER and second.status == SwitchOutStatus.CUTOVER
    assert second.cutover_at == first.cutover_at
    assert offboarded == [COMPANY_ID]  # offboard happened exactly once


def test_documented_loss_offboards_without_copy(tenant_and_shared):
    """Declining the reverse migration offboards (routing + creds) without copying;
    the tenant DB is never even opened, so it is trivially untouched."""
    tenant_dsn, shared_dsn = tenant_and_shared
    _seed_tenant(tenant_dsn, COMPANY_ID, n_knowledge=3, n_chat=0, n_leads=0)
    before = _counts(tenant_dsn, COMPANY_ID)

    offboarded = []
    shared = psycopg2.connect(shared_dsn)
    try:
        result = byod_switchout.offboard_documented_loss(
            company_id=COMPANY_ID, control_conn=shared,
            offboard=lambda cc, cid: offboarded.append(cid),
        )
    finally:
        shared.close()

    assert result.status == SwitchOutStatus.DECLINED
    assert offboarded == [COMPANY_ID]
    # Nothing copied to shared; client DB untouched.
    assert _counts(shared_dsn, COMPANY_ID) == {"company_knowledge": 0, "chat_logs": 0, "lead_capture": 0}
    assert _counts(tenant_dsn, COMPANY_ID) == before


def test_default_offboard_removes_routing_record(tenant_db_server):
    """_default_offboard deletes the byod_tenant_databases routing record (so the
    engine stops connecting) via the shared control plane only."""
    from db import byod_store

    with bare_ephemeral_database(tenant_db_server) as shared_dsn:
        _apply(shared_dsn, "CREATE TABLE companies (id UUID PRIMARY KEY);")
        _apply(shared_dsn, f"INSERT INTO companies (id) VALUES ('{COMPANY_ID}');")
        _apply(shared_dsn, byod_store.CONTROL_PLANE_SCHEMA_SQL)
        shared = psycopg2.connect(shared_dsn)
        try:
            with shared.cursor() as cur:
                byod_store.store_tenant_db_record(
                    cur, COMPANY_ID, dsn_ciphertext=b"x", dsn_key_id="k",
                )
            shared.commit()
            byod_switchout._default_offboard(shared, COMPANY_ID)
            with shared.cursor() as cur:
                assert byod_store.get_tenant_db_record(cur, COMPANY_ID) is None
        finally:
            shared.close()
