"""BYOD switch-OUT data migration: move a tenant's rows back from its own BYO
database into the shared Sapybase DB when it leaves BYOD (RFC docs/rfc-byod.md
Phase 7.2; §16.6, §4.6, rule 17).

This is the reverse of the Phase-7.1 switch-IN, with the SAME idempotent /
checkpointed / checksum-verified / atomic-cutover discipline (rule 17) but two
defining differences (§16.6):

  * **The client's database is NEVER modified on exit.** Switch-out only ever
    *reads* (``SELECT``) from the tenant DB; the copy and the offboard write only to
    the shared control plane. Nothing here deletes, updates, or drops anything in
    the client's own database — leaving BYOD never destroys the customer's data.
  * **Cutover = stop connecting to the tenant DB** (offboard the routing record),
    re-pointing the engine at the shared DB. It happens ONLY after every table is
    verified, so the shared DB is never made authoritative on an incomplete copy.

If the customer **declines** the reverse migration, :func:`offboard_documented_loss`
just offboards (removes routing + credentials) — history beyond the shared DB is
then unavailable (stated in contract), and the client DB is still untouched.

The reverse copy reuses the Phase-7.1 batch read / batch insert / checksum
primitives and the shared :data:`SWITCHIN_TABLES` spec, so the two directions can
never drift in what they move. Connection/offboard seams are injected, so this
imports neither main.py nor the pool and is unit-testable against throwaway
tenant + shared Postgres DBs.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Tuple

import byod_store
from byod_switchin import (
    SWITCHIN_TABLES,
    TableSpec,
    _ZERO_UUID,
    _insert_batch,
    _read_batch,
    table_checksum,
)

logger = logging.getLogger(__name__)

DEFAULT_BATCH_SIZE = int(os.getenv("BYOD_SWITCHOUT_BATCH_SIZE", "500"))


class SwitchOutStatus:
    PENDING = "PENDING"
    COPYING = "COPYING"
    VERIFYING = "VERIFYING"
    VERIFIED = "VERIFIED"
    CUTOVER = "CUTOVER"      # verified + offboarded; shared DB authoritative again
    FAILED = "FAILED"
    DECLINED = "DECLINED"    # reverse migration declined; offboard-only (data loss)


SWITCHOUT_STATUSES = frozenset(
    {
        SwitchOutStatus.PENDING,
        SwitchOutStatus.COPYING,
        SwitchOutStatus.VERIFYING,
        SwitchOutStatus.VERIFIED,
        SwitchOutStatus.CUTOVER,
        SwitchOutStatus.FAILED,
        SwitchOutStatus.DECLINED,
    }
)


class SwitchOutError(Exception):
    """A switch-out failed. Message is sanitized (E6) — no DSN/host/driver text."""


# ── Control-plane state: job + per-table checkpoints ─────────────────────────────
CONTROL_PLANE_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS byod_switchout_jobs (
    company_id   UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','COPYING','VERIFYING','VERIFIED',
                                   'CUTOVER','FAILED','DECLINED')),
    started_at   TIMESTAMPTZ DEFAULT now(),
    verified_at  TIMESTAMPTZ,
    cutover_at   TIMESTAMPTZ,
    error        TEXT,
    updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS byod_switchout_progress (
    company_id   UUID NOT NULL
                 REFERENCES byod_switchout_jobs(company_id) ON DELETE CASCADE,
    table_name   TEXT NOT NULL,
    last_id      UUID,
    rows_copied  BIGINT NOT NULL DEFAULT 0,
    completed    BOOLEAN NOT NULL DEFAULT false,
    updated_at   TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (company_id, table_name)
);
""".strip()

CONTROL_PLANE_SCHEMA_DROP_SQL = (
    "DROP TABLE IF EXISTS byod_switchout_progress;\n"
    "DROP TABLE IF EXISTS byod_switchout_jobs;"
)


@dataclass(frozen=True)
class TableResult:
    table: str
    rows_copied: int
    source_count: int
    dest_count: int
    verified: bool


@dataclass(frozen=True)
class SwitchOutResult:
    company_id: str
    status: str
    tables: List[TableResult] = field(default_factory=list)
    cutover_at: Optional[datetime] = None


# ── Job / progress accessors (cursor-taking; caller owns the txn) ─────────────────
def ensure_job(cur, company_id: str) -> str:
    cur.execute(
        "INSERT INTO byod_switchout_jobs (company_id) VALUES (%s) "
        "ON CONFLICT (company_id) DO NOTHING",
        (company_id,),
    )
    cur.execute(
        "SELECT status FROM byod_switchout_jobs WHERE company_id = %s", (company_id,)
    )
    return cur.fetchone()[0]


