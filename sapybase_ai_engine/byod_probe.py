"""BYOD tenant-database capability probe: real connect + pgvector assertions.

RFC docs/rfc-byod.md Phase 2.2 (§4.1 step 2 "validate before trusting", §16.7
"pgvector version / index compatibility — assert a minimum pgvector version at
onboarding", §16.2 "the tenant DB is hostile until proven otherwise").

Phase 2.1 shipped a *validate-only* Test (``validate_db_url`` — SSRF / DNS /
allowlist / TLS, no connection). Phase 2.2 upgrades it into a **real connection**
that proves the customer's database can actually back the engine:

  1. Re-validate the DSN (rule 8: SSRF + DNS re-check on **every** connect).
  2. Open a single, short-lived connection over TLS using the **migration role**,
     under a bounded connect timeout + statement timeout (so a slow or hostile
     remote DB can never hang the caller — §7.3 discipline applied to onboarding).
  3. Assert ``pgvector`` is installed (or installable by the migration role) and
     at least the required **minimum version** (§16.7 — HNSW needs pgvector
     >= 0.5.0; we pin a configurable floor).
  4. Assert a ``vector(EMBEDDING_DIMENSIONS)`` column is creatable — proving the
     DB can hold our 768-dim embeddings at the dimension the engine emits.

The probe is **side-effect-free**: all of its DDL runs inside a transaction that
is always rolled back, so it never leaves an extension, table, or row behind on
the client's database. It is import-light (stdlib + ``byod_dsn`` /
``embedding_config``; psycopg2 is imported lazily only in the default connector),
and the connector + DNS resolver are injectable, so the whole gate is unit-
testable without a live database.

Scalability note: this runs on the rare **onboarding / provisioning** path, not
the hot request path. It opens its own one-shot connection (never the per-tenant
runtime pool) and closes it in ``finally``; bounded timeouts keep it from
consuming a worker indefinitely. Errors are **sanitized** before they leave this
module (E6 / §16.2) — a raw driver error can leak the host, port, or DSN, so
callers only ever see a generic, safe message.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Callable, Optional, Sequence

from byod_dsn import validate_db_url
from embedding_config import EMBEDDING_DIMENSIONS

# A connector takes a DSN and returns an open DB-API connection (cursor/rollback/
# close). Injectable so the probe is testable without a real Postgres.
Connector = Callable[[str], object]
Resolver = Callable[[str], Sequence[str]]

# Name of the throwaway probe table. Each probe runs on its own fresh connection
# (its own session), so a fixed name never collides; the transaction is rolled
# back regardless, so the table never actually persists.
_PROBE_TABLE = "_byod_probe_vector"

# §16.7: HNSW indexing (the operator the data-plane RAG search uses) landed in
# pgvector 0.5.0, so that is the documented floor. Overridable via env for a
# future bump without a code change.
_DEFAULT_MIN_PGVECTOR_VERSION = "0.5.0"

_VERSION_RE = re.compile(r"^\s*(\d+)\.(\d+)(?:\.(\d+))?")


# ── Errors (all sanitized — never carry DSN/host/driver text, E6) ─────────────
class ProbeError(Exception):
    """Base class for tenant-database probe failures. Messages are safe to
    surface to a super-admin: they never contain the DSN, host, or driver text."""


class TenantConnectionError(ProbeError):
    """Could not open a connection to the tenant database (unreachable, auth
    failure, TLS failure, or timeout). The underlying cause is intentionally not
    echoed — it can leak host/port/credentials (§16.2)."""


class PgvectorUnavailable(ProbeError):
    """pgvector is neither installed nor installable by the migration role."""


class PgvectorVersionTooOld(ProbeError):
    """pgvector is installed but below the required minimum version (§16.7)."""


class VectorDimensionUnsupported(ProbeError):
    """A ``vector(EMBEDDING_DIMENSIONS)`` column could not be created."""


def _parse_version(text: object) -> Optional[tuple[int, int, int]]:
    """Parse a ``MAJOR.MINOR[.PATCH]`` version into a comparable tuple, or None."""
    if not isinstance(text, str):
        return None
    m = _VERSION_RE.match(text)
    if not m:
        return None
    return (int(m.group(1)), int(m.group(2)), int(m.group(3) or 0))


def _fmt_version(v: tuple[int, int, int]) -> str:
    return ".".join(str(p) for p in v)


@dataclass(frozen=True)
class ProbeConfig:
    """Bounds + policy for a probe. ``from_env`` reads operator overrides."""

    connect_timeout_seconds: int = 5
    statement_timeout_ms: int = 5000
    min_pgvector_version: tuple[int, int, int] = (0, 5, 0)

    @classmethod
    def from_env(cls) -> "ProbeConfig":
        min_ver = _parse_version(
            os.getenv("BYOD_MIN_PGVECTOR_VERSION", _DEFAULT_MIN_PGVECTOR_VERSION)
        ) or _parse_version(_DEFAULT_MIN_PGVECTOR_VERSION)
        return cls(
            connect_timeout_seconds=_int_env("BYOD_PROBE_CONNECT_TIMEOUT_SECONDS", 5),
            statement_timeout_ms=_int_env("BYOD_PROBE_STATEMENT_TIMEOUT_MS", 5000),
            min_pgvector_version=min_ver,  # type: ignore[arg-type]
        )


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class ProbeResult:
    """The proven facts about a tenant database (safe to log / return — no creds)."""

    host: str
    port: int
    dbname: str
    sslmode: str
    pgvector_version: str
    pgvector_version_tuple: tuple[int, int, int]
    server_version: str
    embedding_dimensions: int


def _make_default_connector(config: ProbeConfig) -> Connector:
    """Build the production connector: psycopg2 with a bounded connect timeout.

    psycopg2 is imported lazily so importing this module stays cheap and the
    probe core remains unit-testable without the driver."""

    def _connect(dsn: str) -> object:
        import psycopg2  # lazy

        return psycopg2.connect(dsn, connect_timeout=config.connect_timeout_seconds)

    return _connect


def probe_tenant_database(
    dsn: str,
    *,
    resolver: Optional[Resolver] = None,
    connect: Optional[Connector] = None,
    config: Optional[ProbeConfig] = None,
) -> ProbeResult:
    """Validate, connect, and prove the tenant DB can back the engine.

    Returns a :class:`ProbeResult` on success. Raises ``DsnValidationError`` if
    the DSN is unsafe (before any connection is attempted — fail-closed), or a
    :class:`ProbeError` subclass if the database is unreachable or incompatible.
    All errors are sanitized (E6); the plaintext DSN is never logged or echoed.
    """
    config = config or ProbeConfig.from_env()

    # Rule 8: re-validate the DSN (SSRF + resolved-IP re-check + TLS + param
    # allowlist) on every connect, not just at first onboarding. Raises
    # DsnValidationError (fail-closed) before we ever open a socket.
    validated = (
        validate_db_url(dsn) if resolver is None else validate_db_url(dsn, resolver=resolver)
    )

    connector = connect or _make_default_connector(config)
    try:
        conn = connector(dsn)
    except ProbeError:
        raise
    except Exception as exc:  # driver/socket/TLS error — sanitize (E6)
        raise TenantConnectionError(
            "Could not connect to the tenant database. Check that it is reachable "
            "from Sapybase and that the credentials are correct."
        ) from exc

    try:
        pgvector_version, pgvector_tuple, server_version = _run_probe(conn, config)
    except ProbeError:
        raise
    except Exception as exc:  # any unexpected driver error mid-probe — sanitize
        raise TenantConnectionError(
            "The tenant database connection failed during validation."
        ) from exc
    finally:
        _safe_rollback_close(conn)

    return ProbeResult(
        host=validated.host,
        port=validated.port,
        dbname=validated.dbname,
        sslmode=validated.sslmode,
        pgvector_version=pgvector_version,
        pgvector_version_tuple=pgvector_tuple,
        server_version=server_version,
        embedding_dimensions=EMBEDDING_DIMENSIONS,
    )


def _run_probe(conn: object, config: ProbeConfig) -> tuple[str, tuple[int, int, int], str]:
    """Execute the capability checks inside a transaction that is always rolled
    back by the caller (so nothing persists on the client DB)."""
    cur = conn.cursor()  # type: ignore[attr-defined]

    # Bound every probe statement so a slow/hostile DB cannot hang us (§7.3).
    cur.execute("SET statement_timeout = %s", (config.statement_timeout_ms,))

    # 1. Is pgvector installed or at least installable?
    cur.execute(
        "SELECT default_version, installed_version "
        "FROM pg_available_extensions WHERE name = 'vector'"
    )
    avail = cur.fetchone()
    if avail is None:
        raise PgvectorUnavailable(
            "The pgvector extension is not installed or available on the tenant "
            "database. Install pgvector before connecting it."
        )
    installed_version = avail[1]
    if not installed_version:
        # Available but not yet created — the migration role must be able to
        # enable it. CREATE EXTENSION is transactional and will be rolled back.
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
        except Exception as exc:  # insufficient privilege, etc. — sanitize (E6)
            raise PgvectorUnavailable(
                "The pgvector extension is available but could not be enabled. "
                "Grant the connecting role permission to create it."
            ) from exc

    # 2. Read the effective version and enforce the minimum (§16.7).
    cur.execute("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
    vrow = cur.fetchone()
    version_str = vrow[0] if vrow else None
    version_tuple = _parse_version(version_str)
    if version_tuple is None:
        raise PgvectorUnavailable(
            "Could not determine the installed pgvector version on the tenant database."
        )
    if version_tuple < config.min_pgvector_version:
        raise PgvectorVersionTooOld(
            f"pgvector {version_str} is below the required minimum "
            f"{_fmt_version(config.min_pgvector_version)}. Upgrade pgvector on the "
            "tenant database."
        )

    # 3. Prove a vector column at the engine's embedding dimension is creatable.
    #    EMBEDDING_DIMENSIONS is a trusted in-process int constant (not user
    #    input), so interpolating it into DDL is safe. ON COMMIT DROP is belt-and-
    #    braces; we roll the whole transaction back regardless.
    try:
        cur.execute(
            f"CREATE TEMP TABLE {_PROBE_TABLE} "
            f"(embedding vector({int(EMBEDDING_DIMENSIONS)})) ON COMMIT DROP"
        )
    except Exception as exc:  # sanitize (E6)
        raise VectorDimensionUnsupported(
            f"Could not create a vector({int(EMBEDDING_DIMENSIONS)}) column on the "
            "tenant database. Ensure the pgvector version supports this dimension."
        ) from exc

    # 4. Server version — informational only (returned for the admin panel).
    cur.execute("SHOW server_version")
    srow = cur.fetchone()
    server_version = srow[0] if srow else "unknown"

    return version_str, version_tuple, server_version


def _safe_rollback_close(conn: object) -> None:
    """Roll back the probe transaction (discarding all probe DDL) and close.

    Best-effort and never raises — the probe must not leave a connection open or
    mutate the client DB even if teardown hits an error."""
    try:
        conn.rollback()  # type: ignore[attr-defined]
    except Exception:
        pass
    try:
        conn.close()  # type: ignore[attr-defined]
    except Exception:
        pass
