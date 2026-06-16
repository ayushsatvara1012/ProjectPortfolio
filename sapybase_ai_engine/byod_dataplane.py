"""BYOD data-plane schema + least-privilege runtime role (tenant-DB provisioning).

RFC docs/rfc-byod.md Phase 2.3 (§5.4 least-privilege roles, §8.1 schema version
registry, A.7 data-plane lineage). This module is the **authoritative source of
truth for the tenant (data-plane) schema** — the analogue of
``byod_store.CONTROL_PLANE_SCHEMA_SQL`` for the control plane. Phase 3.1 wraps
this DDL into a formal Alembic ``data_plane`` lineage; until then this is the one
place the tenant schema is defined, and the Phase-0 test harness imports it (so
the provisioned schema and the tested schema can never drift).

Two things happen when a BYOD tenant database is provisioned (after the Phase-2.2
probe proves it can back the engine):

  1. **Schema (migrate role).** :func:`apply_data_plane_schema` lays down the
     data-plane tables the engine reads/writes — ``company_knowledge`` (RAG
     vectors), ``chat_logs``, ``lead_capture`` (leads + scoring + attribution).
     It is **idempotent + additive** (``CREATE ... IF NOT EXISTS``, rule 11) so a
     re-run (or a double-click, §16.6) is safe, and **tenant-appropriate**: no FK
     to ``companies`` (that table is control-plane only), ``gen_random_uuid()``
     instead of the ``uuid-ossp`` extension, and ``vector(EMBEDDING_DIMENSIONS)``
     locked to the engine's embedding width so the two can never silently differ.

  2. **Runtime role (§5.4).** :func:`create_runtime_role` creates the DML-only
     ``vaayu_runtime`` login that the engine's request path uses in Phase 3. It is
     granted SELECT/INSERT/UPDATE/DELETE on the data-plane tables (plus on future
     tables, via ``ALTER DEFAULT PRIVILEGES``) but **no DDL, no DROP, no
     TRUNCATE, no CREATE** — so a leaked runtime credential cannot alter or drop
     the client's schema (blast-radius bound). The client-supplied DSN is the
     privileged ("migrate") connection used only here at provisioning time; the
     engine never uses it for request traffic.

The module is import-light (stdlib + ``embedding_config``; psycopg2 only inside
the default connector) and the connector is injectable, so the orchestration is
unit-testable without a live database — though the privilege guarantees
themselves are proven by a real-Postgres test (test_byod_dataplane.py).
"""
from __future__ import annotations

import os
from typing import Callable, Optional
from urllib.parse import quote, urlsplit, urlunsplit

from embedding_config import EMBEDDING_DIMENSIONS

# Bumped whenever the data-plane DDL below changes (expand->migrate->contract,
# §8.2). Recorded in the control-plane schema_version registry (§8.1) so the
# engine can version-gate reads of new columns during a rollout (Phase 6).
DATA_PLANE_SCHEMA_VERSION = "0001"

# The DML-only role the engine's request path uses (§5.4). One per tenant DB;
# since every BYOD tenant has its own database, the fixed name never collides.
RUNTIME_ROLE_NAME = "vaayu_runtime"

# Provisioning connection bounds (a tenant DB is remote + untrusted; never block
# forever). DDL on an empty tenant DB is fast; the statement timeout is generous
# to allow index builds yet still bounded.
_CONNECT_TIMEOUT_SECONDS = int(os.getenv("BYOD_PROVISION_CONNECT_TIMEOUT_SECONDS", "10"))
_STATEMENT_TIMEOUT_MS = int(os.getenv("BYOD_PROVISION_STATEMENT_TIMEOUT_MS", "30000"))

Connector = Callable[[str], object]


class DataPlaneProvisionError(Exception):
    """Provisioning the tenant schema / runtime role failed. Sanitized (E6) — the
    message never carries the DSN, host, or raw driver text."""


