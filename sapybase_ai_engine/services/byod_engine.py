"""BYOD engine cutover: route /api/chat data-plane traffic to the tenant DB.

RFC docs/rfc-byod.md Phase 3.2 (route the RAG read + chat_log write through
``get_tenant_db``; output validation E3 + error sanitization E6; §16.2 hostile
tenant DB). This module is the seam between the engine request path (main.py) and
the per-tenant pool registry (``byod_pool``):

  * **Routing gate.** :func:`routing_active` is the single switch the chat path
    consults. It is the dark rollout flag (``byod_flags.byo_database_active``) —
    OFF by default, so with no env configuration the shared-DB path is
    byte-for-byte unchanged (RFC §13 delivery principle).
  * **Tenant connection.** :func:`tenant_connection` is a context manager over
    ``TenantPoolRegistry.get_tenant_db`` (rule 1): per-tenant bounded pool +
    breaker + statement timeout, the **vaayu_runtime** (DML-only) role via the
    runtime DSN, connection tagged + asserted to the company_id (E5). Every
    failure mode — pool ceiling, busy bulkhead, open breaker, routing mismatch,
    raw driver error — is converted to a **sanitized** :class:`TenantDataError`
    (E6); the DSN/host/driver text never reaches a log or the client.
  * **Output validation (E3).** :func:`validate_knowledge_rows` defends against a
    hostile/corrupt tenant DB: NULL, oversized, or wrong-typed rows are **skipped,
    never crash a worker** (§16.2).
  * **Tenant chat_log write.** :func:`tenant_log_chat` writes the conversation log
    to the tenant DB and **degrades soft** on failure (§16.9 read-only/in-recovery
    → skip the write, alert) — analytics for one tenant is never worth a 500.

The control-plane accessors (a connection to read the encrypted runtime DSN, the
KMS provider) are injected via :func:`configure` at startup, so this module does
NOT import main.py (main.py imports this one). The pool registry is a lazy
process singleton; both it and the connection helpers are injectable so the whole
module is testable against a throwaway tenant Postgres without the control plane.
"""
from __future__ import annotations

import logging
import threading
from contextlib import contextmanager
from typing import Callable, Iterator, List, Optional, Sequence, Tuple

from db import byod_dsn_cache
import byod_flags
import byod_routing_cache
from db import byod_schema
from db import byod_store
from observability import metrics
from byod_breaker import BreakerConfig, BreakerOpen
from core.byod_crypto import load_decrypted_runtime_dsn
from byod_dsn import DsnValidationError, validate_db_url
from db.byod_pool import (
    PoolConfig,
    PoolRegistryError,
    TenantPoolRegistry,
    psycopg2_pool_factory,
)

logger = logging.getLogger(__name__)


