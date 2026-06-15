"""Ephemeral BYOD tenant-Postgres test harness (RFC Phase 0.1).

Provides a single context manager, ``ephemeral_tenant_db()``, that yields a DSN
to a throwaway Postgres+pgvector database provisioned with the data-plane
fixture schema and deterministic seed data. It is the foundation every later
BYOD phase tests against (a real remote-tenant database, not a mock).

Backend resolution (in order):

1. ``BYOD_TEST_TENANT_DSN`` env var set  → use that server, create a uniquely
   named ephemeral database on it, drop it on exit. This is what CI uses (a
   pgvector service container; see .github/workflows/ci.yml).
2. ``testcontainers`` importable + Docker running → start a ``pgvector/pgvector``
   container, provision its default DB, stop the container on exit. This is the
   zero-config local path.
3. Neither available → raise ``TenantDBUnavailable`` (callers turn this into a
   pytest skip with an actionable message).

This module is test-only infrastructure. It is NOT the authoritative data-plane
migration set (that arrives in Phase 3.1) and ships no runtime behavior.
"""
from __future__ import annotations

import math
import os
import random
import sys
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, NamedTuple
from urllib.parse import urlsplit, urlunsplit

import psycopg2

# Make the engine root importable so `embedding_config` resolves regardless of
# how/where pytest is invoked from.
_ENGINE_ROOT = Path(__file__).resolve().parents[2]
if str(_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(_ENGINE_ROOT))

from embedding_config import EMBEDDING_DIMENSIONS  # noqa: E402

# Default pgvector image for the local (testcontainers) path. pg16 ships a
# recent pgvector with HNSW support.
PGVECTOR_IMAGE = os.getenv("BYOD_TEST_PGVECTOR_IMAGE", "pgvector/pgvector:pg16")

_SCHEMA_SQL_PATH = Path(__file__).resolve().parent / "data_plane_schema.sql"


class TenantDBUnavailable(RuntimeError):
    """Raised when no ephemeral tenant Postgres backend can be provisioned."""


# ── Deterministic fixtures ──────────────────────────────────────────────────
# A stable company_id so tests can assert on a known tenant, and a small set of
# knowledge chunks with reproducible embeddings. The query in the gate test uses
# the *same* seed as one fixture, so its nearest neighbour is deterministic.

TENANT_COMPANY_ID = "00000000-0000-4000-8000-000000000001"


class KnowledgeFixture(NamedTuple):
    seed: int
    url: str
    content: str


KNOWLEDGE_FIXTURES: tuple[KnowledgeFixture, ...] = (
    KnowledgeFixture(101, "https://acme.test/pricing", "Our Pro plan is $149 per month, billed monthly."),
    KnowledgeFixture(202, "https://acme.test/support", "Support is available 24/7 via live chat and email."),
    KnowledgeFixture(303, "https://acme.test/returns", "Returns are accepted within 30 days of purchase."),
)


