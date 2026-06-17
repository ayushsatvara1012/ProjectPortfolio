"""BYOD switch-IN data migration: move a tenant's existing rows from the shared
Sapybase DB into the client's own BYO database (RFC docs/rfc-byod.md Phase 7.1;
§4.2, rule 17, §16.1 idempotency).

Switching a customer from a shared-DB plan onto BYOD is the only genuinely new
data-movement problem in the design: that tenant's knowledge vectors, chat history,
and leads already live on Sapybase's shared Postgres and must be relocated into the
freshly-provisioned tenant DB. Per rule 17 this move MUST be:

  * **Idempotent + checkpointed (resumable).** Each table is copied in batches
    ordered by primary key; the last copied id is checkpointed on the control plane
    after every batch, and every INSERT is ``ON CONFLICT (id) DO NOTHING``. A run
    that dies mid-copy resumes from the last checkpoint and re-applying a
    partially-committed batch is a no-op — never a duplicate, never a double count.
  * **Checksum + row-count verified.** After copying, every table's row count AND a
    content checksum are compared between source (shared) and destination (tenant);
    a mismatch fails the switch-in without cutting over.
  * **Atomic cutover only after verification.** The control-plane cutover marker
    (``byod_switchin_jobs.cutover_at``) is set ONLY once every table verifies — so
    the tenant DB is never declared authoritative on an incomplete/corrupt copy.
  * **7-day retention then purge.** At cutover a ``retain_until`` (default now+7d,
    ``BYOD_SWITCHIN_RETENTION_DAYS``) is recorded; the shared copy is kept for a
    rollback window and only then purged (:func:`purge_shared_copy`). The client's
    own DB is of course never touched by the purge.

This module is cursor/connection-injectable and imports neither main.py nor the
pool — so it is unit-testable against throwaway shared + tenant Postgres DBs. The
destination is written with the privileged **migrate** connection (a one-time
admin bulk import, like provisioning), not the request-path runtime role.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# All-zero UUID: a lower bound below any gen_random_uuid() value, used as the
# "start from the beginning" checkpoint sentinel so the batch read can always use
# a uniform ``id > %s`` predicate.
_ZERO_UUID = "00000000-0000-0000-0000-000000000000"

DEFAULT_BATCH_SIZE = int(os.getenv("BYOD_SWITCHIN_BATCH_SIZE", "500"))
RETENTION_DAYS = int(os.getenv("BYOD_SWITCHIN_RETENTION_DAYS", "7"))


class SwitchInStatus:
    PENDING = "PENDING"
    COPYING = "COPYING"
    VERIFYING = "VERIFYING"
    VERIFIED = "VERIFIED"
    CUTOVER = "CUTOVER"      # verified + tenant DB declared authoritative
    FAILED = "FAILED"
    PURGED = "PURGED"        # shared copy deleted after the retention window


SWITCHIN_STATUSES = frozenset(
    {
        SwitchInStatus.PENDING,
        SwitchInStatus.COPYING,
        SwitchInStatus.VERIFYING,
        SwitchInStatus.VERIFIED,
        SwitchInStatus.CUTOVER,
        SwitchInStatus.FAILED,
        SwitchInStatus.PURGED,
    }
)


class SwitchInError(Exception):
    """A switch-in failed. Message is sanitized (E6) — no DSN/host/driver text."""


@dataclass(frozen=True)
class TableSpec:
    """How to copy + verify one data-plane table.

    ``columns`` is the full INSERT column list (``columns[0]`` MUST be the pk).
    ``select_overrides`` maps a column to a read expression (e.g. cast the
    ``vector`` embedding to ``::text`` for a driver-independent round-trip), and
    ``insert_template`` is the matching execute_values VALUES template (casting it
    back, e.g. ``%s::vector``). ``checksum_columns`` is the stable subset hashed for
    verification — deliberately excludes the float/vector embedding whose text
    representation is not guaranteed identical across Postgres builds; row-count +
    a content hash of the stable columns is the verification signal."""

    name: str
    columns: Tuple[str, ...]
    checksum_columns: Tuple[str, ...]
    select_overrides: Dict[str, str] = field(default_factory=dict)
    insert_template: Optional[str] = None
    pk: str = "id"

    def select_exprs(self) -> str:
        return ", ".join(self.select_overrides.get(c, c) for c in self.columns)


# The A.7 data-plane trio (byod_dataplane.DATA_PLANE_SCHEMA_SQL). content_tsv is a
# GENERATED column and is intentionally NOT copied (Postgres maintains it).
SWITCHIN_TABLES: Tuple[TableSpec, ...] = (
    TableSpec(
        name="company_knowledge",
        columns=(
            "id", "company_id", "url", "content", "embedding",
            "created_at", "chunk_type", "parent_id",
        ),
        checksum_columns=("id", "url", "content", "chunk_type", "parent_id"),
        select_overrides={"embedding": "embedding::text"},
        insert_template="(%s, %s, %s, %s, %s::vector, %s, %s, %s)",
    ),
    TableSpec(
        name="chat_logs",
        columns=(
            "id", "company_id", "user_query", "bot_response", "was_cache_hit",
            "is_unanswered", "session_id", "confidence", "created_at",
        ),
        checksum_columns=("id", "user_query", "bot_response", "session_id"),
    ),
    TableSpec(
        name="lead_capture",
        columns=(
            "id", "company_id", "email", "name", "context", "score", "score_band",
            "score_reasons", "page_url", "referrer", "utm_source", "utm_medium",
            "utm_campaign", "status", "value_usd", "status_updated_at", "created_at",
        ),
        checksum_columns=("id", "email", "context", "score", "status"),
    ),
)


# ── Control-plane state: job + per-table checkpoints (§16.1 outbox-style) ─────────
CONTROL_PLANE_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS byod_switchin_jobs (
    company_id   UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','COPYING','VERIFYING','VERIFIED',
                                   'CUTOVER','FAILED','PURGED')),
    started_at   TIMESTAMPTZ DEFAULT now(),
    verified_at  TIMESTAMPTZ,
    cutover_at   TIMESTAMPTZ,
    retain_until TIMESTAMPTZ,
    purged_at    TIMESTAMPTZ,
    error        TEXT,
    updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS byod_switchin_progress (
    company_id   UUID NOT NULL
                 REFERENCES byod_switchin_jobs(company_id) ON DELETE CASCADE,
    table_name   TEXT NOT NULL,
    last_id      UUID,
    rows_copied  BIGINT NOT NULL DEFAULT 0,
    completed    BOOLEAN NOT NULL DEFAULT false,
    updated_at   TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (company_id, table_name)
);
""".strip()

