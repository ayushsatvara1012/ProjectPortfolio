"""BYOD tenant health probe: prove the runtime credential works end-to-end.

RFC docs/rfc-byod.md Phase 2.4 (§4.1 step 4 "health probe passes -> flip live",
§10 failure modes, §16.5 client-rotated-password -> NEEDS_RECONNECT). This is the
**final gate before a tenant goes LIVE**, and the on-demand check that surfaces a
tenant's health afterwards (§4.4 DB unreachable / degraded).

It differs from the Phase-2.2 capability probe in two important ways:

  * It connects with the **runtime (DML-only ``vaayu_runtime``) DSN** — the exact
    credential the engine's request path will use in Phase 3 — not the privileged
    migrate DSN. So it proves the role exists, its password works, TLS is fine,
    and the role can actually read the data-plane tables (grants + schema both
    correct). The capability probe used the migrate role and rolled everything
    back; this proves the *production* path.
  * It distinguishes an **auth failure** (the client rotated their DB password ->
    ``NEEDS_RECONNECT``, §16.5) from a general **unreachable** condition, so the
    admin surface can show the right state and recovery action.

Side-effect-free (read-only ``SELECT``s, always rolled back), bounded by a connect
timeout + statement timeout (a remote/hostile DB can never hang the caller), and
import-light with an injectable connector/resolver so it is unit-testable without
a live database — while the real end-to-end behaviour is proven by a real-Postgres
test (test_byod_health.py). Errors are sanitized (E6): never the DSN/host/driver.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Callable, Optional, Sequence

from byod_dsn import validate_db_url

Connector = Callable[[str], object]
Resolver = Callable[[str], Sequence[str]]

# A representative data-plane table whose readability proves the runtime role's
# grants + the schema are both in place (Phase 2.3 provisions it).
_REACHABILITY_TABLE = "company_knowledge"

# SQLSTATEs that mean "bad credentials" (client rotated their DB password, §16.5).
_AUTH_SQLSTATES = frozenset({"28P01", "28000", "28"})
# Connect-time auth failures: psycopg2 raises a plain OperationalError during the
# connection handshake whose ``pgcode`` is NOT populated (and whose class is
# OperationalError, not InvalidPassword) — so the SQLSTATE/class checks miss the
# real "client rotated their DB password" case. Fall back to matching the driver's
# message (same approach as main.py's connect path). Lower-cased substring match.
_AUTH_MESSAGE_MARKERS = (
    "password authentication failed",
    "authentication failed",
    "no password supplied",
    "invalid username-password",
)
# SQLSTATEs that mean "the data plane isn't usable by this role" (missing table /
# revoked grant) rather than a connectivity problem.
_DATAPLANE_SQLSTATES = frozenset({"42P01", "42501", "3F000", "3D000"})


class HealthError(Exception):
    """Base class for tenant health-probe failures. Sanitized — the message never
    carries the DSN, host, or raw driver text (E6)."""


class TenantUnreachable(HealthError):
    """The tenant database could not be reached (network / TLS / timeout)."""


class TenantAuthFailed(HealthError):
    """Authentication failed — typically the client rotated their DB password.
    Maps to the ``NEEDS_RECONNECT`` lifecycle state (§16.5)."""


class DataPlaneUnavailable(HealthError):
    """Connected, but the runtime role cannot read the data-plane tables (schema
    missing or grants revoked) — the tenant is unhealthy for serving."""


@dataclass(frozen=True)
class HealthConfig:
    connect_timeout_seconds: int = 5
    statement_timeout_ms: int = 5000

    @classmethod
    def from_env(cls) -> "HealthConfig":
        return cls(
            connect_timeout_seconds=_int_env("BYOD_HEALTH_CONNECT_TIMEOUT_SECONDS", 5),
            statement_timeout_ms=_int_env("BYOD_HEALTH_STATEMENT_TIMEOUT_MS", 5000),
        )


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class HealthResult:
    healthy: bool
    host: str
    dbname: str


def _make_default_connector(config: HealthConfig) -> Connector:
    def _connect(dsn: str) -> object:
        import psycopg2  # lazy

        return psycopg2.connect(dsn, connect_timeout=config.connect_timeout_seconds)

    return _connect


def _pgcode(exc: Exception) -> Optional[str]:
    return getattr(exc, "pgcode", None)


def _is_auth_failure(exc: Exception) -> bool:
    """True if ``exc`` is a credential/auth rejection (→ NEEDS_RECONNECT, §16.5).

    Checks the SQLSTATE and class first (query-time auth errors carry these), then
    falls back to the driver message — required because a connect-time wrong-password
    failure is a plain OperationalError with no ``pgcode``."""
    if _pgcode(exc) in _AUTH_SQLSTATES or exc.__class__.__name__ == "InvalidPassword":
        return True
    msg = str(exc).lower()
    return any(marker in msg for marker in _AUTH_MESSAGE_MARKERS)


def run_health_check(
    dsn: str,
    *,
    resolver: Optional[Resolver] = None,
    connect: Optional[Connector] = None,
    config: Optional[HealthConfig] = None,
) -> HealthResult:
    """Connect with the given (runtime) DSN and prove the tenant is healthy:
    reachable, the credential works, and the data-plane tables are readable.

    Raises ``DsnValidationError`` (unsafe DSN, before connecting) or a sanitized
    :class:`HealthError` subclass (``TenantAuthFailed`` / ``TenantUnreachable`` /
    ``DataPlaneUnavailable``). Returns a :class:`HealthResult` on success."""
    config = config or HealthConfig.from_env()

    # Rule 8: re-validate (SSRF/DNS/TLS/allowlist) on every connect.
    validated = (
        validate_db_url(dsn) if resolver is None else validate_db_url(dsn, resolver=resolver)
    )

    connector = connect or _make_default_connector(config)
    try:
        conn = connector(dsn)
    except HealthError:
        raise
    except Exception as exc:  # classify auth vs unreachable; sanitize (E6)
        if _is_auth_failure(exc):
            raise TenantAuthFailed(
                "The tenant database rejected the stored credentials. The database "
                "password may have changed; reconnect the database."
            ) from exc
        raise TenantUnreachable(
            "The tenant database is unreachable. It may be down or blocking "
            "connections from Sapybase."
        ) from exc

    try:
        _run_health_queries(conn, config)
    finally:
        _safe_rollback_close(conn)

    return HealthResult(healthy=True, host=validated.host, dbname=validated.dbname)


def _run_health_queries(conn: object, config: HealthConfig) -> None:
    """Liveness + data-plane reachability checks (read-only, rolled back by the
    caller). Raises a sanitized :class:`HealthError` on any problem."""
    cur = conn.cursor()  # type: ignore[attr-defined]
    cur.execute("SET statement_timeout = %s", (config.statement_timeout_ms,))

    # 1. Liveness: the session works at all.
    cur.execute("SELECT 1")
    row = cur.fetchone()
    if not row or row[0] != 1:
        raise TenantUnreachable("The tenant database failed a basic liveness check.")

    # 2. The runtime role can actually read a data-plane table (grants + schema).
    try:
        cur.execute(f"SELECT 1 FROM {_REACHABILITY_TABLE} LIMIT 1")
        cur.fetchone()
    except Exception as exc:  # sanitize (E6)
        if _is_auth_failure(exc):
            raise TenantAuthFailed(
                "The tenant database rejected the stored credentials."
            ) from exc
        raise DataPlaneUnavailable(
            "The tenant database is reachable but its data-plane tables are not "
            "accessible. It may need to be re-provisioned."
        ) from exc


def _safe_rollback_close(conn: object) -> None:
    try:
        conn.rollback()  # type: ignore[attr-defined]
    except Exception:
        pass
    try:
        conn.close()  # type: ignore[attr-defined]
    except Exception:
        pass