def make_embedding(seed: int, dim: int = EMBEDDING_DIMENSIONS) -> list[float]:
    """Deterministic unit-norm embedding for a given seed.

    Reproducible across machines (pure-Python ``random``), so the gate test's
    nearest-neighbour result is stable: querying with ``make_embedding(seed)``
    returns the fixture seeded with the same ``seed`` at cosine distance ~0.
    """
    rng = random.Random(seed)
    vec = [rng.uniform(-1.0, 1.0) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def vector_literal(vec: list[float]) -> str:
    """Render a vector in pgvector text format: ``[0.1,0.2,...]``."""
    return "[" + ",".join(repr(x) for x in vec) + "]"


# ── Provisioning ────────────────────────────────────────────────────────────

def _load_schema_sql() -> str:
    raw = _SCHEMA_SQL_PATH.read_text()
    # Keep the vector dimension locked to embedding_config — never hard-coded.
    return raw.replace("{EMBEDDING_DIMENSIONS}", str(EMBEDDING_DIMENSIONS))


def provision(dsn: str) -> None:
    """Apply the data-plane fixture schema and seed deterministic rows."""
    conn = psycopg2.connect(dsn)
    try:
        with conn.cursor() as cur:
            cur.execute(_load_schema_sql())
            for fx in KNOWLEDGE_FIXTURES:
                cur.execute(
                    """
                    INSERT INTO company_knowledge (company_id, url, content, embedding, chunk_type)
                    VALUES (%s, %s, %s, %s::vector, 'child')
                    """,
                    (TENANT_COMPANY_ID, fx.url, fx.content, vector_literal(make_embedding(fx.seed))),
                )
        conn.commit()
    finally:
        conn.close()


# ── DSN helpers ─────────────────────────────────────────────────────────────

def _normalize_dsn(url: str) -> str:
    """Strip SQLAlchemy driver suffixes so psycopg2 can consume the URL."""
    return url.replace("postgresql+psycopg2://", "postgresql://").replace(
        "postgres+psycopg2://", "postgresql://"
    )


def _with_dbname(dsn: str, db_name: str) -> str:
    parts = urlsplit(dsn)
    return urlunsplit((parts.scheme, parts.netloc, f"/{db_name}", parts.query, parts.fragment))


@contextmanager
def _ephemeral_db_on_server(base_dsn: str) -> Iterator[str]:
    """Create a uniquely named DB on an existing server; drop it on exit."""
    base_dsn = _normalize_dsn(base_dsn)
    db_name = f"byod_tenant_{uuid.uuid4().hex[:12]}"  # hex-only → safe to quote

    admin = psycopg2.connect(base_dsn)
    admin.autocommit = True
    try:
        with admin.cursor() as cur:
            cur.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        admin.close()

    try:
        yield _with_dbname(base_dsn, db_name)
    finally:
        admin = psycopg2.connect(base_dsn)
        admin.autocommit = True
        try:
            with admin.cursor() as cur:
                cur.execute(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = %s AND pid <> pg_backend_pid()",
                    (db_name,),
                )
                cur.execute(f'DROP DATABASE IF EXISTS "{db_name}"')
        finally:
            admin.close()


@contextmanager
def _testcontainer_db() -> Iterator[str]:
    """Start a pgvector container; stop it on exit."""
    try:
        from testcontainers.postgres import PostgresContainer
    except ImportError as exc:  # pragma: no cover - depends on local env
        raise TenantDBUnavailable(
            "No BYOD_TEST_TENANT_DSN set and `testcontainers` is not installed. "
            "Install dev deps (pip install -r requirements-dev.txt) and ensure "
            "Docker is running, or set BYOD_TEST_TENANT_DSN to a Postgres+pgvector server."
        ) from exc

    try:
        container = PostgresContainer(PGVECTOR_IMAGE)
        container.start()
    except Exception as exc:  # pragma: no cover - depends on local env
        raise TenantDBUnavailable(
            f"Could not start pgvector container ({PGVECTOR_IMAGE}). Is Docker running? "
            f"Underlying error: {exc}"
        ) from exc

    try:
        yield _normalize_dsn(container.get_connection_url())
    finally:
        container.stop()


@contextmanager
def open_tenant_server() -> Iterator[str]:
    """Yield a base server DSN to provision throwaway tenant databases on.

    Uses ``BYOD_TEST_TENANT_DSN`` if set, otherwise a pgvector testcontainer.
    Raises ``TenantDBUnavailable`` if neither is available. Reuse one server
    across many tests (session scope) and create a fresh database per test.
    """
    base_dsn = os.getenv("BYOD_TEST_TENANT_DSN")
    if base_dsn:
        yield _normalize_dsn(base_dsn)
    else:
        with _testcontainer_db() as dsn:
            yield dsn


@contextmanager
def ephemeral_database(server_dsn: str) -> Iterator[str]:
    """Create + provision a fresh isolated database on ``server_dsn``; drop it on exit."""
    with _ephemeral_db_on_server(server_dsn) as dsn:
        provision(dsn)
        yield dsn


@contextmanager
def bare_ephemeral_database(server_dsn: str) -> Iterator[str]:
    """A fresh isolated database with NO schema provisioned; dropped on exit.

    For control-plane tests (RFC Phase 1.2+) that need a clean Postgres to apply
    their own DDL — unlike :func:`ephemeral_database`, this does not lay down the
    data-plane (tenant) fixture schema.
    """
    with _ephemeral_db_on_server(server_dsn) as dsn:
        yield dsn


@contextmanager
def ephemeral_tenant_db() -> Iterator[str]:
    """Yield a DSN to a provisioned, throwaway tenant Postgres+pgvector DB.

    Convenience composition of :func:`open_tenant_server` +
    :func:`ephemeral_database` for standalone use. Raises
    ``TenantDBUnavailable`` if no backend is available.
    """
    with open_tenant_server() as server_dsn:
        with ephemeral_database(server_dsn) as dsn:
            yield dsn
