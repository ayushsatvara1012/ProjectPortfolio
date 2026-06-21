"""BYOD idempotent metering: store-then-atomic-usage++ keyed by an idempotency
key, plus an outbox/reconciler (RFC docs/rfc-byod.md Phase 3.3 — rules E1, E2,
§16.1 cross-database consistency).

The problem (§16.1 dual-write): for a BYOD tenant the ``chat_log`` row is written
to the **tenant** database (Phase 3.2) while the authoritative ``usage_tracking``
counter lives on the **control plane**. Two databases, no shared transaction — a
naive "write log, then increment" mis-counts on partial failure or retry. The
rules:

  * **E1 — meter only after a confirmed store, idempotently.** Every message
    carries a unique idempotency key (the engine-generated ``chat_logs.id``). The
    counter is incremented **after** the tenant store is confirmed, keyed by that
    key in a control-plane **ledger** (``byod_usage_ledger``) so a retry can never
    double-count. Usage is **never** derived from tenant row counts (the tenant DB
    is untrusted, §6).
  * **E2 — atomic increment-and-check.** The ledger insert + counter bump happen
    in a **single SQL statement** (data-modifying CTE): the key is inserted
    ``ON CONFLICT DO NOTHING`` and the counter is bumped **iff** the key was newly
    inserted. Concurrent duplicates serialize on the key's row lock → exactly one
    increment; concurrent distinct keys bump the same row without lost updates.
  * **Outbox + reconciler (§16.1).** If the process is killed *after* the tenant
    store but *before* the meter, the ``chat_logs`` row exists with its key but the
    ledger does not. :func:`reconcile_company` compares confirmed stores (tenant
    ``chat_logs.id``) against metered keys (control ``byod_usage_ledger``) and
    applies the missing increments **through the same idempotent path** — repairing
    a counter that lags a confirmed store, never trusting the tenant value to *set*
    the counter.

This module owns ONLY the control-plane side (DDL + the atomic meter + the
reconciler). It is import-light (stdlib + psycopg2 under TYPE_CHECKING) and takes
cursors (the caller owns the transaction / connection acquisition), so it is unit-
testable against an ephemeral control-plane Postgres without the engine.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, List, Optional

from observability import metrics

if TYPE_CHECKING:  # pragma: no cover - typing only
    from psycopg2.extensions import cursor as _Cursor


# Control-plane outbox/dedup ledger: one row per *metered* message. The
# (company_id, idempotency_key) PK is what makes metering idempotent — a second
# attempt with the same key conflicts and increments nothing. Kept strictly ASCII
# (encodes under any client_encoding), mirroring the other control-plane DDL.
LEDGER_TABLE = "byod_usage_ledger"

LEDGER_SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {LEDGER_TABLE} (
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    idempotency_key UUID NOT NULL,
    usage_row_id    UUID,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_byod_usage_ledger_company
    ON {LEDGER_TABLE} (company_id);
""".strip()

LEDGER_SCHEMA_DROP_SQL = f"DROP TABLE IF EXISTS {LEDGER_TABLE};"


@dataclass(frozen=True)
class MeterResult:
    """Outcome of one metering attempt."""

    counted: bool                 # True = newly metered; False = idempotent no-op (key seen)
    messages_used: Optional[int]  # the row's counter after a successful bump (None if not counted)
    usage_row_id: Optional[str]   # the usage_tracking row that was (or would be) bumped
    idempotency_key: str


@dataclass(frozen=True)
class ReconcileResult:
    """Outcome of a reconciliation pass for one company."""

    stored: int    # confirmed stores examined on the tenant DB
    metered: int   # keys already present in the control-plane ledger (before repair)
    repaired: int  # confirmed-but-unmetered stores the reconciler metered this pass