def set_job_status(cur, company_id: str, status: str, *, error: Optional[str] = None) -> None:
    if status not in SWITCHOUT_STATUSES:
        raise ValueError(f"invalid switch-out status {status!r}")
    cur.execute(
        "UPDATE byod_switchout_jobs SET status = %s, error = %s, updated_at = now() "
        "WHERE company_id = %s",
        (status, error, company_id),
    )


def get_progress(cur, company_id: str, table: str) -> Tuple[Optional[str], int, bool]:
    cur.execute(
        "SELECT last_id, rows_copied, completed FROM byod_switchout_progress "
        "WHERE company_id = %s AND table_name = %s",
        (company_id, table),
    )
    row = cur.fetchone()
    if not row:
        return (None, 0, False)
    return (str(row[0]) if row[0] is not None else None, int(row[1]), bool(row[2]))


def _save_progress(cur, company_id, table, last_id, rows_copied, completed) -> None:
    cur.execute(
        """
        INSERT INTO byod_switchout_progress
            (company_id, table_name, last_id, rows_copied, completed, updated_at)
        VALUES (%s, %s, %s, %s, %s, now())
        ON CONFLICT (company_id, table_name) DO UPDATE SET
            last_id = EXCLUDED.last_id,
            rows_copied = EXCLUDED.rows_copied,
            completed = EXCLUDED.completed,
            updated_at = now()
        """,
        (company_id, table, last_id, rows_copied, completed),
    )


def _copy_table(
    tenant_conn, shared_conn, control_conn, company_id: str, spec: TableSpec,
    *, batch_size: int, fault=None,
) -> int:
    """Copy one table tenant->shared in checkpointed batches (resumable, idempotent).

    Reads ONLY from the tenant DB (``tenant_conn``); writes to the shared DB and the
    checkpoint. The shared INSERT is ON CONFLICT DO NOTHING, and the destination is
    committed BEFORE the checkpoint, so a crash re-applies the batch as a no-op."""
    cctrl = control_conn.cursor()
    try:
        last_id, rows_copied, completed = get_progress(cctrl, company_id, spec.name)
    finally:
        cctrl.close()
    if completed:
        return 0
    after = last_id or _ZERO_UUID
    copied_this_run = 0
    batch_index = 0
    while True:
        scur = tenant_conn.cursor()  # READ ONLY on the client's DB
        try:
            rows = _read_batch(scur, company_id, spec, after, batch_size)
        finally:
            scur.close()
        if not rows:
            break
        dcur = shared_conn.cursor()
        try:
            _insert_batch(dcur, spec, rows)
        finally:
            dcur.close()
        shared_conn.commit()
        if fault is not None:
            fault(spec.name, batch_index)
        after = str(rows[-1][0])
        rows_copied += len(rows)
        copied_this_run += len(rows)
        batch_index += 1
        cctrl = control_conn.cursor()
        try:
            _save_progress(cctrl, company_id, spec.name, after, rows_copied, False)
        finally:
            cctrl.close()
        control_conn.commit()
        if len(rows) < batch_size:
            break
    cctrl = control_conn.cursor()
    try:
        _save_progress(cctrl, company_id, spec.name, after, rows_copied, True)
    finally:
        cctrl.close()
    control_conn.commit()
    return copied_this_run


def _default_offboard(control_conn, company_id: str) -> None:
    """Remove the BYOD routing + encrypted credentials so the engine stops
    connecting to the tenant DB (§4.6 / §16.6). Deletes ONLY the control-plane
    record — never the client's data."""
    cur = control_conn.cursor()
    try:
        byod_store.delete_tenant_db_record(cur, company_id)
    finally:
        cur.close()
    control_conn.commit()