CONTROL_PLANE_SCHEMA_DROP_SQL = (
    "DROP TABLE IF EXISTS byod_switchin_progress;\n"
    "DROP TABLE IF EXISTS byod_switchin_jobs;"
)


# ── Per-table result + overall result ────────────────────────────────────────────
@dataclass(frozen=True)
class TableResult:
    table: str
    rows_copied: int
    source_count: int
    dest_count: int
    verified: bool


@dataclass(frozen=True)
class SwitchInResult:
    company_id: str
    status: str
    tables: List[TableResult] = field(default_factory=list)
    cutover_at: Optional[datetime] = None
    retain_until: Optional[datetime] = None


# ── Job / progress accessors (cursor-taking; caller owns the txn) ─────────────────
def ensure_job(cur, company_id: str) -> str:
    """Create the job row if absent; return its current status."""
    cur.execute(
        "INSERT INTO byod_switchin_jobs (company_id) VALUES (%s) "
        "ON CONFLICT (company_id) DO NOTHING",
        (company_id,),
    )
    cur.execute(
        "SELECT status FROM byod_switchin_jobs WHERE company_id = %s", (company_id,)
    )
    return cur.fetchone()[0]


def set_job_status(cur, company_id: str, status: str, *, error: Optional[str] = None) -> None:
    if status not in SWITCHIN_STATUSES:
        raise ValueError(f"invalid switch-in status {status!r}")
    cur.execute(
        "UPDATE byod_switchin_jobs SET status = %s, error = %s, updated_at = now() "
        "WHERE company_id = %s",
        (status, error, company_id),
    )


def get_progress(cur, company_id: str, table: str) -> Tuple[Optional[str], int, bool]:
    """Return ``(last_id, rows_copied, completed)`` for a table (defaults if new)."""
    cur.execute(
        "SELECT last_id, rows_copied, completed FROM byod_switchin_progress "
        "WHERE company_id = %s AND table_name = %s",
        (company_id, table),
    )
    row = cur.fetchone()
    if not row:
        return (None, 0, False)
    return (str(row[0]) if row[0] is not None else None, int(row[1]), bool(row[2]))


