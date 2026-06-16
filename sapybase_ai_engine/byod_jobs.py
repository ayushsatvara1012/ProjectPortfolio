"""BYOD background-job batch runner — bounded concurrency, failure isolation.

RFC docs/rfc-byod.md Phase 5.1 (rule E9 / §16.4): the scheduled jobs that loop
over **many** tenant databases outside the request path — ``weekly_digest``,
``lead_alerts``, attribution recompute, the ``CRON_SECRET`` jobs — MUST route
tenant data access through ``get_tenant_db`` + the per-tenant circuit breaker,
run under **bounded concurrency**, **skip open-breaker tenants** (retry later),
and **isolate per-tenant failures** so one slow or broken client DB never aborts
the batch or starves the others.

This module is the generic, I/O-free engine for that contract: it owns the
fan-out (a bounded thread pool), the skip predicate, and per-item exception
isolation. It does NOT know what a "job" does — the caller passes a ``worker``
callable that performs one tenant's work (e.g. fetch this week's leads from the
tenant DB and email the digest). Because the runner is pure scheduling logic with
injectable workers/predicates, it is fully unit-testable without a database: a
fake worker that sleeps proves the concurrency is bounded (throttles), and a fake
worker that raises proves failures are isolated and the batch still completes.

The jobs themselves are sync (FastAPI runs ``def`` endpoints in a threadpool) and
the tenant pool registry is threading-based, so the fan-out uses a
``ThreadPoolExecutor`` — one slow remote DB occupies one worker slot, never the
whole batch.
"""
from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, List, Optional, Sequence

logger = logging.getLogger(__name__)

# Default fan-out width. Kept modest on purpose: every concurrent worker may hold
# one control-plane connection (for its own bookkeeping write) on top of one
# bounded tenant-pool connection, and the shared control pool is small and shared
# with live traffic. Override with BYOD_BATCH_MAX_CONCURRENCY. Tune up only with
# headroom in both the control pool and each tenant's max_connections (§16.3).
DEFAULT_MAX_CONCURRENCY = 4


def max_concurrency_from_env(default: int = DEFAULT_MAX_CONCURRENCY) -> int:
    """Read ``BYOD_BATCH_MAX_CONCURRENCY`` (positive int), falling back to
    ``default`` on unset/invalid so a bad value can never wedge a cron run."""
    raw = os.getenv("BYOD_BATCH_MAX_CONCURRENCY")
    if not raw:
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        logger.warning("Invalid BYOD_BATCH_MAX_CONCURRENCY=%r; using %d", raw, default)
        return default
    return value if value > 0 else default


@dataclass(frozen=True)
class BatchOutcome:
    """The result of attempting one tenant's work.

    Exactly one of the three terminal shapes holds:
      * ``skipped`` — the skip predicate excluded this tenant (e.g. its circuit
        breaker is OPEN); no worker ran, retry on the next batch.
      * ``ok`` — the worker returned; ``value`` is its return (e.g. ``"sent"``).
      * neither (``ok`` False, not skipped) — the worker raised; ``error`` is a
        SANITIZED reason (E6), never raw driver/DSN text.
    """

    company_id: Any
    ok: bool = False
    skipped: bool = False
    value: Any = None
    error: Optional[str] = None


@dataclass(frozen=True)
class BatchReport:
    """Aggregate of a batch run. ``total`` == succeeded + failed + skipped."""

    total: int
    succeeded: int
    failed: int
    skipped: int
    outcomes: List[BatchOutcome] = field(default_factory=list)


def _default_sanitize(exc: BaseException) -> str:
    """Fallback E6 sanitizer: the exception class name only, never ``str(exc)``
    (which may carry host/DSN/schema). Callers should pass
    ``byod_engine.sanitize_db_error`` to classify tenant-DB failures precisely."""
    return type(exc).__name__


def run_tenant_batch(
    company_ids: Iterable[Any],
    worker: Callable[[Any], Any],
    *,
    max_concurrency: int = DEFAULT_MAX_CONCURRENCY,
    skip: Optional[Callable[[Any], bool]] = None,
    sanitize: Callable[[BaseException], str] = _default_sanitize,
) -> BatchReport:
    """Run ``worker(company_id)`` for each tenant under bounded concurrency (E9).

    Contract (RFC §16.4):
      * **Bounded concurrency / throttle** — at most ``max_concurrency`` workers
        run at once, so a fleet of slow tenant DBs cannot exhaust capacity.
      * **Skip open-breaker tenants** — ``skip(company_id)`` is consulted BEFORE
        submitting any work; a True result records a ``skipped`` outcome and runs
        no worker (the breaker fast-fails it for free; retry next batch).
      * **Failure isolation** — a worker raising ANY exception is caught,
        sanitized, and recorded as a failed outcome; the batch keeps going. One
        bad tenant never aborts the run or affects another tenant's outcome.

    ``worker`` runs on a pool thread, so it MUST acquire/release its own
    connections (the control pool's ``ThreadedConnectionPool`` is thread-safe;
    tenant access goes through ``byod_engine.tenant_connection``). Returns a
    :class:`BatchReport`; raises nothing for per-tenant failures.
    """
    ids: List[Any] = list(company_ids)
    outcomes: List[BatchOutcome] = []
    to_run: List[Any] = []

    for cid in ids:
        if skip is not None:
            try:
                if skip(cid):
                    outcomes.append(BatchOutcome(cid, skipped=True))
                    continue
            except Exception:  # a flaky predicate must not drop the tenant
                logger.debug("BYOD batch skip predicate errored for %s; not skipping", cid)
        to_run.append(cid)

    if to_run:
        workers = max(1, min(max_concurrency, len(to_run)))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(worker, cid): cid for cid in to_run}
            for future in as_completed(futures):
                cid = futures[future]
                try:
                    result = future.result()
                    outcomes.append(BatchOutcome(cid, ok=True, value=result))
                except Exception as exc:  # isolate — one bad tenant never aborts
                    reason = sanitize(exc)
                    logger.warning("BYOD batch worker failed: company=%s reason=%s", cid, reason)
                    outcomes.append(BatchOutcome(cid, error=reason))

    succeeded = sum(1 for o in outcomes if o.ok)
    skipped = sum(1 for o in outcomes if o.skipped)
    failed = len(outcomes) - succeeded - skipped
    return BatchReport(
        total=len(ids),
        succeeded=succeeded,
        failed=failed,
        skipped=skipped,
        outcomes=outcomes,
    )