# ── Errors ─────────────────────────────────────────────────────────────────────
class TenantDataError(Exception):
    """A tenant data-plane access failed. The message is ALWAYS sanitized (E6) —
    it never carries the DSN, host, schema, or raw driver text. ``reason`` is a
    short, log-safe classifier."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class TenantNotProvisioned(TenantDataError):
    """The tenant has no usable runtime DSN yet (not provisioned / no LIVE creds)."""

    def __init__(self) -> None:
        super().__init__("tenant has no runtime database configured")


# ── E3: output validation (the tenant DB is untrusted, §16.2) ────────────────────
# A single knowledge chunk over this many characters is treated as malformed and
# skipped — a defensive cap against a hostile/corrupt row (e.g. a multi-GB blob
# pasted into `content`) OOMing a worker. Generous vs legitimate parent chunks.
MAX_KNOWLEDGE_CONTENT_CHARS = 100_000
# URLs are display-only metadata; truncate rather than skip a row for an oversized
# one (a bad URL must not drop an otherwise-good answer chunk).
MAX_URL_CHARS = 2_048

KnowledgeRow = Tuple[Optional[str], Optional[str]]


def validate_knowledge_rows(rows: Optional[Sequence[Sequence]]) -> List[KnowledgeRow]:
    """Filter RAG rows ``(content, url)`` from the tenant DB defensively (E3).

    Skips rows whose content is NULL, the wrong type, empty, or oversized — never
    raises on a malformed row (§16.2: malformed rows are skipped, not fatal). URL
    is coerced to a clean str-or-None and truncated. Preserves the ``(content,
    url)`` tuple shape the chat path already consumes."""
    if not rows:
        return []
    valid: List[KnowledgeRow] = []
    skipped = 0
    for row in rows:
        try:
            content = row[0]
            url = row[1] if len(row) > 1 else None
        except (TypeError, IndexError):
            skipped += 1
            continue
        if not isinstance(content, str) or not content.strip():
            skipped += 1
            continue
        if len(content) > MAX_KNOWLEDGE_CONTENT_CHARS:
            skipped += 1
            continue
        if url is not None:
            if not isinstance(url, str):
                url = None
            elif len(url) > MAX_URL_CHARS:
                url = url[:MAX_URL_CHARS]
        valid.append((content, url))
    if skipped:
        logger.warning("BYOD knowledge rows skipped (malformed/oversized): count=%d", skipped)
    return valid


# ── E6: error sanitization ───────────────────────────────────────────────────────
def sanitize_db_error(exc: BaseException) -> str:
    """Map any tenant-DB exception to a short, log-safe reason string (E6).

    NEVER returns ``str(exc)`` for a raw driver error — that can carry host,
    schema, or DSN fragments. Our own already-sanitized errors pass their reason
    through; everything else collapses to a generic message + the exception class
    name only."""
    if isinstance(exc, TenantDataError):
        return exc.reason
    if isinstance(exc, BreakerOpen):
        return "tenant database temporarily unavailable (circuit open)"
    if isinstance(exc, PoolRegistryError):
        # CeilingExceeded / TenantBusy / RoutingIntegrityError — backpressure or a
        # routing abort; the class name is safe, the message may name the tenant.
        return f"tenant pool unavailable ({type(exc).__name__})"
    if isinstance(exc, DsnValidationError):
        return "tenant connection string failed validation"
    return f"tenant database error ({type(exc).__name__})"


# ── Routing gate (Phase 3: DB-driven on/off, no redeploy) ───────────────────────
def _read_routing_decision(company_id: str) -> "byod_routing_cache.RoutingDecision":
    """Read ``(status, routing_enabled)`` from the control plane for the hot path.

    Fail-SAFE (never fail-open): if the engine is unconfigured or the control plane
    is unreachable, return a not-routed decision so the tenant stays on the shared
    path — a routing read must never open a tenant DB on a guess. Caches the result
    (including the negative "no row") via the caller."""
    no_row = byod_routing_cache.RoutingDecision(status=None, routing_enabled=False)
    if _Deps.control_conn_factory is None:
        return no_row
    try:
        conn = _Deps.control_conn_factory()
    except Exception as exc:  # control plane unreachable → fail closed to shared DB
        logger.warning("BYOD routing read degraded: company=%s reason=%s", company_id, sanitize_db_error(exc))
        return no_row
    try:
        cur = conn.cursor()
        try:
            fields = byod_store.get_routing_fields(cur, company_id)
        finally:
            cur.close()
        if fields is None:
            return no_row
        return byod_routing_cache.RoutingDecision(status=fields[0], routing_enabled=bool(fields[1]))
    except Exception as exc:
        logger.warning("BYOD routing read degraded: company=%s reason=%s", company_id, sanitize_db_error(exc))
        return no_row
    finally:
        if _Deps.control_conn_release is not None:
            _Deps.control_conn_release(conn)


def _routing_decision(company_id: str) -> "byod_routing_cache.RoutingDecision":
    """Cached ``(status, routing_enabled)`` lookup — one control-plane read per
    company per TTL (negatives cached too, so non-BYOD companies don't hit the DB
    every request)."""
    cache = byod_routing_cache.get_routing_cache()
    cached = cache.get(company_id)
    if cached is not None:
        return cached
    decision = _read_routing_decision(company_id)
    cache.put(company_id, decision)
    return decision


def routing_active(company_id: object) -> bool:
    """Whether this request's data plane should be the tenant's own DB.

    Phase 3 rule (UI plan §2.1): route iff
      ``BYOD_ENABLED`` (env, global kill) AND ``status == LIVE`` AND
      (``routing_enabled`` OR the tenant is in the env-canary list).

    Still DARK by default: with the global switch off (or no LIVE+enabled row) this
    is False for everyone, so the shared-DB path is byte-for-byte unchanged. The
    env-canary clause is a one-release backwards-compat fallback so the existing
    canary keeps routing while the DB switch rolls out; it is dropped in a
    follow-up once the canary's ``routing_enabled`` is set TRUE. ``BYOD_ENABLED``
    remains forever as the master kill switch (infra-only)."""
    if not company_id:
        return False
    # Master kill switch (env) wins and short-circuits the control-plane read.
    if not byod_flags.byo_database_globally_enabled():
        return False
    decision = _routing_decision(str(company_id))
    if decision.status != byod_store.TenantDbStatus.LIVE:
        return False  # PENDING/PROVISIONING/NEEDS_RECONNECT/DISABLED/ERROR never route
    if decision.routing_enabled:
        return True
    # Backwards-compat fallback (one release): a LIVE env-canary still routes.
    return byod_flags.is_canary_tenant(company_id)


def invalidate_routing_cache(company_id: str) -> None:
    """Drop a tenant's cached routing decision so a status/flag change takes effect
    immediately (call after provision, health, enable/disable, offboard,
    switch-in/out). The short cache TTL is the self-healing backstop."""
    byod_routing_cache.get_routing_cache().invalidate(company_id)


# ── Dependency seam (set by main at startup; avoids a circular import) ───────────
class _Deps:
    control_conn_factory: Optional[Callable[[], object]] = None
    control_conn_release: Optional[Callable[[object], None]] = None
    kms_factory: Optional[Callable[[], object]] = None


def configure(
    *,
    control_conn_factory: Callable[[], object],
    control_conn_release: Callable[[object], None],
    kms_factory: Callable[[], object],
) -> None:
    """Wire the control-plane accessors used to resolve a tenant's runtime DSN.

    Called once from main.py at startup. Stores callables only — nothing connects
    or builds a pool here, so a missing KMS config does not fail startup (the
    registry is built lazily on first BYOD request)."""
    _Deps.control_conn_factory = control_conn_factory
    _Deps.control_conn_release = control_conn_release
    _Deps.kms_factory = kms_factory


def _decrypt_runtime_dsn(company_id: str) -> Optional[str]:
    """Open a short control-plane connection, decrypt the runtime DSN via KMS, and
    release the connection. Returns None if the tenant has no stored runtime DSN.
    Raises on a KMS / control-plane failure (the caller decides cache fallback)."""
    conn = _Deps.control_conn_factory()
    try:
        cur = conn.cursor()
        try:
            kms = _Deps.kms_factory()
            return load_decrypted_runtime_dsn(cur, company_id, kms)
        finally:
            cur.close()
    finally:
        if _Deps.control_conn_release is not None:
            _Deps.control_conn_release(conn)


def _resolve_runtime_dsn(company_id: str) -> str:
    """dsn_provider for the pool: resolve the runtime (vaayu_runtime) DSN, then
    re-validate it (rule 8 SSRF/DNS re-check at connect/pool-build time). Raises a
    sanitized error; never echoes the DSN.

    KMS-outage resilient (§16.5): a fresh cached DSN (within TTL) is reused without
    touching KMS; on a KMS/control failure the engine falls back to a recent cached
    DSN (degraded + alert) and only a never-seen (cold) tenant fails — isolated."""
    if _Deps.control_conn_factory is None or _Deps.kms_factory is None:
        raise TenantDataError("BYOD engine is not configured")

    cache = byod_dsn_cache.get_dsn_cache()
    fresh = cache.get_fresh(company_id)
    if fresh is not None:
        metrics.dsn_cache_serve("fresh")
        validate_db_url(fresh)  # rule 8: still re-validate every connect
        return fresh

    try:
        dsn = _decrypt_runtime_dsn(company_id)
    except TenantDataError:
        raise
    except Exception as exc:  # KMS / control-plane read failure
        stale = cache.get_stale(company_id)
        if stale is not None:
            # §16.5: absorb the blip — serve the last-known DSN, degrade + alert.
            metrics.kms_decrypt_error(company_id, "served_cached")
            metrics.dsn_cache_serve("stale")
            logger.warning(
                "BYOD credential resolution degraded (KMS/control unavailable: %s); "
                "serving company=%s from decrypted-DSN cache",
                type(exc).__name__, company_id,
            )
            validate_db_url(stale)
            return stale
        # Cold (never decrypted) → fail THIS tenant only, sanitized (E6).
        metrics.kms_decrypt_error(company_id, "cold_fail")
        raise TenantDataError(
            f"could not resolve tenant credentials ({type(exc).__name__})"
        ) from exc

    if not dsn:
        raise TenantNotProvisioned()
    cache.put(company_id, dsn)
    # Re-validate on (pool-build) connect — defeats DNS-rebinding/TOCTOU (rule 8).
    validate_db_url(dsn)
    return dsn


def invalidate_runtime_dsn_cache(company_id: str) -> None:
    """Drop a tenant's cached decrypted DSN (call after a DSN rotation / re-provision
    so the new credential takes effect immediately, not after the TTL)."""
    byod_dsn_cache.get_dsn_cache().invalidate(company_id)


# ── Schema version-gate (Phase 6.1; §8.1/§8.2, rule 12, §16.9) ───────────────────
def tenant_schema_version(company_id: str) -> Optional[str]:
    """Read the tenant DB's recorded data-plane schema version from the control-
    plane registry (§8.1), or ``None`` if unknown.

    Reads the control plane, NEVER the tenant DB — the version is authoritative on
    Sapybase's side (it is recorded there on a verified migration, Phase 6.2).
    **Fail-soft:** any control-plane error → ``None`` (logged sanitized, E6), which
    the gate reads as "below every requirement" → the engine falls back to the OLD
    shape and never throws (§16.9)."""
    if _Deps.control_conn_factory is None:
        return None
    try:
        conn = _Deps.control_conn_factory()
    except Exception as exc:  # control plane unreachable — degrade to old shape
        logger.warning(
            "BYOD schema-version read degraded: company=%s reason=%s",
            company_id, sanitize_db_error(exc),
        )
        return None
    try:
        cur = conn.cursor()
        try:
            record = byod_store.get_tenant_db_record(cur, company_id)
        finally:
            cur.close()
        return record.schema_version if record is not None else None
    except Exception as exc:
        logger.warning(
            "BYOD schema-version read degraded: company=%s reason=%s",
            company_id, sanitize_db_error(exc),
        )
        return None
    finally:
        if _Deps.control_conn_release is not None:
            _Deps.control_conn_release(conn)


def tenant_supports_version(
    company_id: str, required: str, *, schema_version: Optional[str] = None
) -> bool:
    """Whether the tenant DB is at schema version ``>= required`` (the rule-12
    gate). Gate a read of a column/table introduced at ``required`` on this
    returning True; otherwise read the old shape.

    Fail-soft by construction: an unknown/unreadable/older version → ``False`` so a
    tenant N versions behind reads the old shape and never throws (§16.9). Pass
    ``schema_version`` to reuse a version already resolved this request and skip a
    second control-plane read."""
    version = schema_version if schema_version is not None else tenant_schema_version(company_id)
    supported = byod_schema.version_meets(version, required)
    # §16.9 schema ahead/behind: a 'blocked' decision means a migration is owed
    # (feature version-gated off, never thrown). Also surface the numeric version.
    metrics.schema_gate(company_id, "met" if supported else "blocked")
    parsed = byod_schema.parse_version(version)
    if parsed is not None:
        metrics.schema_version(company_id, parsed)
    return supported


# ── Pool registry (lazy process singleton) ──────────────────────────────────────
_registry: Optional[TenantPoolRegistry] = None
_registry_lock = threading.Lock()


def _db_failure_types() -> Tuple[type, ...]:
    """Driver error classes that should trip the per-tenant breaker (dead/slow DB).
    Backpressure (CeilingExceeded/TenantBusy) and routing aborts are NOT here —
    the pool already excludes them from breaker accounting."""
    import psycopg2  # lazy

    return (
        psycopg2.OperationalError,
        psycopg2.InterfaceError,
        psycopg2.errors.QueryCanceled,  # statement_timeout cancel
    )


def _make_on_acquire(config: PoolConfig) -> Callable[[object], None]:
    """Per-checkout setup: register pgvector (so ``vector`` binds work) and bound
    every query with the configured statement timeout (§7.3, rule 4)."""

    def _apply(conn: object) -> None:
        from pgvector.psycopg2 import register_vector  # lazy

        register_vector(conn)
        if config.statement_timeout_ms > 0:
            with conn.cursor() as cur:  # type: ignore[attr-defined]
                cur.execute("SET statement_timeout = %s", (config.statement_timeout_ms,))

    return _apply


def build_registry(
    dsn_provider: Callable[[str], str], *, config: Optional[PoolConfig] = None
) -> TenantPoolRegistry:
    """Construct a production-shaped tenant pool registry for a given DSN provider.

    Shared by the lazy singleton (real provider) and tests (a constant provider
    pointed at a throwaway tenant DB), so both exercise the same pooling, breaker,
    timeout, and pgvector wiring."""
    cfg = config or PoolConfig.from_env()
    return TenantPoolRegistry(
        cfg,
        pool_factory=psycopg2_pool_factory,
        dsn_provider=dsn_provider,
        on_acquire=_make_on_acquire(cfg),
        breaker_config=BreakerConfig(),
        db_failure_types=_db_failure_types(),
    )


def get_registry() -> TenantPoolRegistry:
    """The process-wide tenant pool registry, built lazily on first BYOD use."""
    global _registry
    if _registry is None:
        with _registry_lock:
            if _registry is None:
                _registry = build_registry(_resolve_runtime_dsn)
    return _registry


def reset_registry() -> None:
    """Tear down + drop the singleton (tests / process shutdown)."""
    global _registry
    with _registry_lock:
        if _registry is not None:
            try:
                _registry.close_all()
            except Exception:
                pass
            _registry = None


def tenant_breaker_open(
    company_id: str, *, registry: Optional[TenantPoolRegistry] = None
) -> bool:
    """Whether the tenant's circuit breaker is OPEN — used by batch jobs to skip a
    known-bad tenant for free (E9 / §16.4: "skip open-breaker tenants, retry
    later"), without paying a connection attempt.

    OPEN → True (skip). HALF_OPEN/CLOSED → False (allow; HALF_OPEN lets one probe
    through to recover the tenant automatically). Fail-soft: any error resolving
    the breaker state returns False — on doubt we DON'T skip, because the
    connection attempt itself is breaker-guarded and will fast-fail if truly open.
    """
    from byod_breaker import BreakerState  # lazy; keeps import graph light

    try:
        reg = registry or get_registry()
        return reg.breaker_state(company_id) is BreakerState.OPEN
    except Exception:
        return False


# ── Tenant data-plane access ────────────────────────────────────────────────────
@contextmanager
def tenant_connection(
    company_id: str, *, registry: Optional[TenantPoolRegistry] = None
) -> Iterator[object]:
    """Yield a tagged tenant connection (vaayu_runtime, DML-only) for the duration
    of a query, converting every failure into a sanitized :class:`TenantDataError`
    (E6). The connection is returned to its bounded pool on exit (E8, via the
    registry's own ``finally``)."""
    reg = registry or get_registry()
    try:
        with reg.get_tenant_db(company_id) as conn:
            yield conn
    except TenantDataError:
        raise
    except (PoolRegistryError, BreakerOpen, DsnValidationError) as exc:
        raise TenantDataError(sanitize_db_error(exc)) from exc
    except Exception as exc:  # raw driver/psycopg2 error — never leak it
        raise TenantDataError(sanitize_db_error(exc)) from exc


# chat_logs columns mirror the global-pool INSERT in main.log_chat_to_db and the
# authoritative data-plane schema (byod_dataplane.DATA_PLANE_SCHEMA_SQL). When a
# message_id is supplied it is the row id == the metering idempotency key (Phase
# 3.3), so the reconciler can match a confirmed store to a metered key (§16.1).
_CHAT_LOG_INSERT = (
    "INSERT INTO chat_logs "
    "(company_id, user_query, bot_response, was_cache_hit, is_unanswered, session_id, confidence) "
    "VALUES (%s, %s, %s, %s, %s, %s, %s)"
)
_CHAT_LOG_INSERT_WITH_ID = (
    "INSERT INTO chat_logs "
    "(id, company_id, user_query, bot_response, was_cache_hit, is_unanswered, session_id, confidence) "
    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
)

# SQLSTATE 25006 = read_only_sql_transaction (also raised on a standby/in-recovery
# primary) — the §16.9 "tenant DB read-only / in recovery" detection code.
_READ_ONLY_SQLSTATE = "25006"


def _write_failure_kind(raw: object) -> str:
    """Classify a degraded tenant write for the db-errors metric label."""
    return "readonly" if getattr(raw, "pgcode", None) == _READ_ONLY_SQLSTATE else "write"


def tenant_log_chat(
    company_id: str,
    user_query: str,
    bot_response: str,
    was_cache_hit: bool,
    is_unanswered: bool,
    session_id: Optional[str] = None,
    confidence: Optional[float] = None,
    *,
    message_id: Optional[str] = None,
    registry: Optional[TenantPoolRegistry] = None,
) -> bool:
    """Write the conversation log to the tenant DB. Returns True on success.

    When ``message_id`` is given it becomes the ``chat_logs.id`` — the per-message
    idempotency key the control-plane meter and reconciler key on (Phase 3.3).
    Degrades soft (§16.9): on ANY tenant-DB failure it logs a SANITIZED warning
    and returns False — a tenant analytics-write hiccup never breaks chat or leaks
    DB internals. The caller (a background task) ignores the result."""
    try:
        with tenant_connection(company_id, registry=registry) as conn:
            cur = conn.cursor()
            try:
                if message_id is not None:
                    cur.execute(
                        _CHAT_LOG_INSERT_WITH_ID,
                        (
                            message_id,
                            company_id,
                            user_query,
                            bot_response,
                            was_cache_hit,
                            is_unanswered,
                            session_id,
                            confidence,
                        ),
                    )
                else:
                    cur.execute(
                        _CHAT_LOG_INSERT,
                        (
                            company_id,
                            user_query,
                            bot_response,
                            was_cache_hit,
                            is_unanswered,
                            session_id,
                            confidence,
                        ),
                    )
                conn.commit()
            finally:
                cur.close()
        return True
    except TenantDataError as exc:
        # §16.9: a degraded write on a read-only / in-recovery DB (SQLSTATE 25006)
        # is the detection signal for that state; other write failures are "write".
        metrics.db_error(company_id, _write_failure_kind(exc.__cause__))
        logger.warning("BYOD chat_log write degraded: company=%s reason=%s", company_id, exc.reason)
        return False
    except Exception as exc:  # belt-and-suspenders: never let a background task raise
        metrics.db_error(company_id, _write_failure_kind(exc))
        logger.warning(
            "BYOD chat_log write degraded: company=%s reason=%s", company_id, sanitize_db_error(exc)
        )
        return False