# ── Orchestrator ─────────────────────────────────────────────────────────────────
def run_switchout(
    *,
    company_id: str,
    tenant_conn,
    shared_conn,
    control_conn=None,
    offboard=None,
    tables: Tuple[TableSpec, ...] = SWITCHIN_TABLES,
    batch_size: int = DEFAULT_BATCH_SIZE,
    now: Optional[datetime] = None,
    fault=None,
) -> SwitchOutResult:
    """Run (or resume) the tenant->shared reverse migration for ``company_id``.

    Resumable + idempotent; verifies every table (count + checksum) and performs the
    atomic cutover — :func:`_default_offboard` (or an injected ``offboard``) — ONLY
    if all verify, else marks FAILED and raises :class:`SwitchOutError`. The tenant
    DB (``tenant_conn``) is **read-only** throughout: leaving BYOD never modifies the
    client's database. ``control_conn`` defaults to ``shared_conn``."""
    now = now or datetime.now(timezone.utc)
    control_conn = control_conn or shared_conn

    cur = control_conn.cursor()
    try:
        status = ensure_job(cur, company_id)
        if status in (SwitchOutStatus.CUTOVER, SwitchOutStatus.DECLINED):
            cur.execute(
                "SELECT cutover_at FROM byod_switchout_jobs WHERE company_id = %s",
                (company_id,),
            )
            (cutover_at,) = cur.fetchone()
            control_conn.commit()
            return SwitchOutResult(company_id, status, cutover_at=cutover_at)
        set_job_status(cur, company_id, SwitchOutStatus.COPYING)
    finally:
        cur.close()
    control_conn.commit()

    # 1. Copy every table tenant->shared (resumable, tenant DB read-only).
    try:
        for spec in tables:
            _copy_table(
                tenant_conn, shared_conn, control_conn, company_id, spec,
                batch_size=batch_size, fault=fault,
            )
    except SwitchOutError:
        raise
    except Exception as exc:
        _mark_failed(control_conn, company_id, f"copy failed ({type(exc).__name__})")
        raise SwitchOutError(f"switch-out copy failed ({type(exc).__name__})") from exc

    # 2. Verify each table: row count AND content checksum, tenant vs shared.
    cur = control_conn.cursor()
    try:
        set_job_status(cur, company_id, SwitchOutStatus.VERIFYING)
    finally:
        cur.close()
    control_conn.commit()

    results: List[TableResult] = []
    all_verified = True
    for spec in tables:
        scur = tenant_conn.cursor()
        try:
            src_n, src_chk = table_checksum(scur, company_id, spec)
        finally:
            scur.close()
        dcur = shared_conn.cursor()
        try:
            dst_n, dst_chk = table_checksum(dcur, company_id, spec)
        finally:
            dcur.close()
        cctrl = control_conn.cursor()
        try:
            _, rows_copied, _ = get_progress(cctrl, company_id, spec.name)
        finally:
            cctrl.close()
        ok = (src_n == dst_n) and (src_chk == dst_chk)
        all_verified = all_verified and ok
        results.append(TableResult(spec.name, rows_copied, src_n, dst_n, ok))

    if not all_verified:
        failed = [r.table for r in results if not r.verified]
        _mark_failed(control_conn, company_id, f"verification mismatch: {','.join(failed)}")
        raise SwitchOutError(f"switch-out verification failed for {', '.join(failed)}")

    # 3. Atomic cutover — stop connecting to the tenant DB (offboard) ONLY now that
    #    every table is verified on the shared DB. The client DB is never touched.
    (offboard or _default_offboard)(control_conn, company_id)
    cur = control_conn.cursor()
    try:
        cur.execute(
            "UPDATE byod_switchout_jobs SET status = %s, verified_at = %s, "
            "cutover_at = %s, error = NULL, updated_at = now() WHERE company_id = %s",
            (SwitchOutStatus.CUTOVER, now, now, company_id),
        )
    finally:
        cur.close()
    control_conn.commit()

    return SwitchOutResult(
        company_id, SwitchOutStatus.CUTOVER, tables=results, cutover_at=now
    )


def _mark_failed(control_conn, company_id: str, reason: str) -> None:
    try:
        cur = control_conn.cursor()
        try:
            set_job_status(cur, company_id, SwitchOutStatus.FAILED, error=reason)
        finally:
            cur.close()
        control_conn.commit()
    except Exception:
        try:
            control_conn.rollback()
        except Exception:
            pass


def offboard_documented_loss(
    *, company_id: str, control_conn, offboard=None, now: Optional[datetime] = None
) -> SwitchOutResult:
    """Leave BYOD WITHOUT a reverse migration (§16.6): the customer declined, so
    history beyond the shared DB is forfeited (stated in contract). Offboards
    (removes routing + creds) and records DECLINED. The client DB is never touched —
    no tenant connection is even opened here."""
    now = now or datetime.now(timezone.utc)
    cur = control_conn.cursor()
    try:
        ensure_job(cur, company_id)
        set_job_status(cur, company_id, SwitchOutStatus.DECLINED)
    finally:
        cur.close()
    control_conn.commit()
    (offboard or _default_offboard)(control_conn, company_id)
    return SwitchOutResult(company_id, SwitchOutStatus.DECLINED)