@dataclass(frozen=True)
class UsageSummary:
    """Read-side metering rollup for one company (UI plan Phase 6 / C5).

    Two complementary numbers, both from the **control plane** (never the untrusted
    tenant DB, §6):

      * ``messages_used`` / ``period_*`` — the authoritative billing counter from
        ``usage_tracking`` (the same row the quota gate reads), plus its current
        window. This is what a tenant is billed on.
      * ``ledger_total`` + the rolling windows — derived from the idempotent
        ``byod_usage_ledger`` (one row per metered message, with ``recorded_at``),
        so an operator can watch the cadence of a live tenant's first billing cycle
        and spot a stalled or runaway stream at a glance.
    """

    messages_used: int                 # SUM(usage_tracking.messages_used) — billing counter
    period_start: object               # current window start (datetime | None)
    period_end: object                 # current window end (datetime | None)
    ledger_total: int                  # COUNT(byod_usage_ledger) — metered messages, all time
    last_24h: int                      # metered in the trailing 24h
    last_7d: int                       # metered in the trailing 7d
    last_30d: int                      # metered in the trailing 30d
    last_metered_at: object            # most recent metered message (datetime | None)


def summarize_company_usage(cur: "_Cursor", company_id: str) -> UsageSummary:
    """Roll up a company's metering for the admin usage panel (UI plan Phase 6).

    Reads only the control plane: the authoritative ``usage_tracking`` counter +
    window, and the idempotent ``byod_usage_ledger`` for all-time and trailing-window
    message counts (the ledger carries ``recorded_at`` per metered message). Returns
    zeros / ``None`` for a company that has never been metered. Read-only — the caller
    need not commit. Never trusts the tenant DB for counts (§6 / E1)."""
    # Billing counter + current window. SUM across rows (a company can accrue more
    # than one usage_tracking row over time — the quota gate sums them too); the
    # window comes from the most recent row so it reflects the live cycle.
    cur.execute(
        """
        SELECT COALESCE(SUM(messages_used), 0) AS messages_used,
               (SELECT period_start FROM usage_tracking
                 WHERE company_id = %s ORDER BY period_end DESC NULLS LAST LIMIT 1) AS period_start,
               (SELECT period_end FROM usage_tracking
                 WHERE company_id = %s ORDER BY period_end DESC NULLS LAST LIMIT 1) AS period_end
          FROM usage_tracking
         WHERE company_id = %s
        """,
        (company_id, company_id, company_id),
    )
    messages_used, period_start, period_end = cur.fetchone()

    # Per-message ledger: all-time total + trailing windows + last-metered, in one
    # pass via FILTER aggregates. Empty ledger → all zeros, last_metered_at NULL.
    cur.execute(
        f"""
        SELECT count(*) AS total,
               count(*) FILTER (WHERE recorded_at >= now() - interval '24 hours') AS last_24h,
               count(*) FILTER (WHERE recorded_at >= now() - interval '7 days')   AS last_7d,
               count(*) FILTER (WHERE recorded_at >= now() - interval '30 days')  AS last_30d,
               max(recorded_at) AS last_metered_at
          FROM {LEDGER_TABLE}
         WHERE company_id = %s
        """,
        (company_id,),
    )
    total, last_24h, last_7d, last_30d, last_metered_at = cur.fetchone()

    return UsageSummary(
        messages_used=int(messages_used or 0),
        period_start=period_start,
        period_end=period_end,
        ledger_total=int(total or 0),
        last_24h=int(last_24h or 0),
        last_7d=int(last_7d or 0),
        last_30d=int(last_30d or 0),
        last_metered_at=last_metered_at,
    )


def _resolve_usage_row(cur: "_Cursor", company_id: str, user_id: Optional[str]) -> str:
    """Return the current-period ``usage_tracking`` row id for a company, creating
    one if none exists.

    Racing creators are harmless: the engine's quota gate reads ``SUM(messages_used)``
    across all of a company's rows, so an extra row never loses a count."""
    cur.execute(
        "SELECT id FROM usage_tracking WHERE company_id = %s "
        "ORDER BY period_end DESC NULLS LAST LIMIT 1",
        (company_id,),
    )
    row = cur.fetchone()
    if row is not None:
        return str(row[0])
    cur.execute(
        "INSERT INTO usage_tracking (user_id, company_id, messages_used, period_start, period_end) "
        "VALUES (%s, %s, 0, now(), now() + interval '30 days') RETURNING id",
        (user_id, company_id),
    )
    return str(cur.fetchone()[0])