# ── Authoritative data-plane schema (ASCII-only, like the control plane) ──────
# Kept strictly ASCII so it encodes under any client_encoding. Columns mirror the
# production tables (migrations/v12, v14; alembic 0004/0005/0009/0011) minus the
# control-plane-only `companies` FK, which does not exist on a tenant DB.
def _build_schema_sql() -> str:
    dim = int(EMBEDDING_DIMENSIONS)
    return f"""
CREATE EXTENSION IF NOT EXISTS vector;

-- RAG knowledge base: parent/child chunks + embeddings + hybrid-search tsvector.
CREATE TABLE IF NOT EXISTS company_knowledge (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID,
    url         TEXT,
    content     TEXT,
    embedding   vector({dim}),
    created_at  TIMESTAMPTZ DEFAULT now(),
    chunk_type  TEXT NOT NULL DEFAULT 'child',
    parent_id   UUID,
    content_tsv tsvector
);
CREATE INDEX IF NOT EXISTS company_knowledge_embedding_hnsw
    ON company_knowledge USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_company_knowledge_company
    ON company_knowledge (company_id);
CREATE INDEX IF NOT EXISTS idx_company_knowledge_content_tsv
    ON company_knowledge USING gin (content_tsv);

-- Conversation log (mirrors the INSERT in /api/chat).
CREATE TABLE IF NOT EXISTS chat_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL,
    user_query    TEXT NOT NULL,
    bot_response  TEXT NOT NULL,
    was_cache_hit BOOLEAN DEFAULT false,
    is_unanswered BOOLEAN DEFAULT false,
    session_id    UUID,
    confidence    REAL,
    created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_logs_company
    ON chat_logs (company_id, created_at DESC);

-- Captured leads: scoring (0005), outcome tracking (0009), attribution (0011).
CREATE TABLE IF NOT EXISTS lead_capture (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID,
    email         VARCHAR NOT NULL,
    name          VARCHAR,
    context       TEXT,
    score         INTEGER,
    score_band    TEXT,
    score_reasons TEXT,
    page_url      TEXT,
    referrer      TEXT,
    utm_source    TEXT,
    utm_medium    TEXT,
    utm_campaign  TEXT,
    status        TEXT NOT NULL DEFAULT 'new',
    value_usd     NUMERIC(12,2),
    status_updated_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_lead_capture_company
    ON lead_capture (company_id);
""".strip()


DATA_PLANE_SCHEMA_SQL = _build_schema_sql()

# Data-plane tables the runtime role is granted DML on. Listed explicitly (rather
# than relying solely on "ALL TABLES") for clarity; "ALL TABLES" + default
# privileges below cover present + future tables regardless.
DATA_PLANE_TABLES: tuple[str, ...] = ("company_knowledge", "chat_logs", "lead_capture")

# Reverse of DATA_PLANE_SCHEMA_SQL — the analogue of byod_store's
# CONTROL_PLANE_SCHEMA_DROP_SQL. Used by the data_plane Alembic lineage's
# downgrade (Phase 3.1) so the schema and its teardown share one source of truth.
# Drops only the data-plane tables (indexes go with them); the `vector` extension
# is left in place since it is a database-wide resource we did not exclusively own.
DATA_PLANE_SCHEMA_DROP_SQL = "\n".join(
    f"DROP TABLE IF EXISTS {t};" for t in reversed(DATA_PLANE_TABLES)
)


def apply_data_plane_schema(cur) -> None:
    """Apply the authoritative data-plane DDL (idempotent/additive). Run with the
    privileged migrate connection; caller controls the transaction."""
    cur.execute(DATA_PLANE_SCHEMA_SQL)


def _quote_ident(name: str) -> str:
    """Minimal SQL identifier quoting (double-quote, escape embedded quotes).

    Used only for the database name (already validated by ``validate_db_url`` to
    contain no path separator) and the fixed role-name constant."""
    return '"' + name.replace('"', '""') + '"'