def _save_progress(
    cur, company_id: str, table: str, last_id: str, rows_copied: int, completed: bool
) -> None:
    cur.execute(
        """
        INSERT INTO byod_switchin_progress
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


# ── Copy + verify primitives ─────────────────────────────────────────────────────
def _read_batch(source_cur, company_id: str, spec: TableSpec, after_id: str, batch_size: int):
    source_cur.execute(
        f"SELECT {spec.select_exprs()} FROM {spec.name} "
        f"WHERE company_id = %s AND {spec.pk} > %s ORDER BY {spec.pk} LIMIT %s",
        (company_id, after_id, batch_size),
    )
    return source_cur.fetchall()


def _insert_batch(dest_cur, spec: TableSpec, rows) -> None:
    from psycopg2.extras import execute_values  # lazy

    cols = ", ".join(spec.columns)
    sql = (
        f"INSERT INTO {spec.name} ({cols}) VALUES %s "
        f"ON CONFLICT ({spec.pk}) DO NOTHING"
    )
    execute_values(dest_cur, sql, rows, template=spec.insert_template)


def table_checksum(cur, company_id: str, spec: TableSpec) -> Tuple[int, str]:
    """``(row_count, content_checksum)`` for one company's rows in ``spec``.

    The checksum is an order-independent-by-pk hash over the stable
    ``checksum_columns`` so source and destination can be compared after a copy."""
    ccols = ", ".join(spec.checksum_columns)
    cur.execute(
        f"SELECT count(*), "
        f"  coalesce(md5(string_agg(md5(ROW({ccols})::text), '' ORDER BY {spec.pk})), '') "
        f"FROM {spec.name} WHERE company_id = %s",
        (company_id,),
    )
    n, chk = cur.fetchone()
    return (int(n), chk or "")


def _copy_table(
    source_conn, dest_conn, control_conn, company_id: str, spec: TableSpec,
    *, batch_size: int, fault=None,
) -> int:
    """Copy one table in checkpointed batches; return total rows copied this run.

    Commits the destination batch BEFORE the control-plane checkpoint, so a crash
    in between re-applies the (already-stored) batch on resume as a no-op
    (ON CONFLICT DO NOTHING) — never a duplicate."""
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
        scur = source_conn.cursor()
        try:
            rows = _read_batch(scur, company_id, spec, after, batch_size)
        finally:
            scur.close()
        if not rows:
            break
        dcur = dest_conn.cursor()
        try:
            _insert_batch(dcur, spec, rows)
        finally:
            dcur.close()
        dest_conn.commit()  # destination durable BEFORE we checkpoint
        if fault is not None:
            fault(spec.name, batch_index)  # test seam: simulate a crash here
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
    # Mark the table done (idempotent on re-run).
    cctrl = control_conn.cursor()
    try:
        _save_progress(cctrl, company_id, spec.name, after, rows_copied, True)
    finally:
        cctrl.close()
    control_conn.commit()
    return copied_this_run


# ── Orchestrator ─────────────────────────────────────────────────────────────────
def run_switchin(
    *,
    company_id: str,
    source_conn,
    dest_conn,
    control_conn,
    tables: Tuple[TableSpec, ...] = SWITCHIN_TABLES,
    batch_size: int = DEFAULT_BATCH_SIZE,
    now: Optional[datetime] = None,
    retention_days: int = RETENTION_DAYS,
    fault=None,
) -> SwitchInResult:
    """Run (or resume) the shared->tenant switch-in for ``company_id``.

    Resumable + idempotent: re-invoking continues from the last per-table
    checkpoint and short-circuits if the job already cut over. Verifies every table
    (count + checksum) and performs the atomic cutover ONLY if all verify; otherwise
    marks the job FAILED and raises :class:`SwitchInError`. ``source_conn`` and
    ``control_conn`` are the shared control-plane DB (may be the same connection);
    ``dest_conn`` is the tenant DB (migrate role). ``fault`` is an internal test
    seam invoked mid-copy."""
    now = now or datetime.now(timezone.utc)

    cur = control_conn.cursor()
    try:
        status = ensure_job(cur, company_id)
        if status in (SwitchInStatus.CUTOVER, SwitchInStatus.PURGED):
            # Already authoritative on the tenant DB — idempotent no-op.
            cur.execute(
                "SELECT cutover_at, retain_until FROM byod_switchin_jobs "
                "WHERE company_id = %s",
                (company_id,),
            )
            cutover_at, retain_until = cur.fetchone()
            control_conn.commit()
            return SwitchInResult(
                company_id, status, cutover_at=cutover_at, retain_until=retain_until
            )
        set_job_status(cur, company_id, SwitchInStatus.COPYING)
    finally:
        cur.close()
    control_conn.commit()

    # 1. Copy every table in checkpointed batches (resumable).
    try:
        for spec in tables:
            _copy_table(
                source_conn, dest_conn, control_conn, company_id, spec,
                batch_size=batch_size, fault=fault,
            )
    except SwitchInError:
        raise
    except Exception as exc:
        # Leave the committed checkpoints intact so a later run resumes; surface a
        # sanitized error (E6) — never the raw driver/DSN text.
        _mark_failed(control_conn, company_id, f"copy failed ({type(exc).__name__})")
        raise SwitchInError(f"switch-in copy failed ({type(exc).__name__})") from exc

    # 2. Verify each table: row count AND content checksum, source vs destination.
    cur = control_conn.cursor()
    try:
        set_job_status(cur, company_id, SwitchInStatus.VERIFYING)
    finally:
        cur.close()
    control_conn.commit()

    results: List[TableResult] = []
    all_verified = True
    for spec in tables:
        scur = source_conn.cursor()
        try:
            src_n, src_chk = table_checksum(scur, company_id, spec)
        finally:
            scur.close()
        dcur = dest_conn.cursor()
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
        raise SwitchInError(f"switch-in verification failed for {', '.join(failed)}")

    # 3. Atomic cutover — ONLY now that every table is verified.
    retain_until = now + timedelta(days=retention_days)
    cur = control_conn.cursor()
    try:
        cur.execute(
            "UPDATE byod_switchin_jobs SET status = %s, verified_at = %s, "
            "cutover_at = %s, retain_until = %s, error = NULL, updated_at = now() "
            "WHERE company_id = %s",
            (SwitchInStatus.CUTOVER, now, now, retain_until, company_id),
        )
    finally:
        cur.close()
    control_conn.commit()

    return SwitchInResult(
        company_id, SwitchInStatus.CUTOVER, tables=results,
        cutover_at=now, retain_until=retain_until,
    )


def _mark_failed(control_conn, company_id: str, reason: str) -> None:
    try:
        cur = control_conn.cursor()
        try:
            set_job_status(cur, company_id, SwitchInStatus.FAILED, error=reason)
        finally:
            cur.close()
        control_conn.commit()
    except Exception:  # never let the failure-marker mask the original error
        try:
            control_conn.rollback()
        except Exception:
            pass


# ── Retention / purge (the 7-day rollback window) ────────────────────────────────
def list_purgeable(cur, now: Optional[datetime] = None) -> List[str]:
    """company_ids whose retention window has elapsed and can be purged."""
    now = now or datetime.now(timezone.utc)
    cur.execute(
        "SELECT company_id::text FROM byod_switchin_jobs "
        "WHERE status = %s AND retain_until IS NOT NULL AND retain_until <= %s "
        "ORDER BY company_id",
        (SwitchInStatus.CUTOVER, now),
    )
    return [r[0] for r in cur.fetchall()]


def purge_shared_copy(
    control_conn,
    source_conn,
    company_id: str,
    *,
    tables: Tuple[TableSpec, ...] = SWITCHIN_TABLES,
    now: Optional[datetime] = None,
) -> bool:
    """Delete the company's rows from the SHARED DB after the retention window.

    No-op (returns False) unless the job is CUTOVER and ``retain_until`` has passed
    — so the 7-day rollback copy is never deleted early. Touches only the shared
    control-plane DB; the client's own database is never modified here. Returns True
    if the shared copy was purged."""
    now = now or datetime.now(timezone.utc)
    cur = control_conn.cursor()
    try:
        cur.execute(
            "SELECT status, retain_until FROM byod_switchin_jobs WHERE company_id = %s",
            (company_id,),
        )
        row = cur.fetchone()
        if not row:
            return False
        status, retain_until = row
        if status != SwitchInStatus.CUTOVER:
            return False
        if retain_until is None or now < retain_until:
            return False  # still inside the rollback window
    finally:
        cur.close()

    # Delete the shared copy table by table (source == control-plane DB in prod).
    scur = source_conn.cursor()
    try:
        for spec in tables:
            scur.execute(f"DELETE FROM {spec.name} WHERE company_id = %s", (company_id,))
    finally:
        scur.close()
    source_conn.commit()

    cur = control_conn.cursor()
    try:
        cur.execute(
            "UPDATE byod_switchin_jobs SET status = %s, purged_at = %s, updated_at = now() "
            "WHERE company_id = %s",
            (SwitchInStatus.PURGED, now, company_id),
        )
    finally:
        cur.close()
    control_conn.commit()
    return True