def record_message_and_meter(
    cur: "_Cursor",
    *,
    company_id: str,
    idempotency_key: str,
    user_id: Optional[str] = None,
    usage_row_id: Optional[str] = None,
) -> MeterResult:
    """Atomically record a message key and increment usage **once** (E1, E2).

    Call this ONLY after the tenant-DB ``chat_log`` store is confirmed (§16.1).
    Idempotent: a repeat with the same ``(company_id, idempotency_key)`` increments
    nothing and returns ``counted=False``. The caller owns the transaction (commit
    after). Does not raise on a duplicate — that is the whole point."""
    row_id = usage_row_id or _resolve_usage_row(cur, company_id, user_id)
    # Single statement: insert the key (idempotent) and bump the counter iff the
    # key was newly inserted. The final SELECT reports both outcomes.
    cur.execute(
        f"""
        WITH new_key AS (
            INSERT INTO {LEDGER_TABLE} (company_id, idempotency_key, usage_row_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (company_id, idempotency_key) DO NOTHING
            RETURNING idempotency_key
        ),
        bumped AS (
            UPDATE usage_tracking
               SET messages_used = messages_used + 1
             WHERE id = %s AND EXISTS (SELECT 1 FROM new_key)
            RETURNING messages_used
        )
        SELECT (SELECT count(*) FROM new_key) AS inserted,
               (SELECT messages_used FROM bumped) AS messages_used
        """,
        (company_id, idempotency_key, row_id, row_id),
    )
    inserted, messages_used = cur.fetchone()
    if not inserted:
        # §16.9 idempotency-key replay: the key was already seen → no double-meter.
        metrics.idempotent_replay(company_id)
    return MeterResult(
        counted=bool(inserted),
        messages_used=messages_used,
        usage_row_id=row_id,
        idempotency_key=idempotency_key,
    )


def reconcile_company(
    control_cur: "_Cursor",
    tenant_cur: "_Cursor",
    company_id: str,
    *,
    user_id: Optional[str] = None,
    limit: int = 10_000,
) -> ReconcileResult:
    """Repair a counter that lags confirmed tenant stores (§16.1 outbox/reconciler).

    Compares confirmed stores (tenant ``chat_logs.id``) against metered keys
    (control ``byod_usage_ledger``) and meters the difference through the same
    idempotent path — so a message stored-but-not-metered (e.g. a crash between the
    two writes) is counted exactly once. **Never** decrements and **never** trusts
    the tenant value to *set* the counter; it only applies missing increments. The
    caller owns the transaction and supplies the tenant cursor (acquired via
    ``get_tenant_db`` in production). ``limit`` bounds the tenant scan per pass."""
    control_cur.execute(
        f"SELECT idempotency_key FROM {LEDGER_TABLE} WHERE company_id = %s",
        (company_id,),
    )
    metered = {str(r[0]) for r in control_cur.fetchall()}

    tenant_cur.execute(
        "SELECT id FROM chat_logs WHERE company_id = %s ORDER BY created_at DESC LIMIT %s",
        (company_id, limit),
    )
    stored: List[str] = [str(r[0]) for r in tenant_cur.fetchall()]

    repaired = 0
    for key in stored:
        if key in metered:
            continue
        result = record_message_and_meter(
            control_cur, company_id=company_id, idempotency_key=key, user_id=user_id
        )
        if result.counted:
            repaired += 1
            metered.add(key)  # guard against duplicate ids within the same scan
    return ReconcileResult(stored=len(stored), metered=len(metered) - repaired, repaired=repaired)