def create_runtime_role(cur, *, password: str, dbname: str) -> None:
    """Create (or re-key) the DML-only ``vaayu_runtime`` role and grant it
    least-privilege access to the data-plane tables (§5.4).

    Idempotent: if the role exists its password is reset (supports rotation);
    otherwise it is created. Grants SELECT/INSERT/UPDATE/DELETE on current and
    future tables, USAGE on the schema and sequences, but **never** CREATE / DDL /
    DROP / TRUNCATE — so the engine's request-path credential cannot mutate the
    client's schema. Run with the privileged migrate connection."""
    if not password:
        raise DataPlaneProvisionError("runtime role password must be non-empty")
    role = _quote_ident(RUNTIME_ROLE_NAME)
    db = _quote_ident(dbname)

    cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (RUNTIME_ROLE_NAME,))
    if cur.fetchone() is not None:
        cur.execute(f"ALTER ROLE {role} WITH LOGIN PASSWORD %s", (password,))
    else:
        cur.execute(f"CREATE ROLE {role} WITH LOGIN PASSWORD %s", (password,))

    # Schema usage but explicitly NOT create (defensive — on PG < 15 PUBLIC may
    # still hold CREATE on schema public; operators should revoke that DB-wide).
    cur.execute(f"GRANT CONNECT ON DATABASE {db} TO {role}")
    cur.execute(f"GRANT USAGE ON SCHEMA public TO {role}")
    cur.execute(f"REVOKE CREATE ON SCHEMA public FROM {role}")

    # DML on existing tables/sequences …
    cur.execute(
        f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {role}"
    )
    cur.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {role}")
    # … and on tables/sequences created later by this (migrate) role, so future
    # additive migrations (Phase 6) don't need to re-grant.
    cur.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {role}"
    )
    cur.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        f"GRANT USAGE, SELECT ON SEQUENCES TO {role}"
    )


def build_runtime_dsn(migrate_dsn: str, password: str) -> str:
    """Derive the runtime DSN from the migrate DSN: same host/port/dbname/sslmode,
    but the ``vaayu_runtime`` user + its generated password. This is what the
    engine's request path connects with (Phase 3); it is stored envelope-encrypted
    just like the migrate DSN."""
    parts = urlsplit(migrate_dsn)
    host = parts.hostname or ""
    port = f":{parts.port}" if parts.port else ""
    netloc = f"{RUNTIME_ROLE_NAME}:{quote(password, safe='')}@{host}{port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def _default_connector(dsn: str) -> object:
    import psycopg2  # lazy — keeps the module import-light

    return psycopg2.connect(dsn, connect_timeout=_CONNECT_TIMEOUT_SECONDS)


def provision_tenant_database(
    migrate_dsn: str,
    *,
    dbname: str,
    runtime_password: str,
    connect: Optional[Connector] = None,
) -> str:
    """Open the privileged (migrate) connection, apply the data-plane schema, and
    create the DML-only runtime role — atomically (single transaction, committed
    once) so a failure leaves nothing half-applied; combined with the idempotent
    DDL this makes a re-run safe (§16.6).

    Returns the applied :data:`DATA_PLANE_SCHEMA_VERSION`. Raises a sanitized
    :class:`DataPlaneProvisionError` on any connection or DDL failure (E6)."""
    connector = connect or _default_connector
    try:
        conn = connector(migrate_dsn)
    except Exception as exc:  # connect/TLS/auth failure — sanitize (E6)
        raise DataPlaneProvisionError(
            "Could not connect to the tenant database to provision it."
        ) from exc

    try:
        cur = conn.cursor()  # type: ignore[attr-defined]
        cur.execute("SET statement_timeout = %s", (_STATEMENT_TIMEOUT_MS,))
        apply_data_plane_schema(cur)
        create_runtime_role(cur, password=runtime_password, dbname=dbname)
        conn.commit()  # type: ignore[attr-defined]
    except DataPlaneProvisionError:
        _safe_rollback(conn)
        raise
    except Exception as exc:  # DDL / privilege / driver error — sanitize (E6)
        _safe_rollback(conn)
        raise DataPlaneProvisionError(
            "Failed to provision the tenant database schema or runtime role."
        ) from exc
    finally:
        _safe_close(conn)

    return DATA_PLANE_SCHEMA_VERSION


def _safe_rollback(conn: object) -> None:
    try:
        conn.rollback()  # type: ignore[attr-defined]
    except Exception:
        pass


def _safe_close(conn: object) -> None:
    try:
        conn.close()  # type: ignore[attr-defined]
    except Exception:
        pass
