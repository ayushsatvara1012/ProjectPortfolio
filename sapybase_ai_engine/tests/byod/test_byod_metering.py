"""Phase 3.3 test gate: idempotent metering (byod_metering).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 3.3, rules E1/E2, §16.1):
    "Kill between writes → no double-count on retry; cap race bounded; reconciler
     fixes drift."

Layers:
  * Structural (no DB) — migration 0016 chains the control_plane lineage and uses
    the single-source-of-truth ledger DDL.
  * Functional (control-plane Postgres) — the atomic increment-and-check is
    idempotent under retry (E1) and exact under concurrency, same key OR distinct
    keys (E2, no lost updates); and the reconciler repairs a counter that lags a
    confirmed tenant store and is itself idempotent (§16.1 outbox/reconciler).
    Skips cleanly when no Postgres backend is available.
"""
from __future__ import annotations

import importlib.util
import threading
import uuid
from pathlib import Path

import psycopg2
import pytest

import byod_metering
from byod_metering import (
    LEDGER_SCHEMA_SQL,
    LEDGER_TABLE,
    record_message_and_meter,
    reconcile_company,
    summarize_company_usage,
)

_ENGINE_ROOT = Path(__file__).resolve().parents[2]
_MIGRATION_PATH = (
    _ENGINE_ROOT / "alembic_migrations" / "versions" / "0016_byod_usage_ledger.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("byod_migration_0016", _MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


# ── Structural (no DB) ───────────────────────────────────────────────────────────
class TestMigrationWiring:
    def test_revision_chain(self):
        m = _load_migration()
        assert m.revision == "0016"
        assert m.down_revision == "0015"  # chains the control_plane lineage

    def test_uses_canonical_ddl(self):
        m = _load_migration()
        assert m.LEDGER_SCHEMA_SQL is LEDGER_SCHEMA_SQL

    def test_ledger_ddl_has_idempotency_pk(self):
        assert LEDGER_TABLE in LEDGER_SCHEMA_SQL
        assert "PRIMARY KEY (company_id, idempotency_key)" in LEDGER_SCHEMA_SQL


# ── Control-plane fixtures ───────────────────────────────────────────────────────
@pytest.fixture
def metering_db(control_plane_db_dsn):
    """A bare control-plane DB with the minimal companies + usage_tracking stubs and
    the ledger table applied (mirrors the real control-plane schema slice)."""
    conn = psycopg2.connect(control_plane_db_dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("CREATE TABLE IF NOT EXISTS companies (id UUID PRIMARY KEY, user_id UUID)")
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS usage_tracking (
                    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id       UUID,
                    messages_used INTEGER NOT NULL DEFAULT 0,
                    sources_used  INTEGER NOT NULL DEFAULT 0,
                    company_id    UUID,
                    period_start  TIMESTAMPTZ,
                    period_end    TIMESTAMPTZ
                )
                """
            )
            cur.execute(LEDGER_SCHEMA_SQL)
    finally:
        conn.close()
    return control_plane_db_dsn


def _make_company(dsn: str) -> tuple[str, str]:
    company_id, user_id = str(uuid.uuid4()), str(uuid.uuid4())
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO companies (id, user_id) VALUES (%s, %s)", (company_id, user_id))
    finally:
        conn.close()
    return company_id, user_id


def _sum_usage(cur, company_id: str) -> int:
    cur.execute(
        "SELECT COALESCE(SUM(messages_used), 0) FROM usage_tracking WHERE company_id = %s",
        (company_id,),
    )
    return cur.fetchone()[0]


def _ensure_usage_row(dsn: str, company_id: str, user_id: str) -> str:
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO usage_tracking (user_id, company_id, messages_used, period_start, period_end) "
                "VALUES (%s, %s, 0, now(), now() + interval '30 days') RETURNING id",
                (user_id, company_id),
            )
            return str(cur.fetchone()[0])
    finally:
        conn.close()


# ── E1: idempotency ──────────────────────────────────────────────────────────────
def test_meter_increments_once(metering_db):
    company_id, user_id = _make_company(metering_db)
    conn = psycopg2.connect(metering_db)
    try:
        cur = conn.cursor()
        res = record_message_and_meter(
            cur, company_id=company_id, idempotency_key=str(uuid.uuid4()), user_id=user_id
        )
        conn.commit()
        assert res.counted is True
        assert res.messages_used == 1
        assert _sum_usage(cur, company_id) == 1
    finally:
        conn.close()


def test_meter_is_idempotent_on_retry(metering_db):
    """E1 / 'no double-count on retry': the same key applied twice counts once."""
    company_id, user_id = _make_company(metering_db)
    key = str(uuid.uuid4())
    conn = psycopg2.connect(metering_db)
    try:
        cur = conn.cursor()
        r1 = record_message_and_meter(cur, company_id=company_id, idempotency_key=key, user_id=user_id)
        conn.commit()
        r2 = record_message_and_meter(cur, company_id=company_id, idempotency_key=key, user_id=user_id)
        conn.commit()
        assert r1.counted is True
        assert r2.counted is False  # idempotent no-op
        assert _sum_usage(cur, company_id) == 1
    finally:
        conn.close()


def test_distinct_keys_each_counted(metering_db):
    company_id, user_id = _make_company(metering_db)
    conn = psycopg2.connect(metering_db)
    try:
        cur = conn.cursor()
        for _ in range(10):
            record_message_and_meter(
                cur, company_id=company_id, idempotency_key=str(uuid.uuid4()), user_id=user_id
            )
        conn.commit()
        assert _sum_usage(cur, company_id) == 10
    finally:
        conn.close()


# ── E2: atomic increment-and-check under concurrency (cap race bounded) ──────────
def _run_concurrent(dsn, company_id, user_id, keys, usage_row_id):
    """Fire len(keys) threads that each meter their key at the same instant."""
    barrier = threading.Barrier(len(keys))
    counted: list[bool] = []
    lock = threading.Lock()

    def worker(key: str):
        conn = psycopg2.connect(dsn)
        try:
            cur = conn.cursor()
            barrier.wait()
            res = record_message_and_meter(
                cur, company_id=company_id, idempotency_key=key,
                user_id=user_id, usage_row_id=usage_row_id,
            )
            conn.commit()
            with lock:
                counted.append(res.counted)
        finally:
            conn.close()

    threads = [threading.Thread(target=worker, args=(k,)) for k in keys]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return counted


def test_concurrent_same_key_counts_exactly_once(metering_db):
    """E2: concurrent retries of the SAME key serialize → exactly one increment."""
    company_id, user_id = _make_company(metering_db)
    row_id = _ensure_usage_row(metering_db, company_id, user_id)
    key = str(uuid.uuid4())
    counted = _run_concurrent(metering_db, company_id, user_id, [key] * 8, row_id)

    assert sum(1 for c in counted if c) == 1  # exactly one thread counted
    conn = psycopg2.connect(metering_db)
    try:
        assert _sum_usage(conn.cursor(), company_id) == 1
    finally:
        conn.close()


def test_concurrent_distinct_keys_no_lost_update(metering_db):
    """E2: concurrent distinct keys all count → exact counter, no lost updates."""
    company_id, user_id = _make_company(metering_db)
    row_id = _ensure_usage_row(metering_db, company_id, user_id)
    keys = [str(uuid.uuid4()) for _ in range(8)]
    counted = _run_concurrent(metering_db, company_id, user_id, keys, row_id)

    assert all(counted) and len(counted) == 8
    conn = psycopg2.connect(metering_db)
    try:
        assert _sum_usage(conn.cursor(), company_id) == 8
    finally:
        conn.close()


# ── §16.1: outbox/reconciler repairs drift ───────────────────────────────────────
def test_reconciler_repairs_unmetered_confirmed_stores(metering_db, tenant_db_dsn):
    """A store confirmed on the tenant DB but never metered (killed between writes)
    is repaired by the reconciler — counted exactly once, idempotent on re-run."""
    company_id, user_id = _make_company(metering_db)
    keys = [str(uuid.uuid4()) for _ in range(3)]

    # Confirmed stores on the tenant DB (chat_logs.id == idempotency key).
    tconn = psycopg2.connect(tenant_db_dsn)
    tconn.autocommit = True
    try:
        with tconn.cursor() as tcur:
            for k in keys:
                tcur.execute(
                    "INSERT INTO chat_logs (id, company_id, user_query, bot_response) "
                    "VALUES (%s, %s, 'q', 'a')",
                    (k, company_id),
                )
    finally:
        tconn.close()

    cconn = psycopg2.connect(metering_db)
    tconn = psycopg2.connect(tenant_db_dsn)
    try:
        ccur = cconn.cursor()
        # Only the FIRST message got metered; the other two simulate a crash between
        # the tenant store and the control-plane meter.
        record_message_and_meter(ccur, company_id=company_id, idempotency_key=keys[0], user_id=user_id)
        cconn.commit()
        assert _sum_usage(ccur, company_id) == 1

        res = reconcile_company(ccur, tconn.cursor(), company_id, user_id=user_id)
        cconn.commit()
        assert res.stored == 3
        assert res.repaired == 2
        assert _sum_usage(ccur, company_id) == 3  # drift repaired, each counted once

        # Idempotent: a second pass repairs nothing and changes no counter.
        res2 = reconcile_company(ccur, tconn.cursor(), company_id, user_id=user_id)
        cconn.commit()
        assert res2.repaired == 0
        assert _sum_usage(ccur, company_id) == 3
    finally:
        cconn.close()
        tconn.close()


# ── Phase 6: read-side usage rollup (summarize_company_usage) ─────────────────────
def test_usage_summary_zero_for_unmetered_company(metering_db):
    """A company that has never been metered rolls up to all-zeros / None — no row
    in usage_tracking or the ledger means the panel shows a clean empty state, not
    an error."""
    company_id, _ = _make_company(metering_db)
    conn = psycopg2.connect(metering_db)
    try:
        u = summarize_company_usage(conn.cursor(), company_id)
        assert u.messages_used == 0
        assert u.ledger_total == 0
        assert u.last_24h == u.last_7d == u.last_30d == 0
        assert u.period_start is None and u.period_end is None
        assert u.last_metered_at is None
    finally:
        conn.close()


def test_usage_summary_counts_metered_messages(metering_db):
    """After N distinct messages are metered, both the billing counter and the
    ledger-derived totals/windows reflect N, and the current window is surfaced."""
    company_id, user_id = _make_company(metering_db)
    conn = psycopg2.connect(metering_db)
    try:
        cur = conn.cursor()
        for _ in range(5):
            record_message_and_meter(
                cur, company_id=company_id, idempotency_key=str(uuid.uuid4()), user_id=user_id
            )
        conn.commit()

        u = summarize_company_usage(cur, company_id)
        assert u.messages_used == 5          # usage_tracking billing counter
        assert u.ledger_total == 5           # per-message ledger, all time
        assert u.last_24h == 5 and u.last_7d == 5 and u.last_30d == 5  # all just-now
        assert u.last_metered_at is not None
        # _resolve_usage_row seeds a 30-day window, so both bounds are populated.
        assert u.period_start is not None and u.period_end is not None
    finally:
        conn.close()


def test_usage_summary_idempotent_replay_not_double_counted(metering_db):
    """A replayed idempotency key (no double-meter) must not inflate the rollup —
    the ledger PK dedups, so the summary stays at the true count."""
    company_id, user_id = _make_company(metering_db)
    key = str(uuid.uuid4())
    conn = psycopg2.connect(metering_db)
    try:
        cur = conn.cursor()
        record_message_and_meter(cur, company_id=company_id, idempotency_key=key, user_id=user_id)
        record_message_and_meter(cur, company_id=company_id, idempotency_key=key, user_id=user_id)
        conn.commit()

        u = summarize_company_usage(cur, company_id)
        assert u.messages_used == 1
        assert u.ledger_total == 1
    finally:
        conn.close()


def test_usage_summary_windows_exclude_old_messages(metering_db):
    """A message metered outside a trailing window is excluded from that window but
    still counts toward the all-time total — proving the FILTER bounds are real."""
    company_id, user_id = _make_company(metering_db)
    conn = psycopg2.connect(metering_db)
    try:
        cur = conn.cursor()
        # One fresh message (now), one back-dated 10 days (outside 24h/7d, inside 30d).
        record_message_and_meter(
            cur, company_id=company_id, idempotency_key=str(uuid.uuid4()), user_id=user_id
        )
        old_key = str(uuid.uuid4())
        record_message_and_meter(
            cur, company_id=company_id, idempotency_key=old_key, user_id=user_id
        )
        cur.execute(
            f"UPDATE {LEDGER_TABLE} SET recorded_at = now() - interval '10 days' "
            f"WHERE company_id = %s AND idempotency_key = %s",
            (company_id, old_key),
        )
        conn.commit()

        u = summarize_company_usage(cur, company_id)
        assert u.ledger_total == 2     # both messages, all time
        assert u.last_24h == 1         # only the fresh one
        assert u.last_7d == 1
        assert u.last_30d == 2         # the back-dated one is still within 30d
    finally:
        conn.close()
