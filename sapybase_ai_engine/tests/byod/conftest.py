"""Pytest fixtures for the BYOD tenant-Postgres harness (RFC Phase 0.1)."""
from __future__ import annotations

import uuid
from typing import Callable, Iterator

import psycopg2
import pytest

from db.byod_store import CONTROL_PLANE_SCHEMA_SQL

from .tenant_harness import (
    TenantDBUnavailable,
    bare_ephemeral_database,
    ephemeral_database,
    open_tenant_server,
)


@pytest.fixture(scope="session")
def tenant_db_server() -> Iterator[str]:
    """One ephemeral Postgres+pgvector server for the whole test session.

    Skips the dependent tests (instead of failing) when no backend is
    available, so the suite stays green on machines without Docker or a
    configured BYOD_TEST_TENANT_DSN.
    """
    try:
        with open_tenant_server() as server_dsn:
            yield server_dsn
    except TenantDBUnavailable as exc:
        pytest.skip(str(exc))


@pytest.fixture
def tenant_db_dsn(tenant_db_server: str) -> Iterator[str]:
    """A fresh, provisioned, isolated tenant database per test; dropped on teardown."""
    with ephemeral_database(tenant_db_server) as dsn:
        yield dsn


@pytest.fixture
def tenant_conn(tenant_db_dsn: str) -> Iterator[psycopg2.extensions.connection]:
    """A psycopg2 connection to the per-test tenant DB, with pgvector registered."""
    conn = psycopg2.connect(tenant_db_dsn)
    try:
        from pgvector.psycopg2 import register_vector

        register_vector(conn)
        yield conn
    finally:
        conn.close()


@pytest.fixture
def control_plane_db_dsn(tenant_db_server: str) -> Iterator[str]:
    """A fresh, bare (un-provisioned) database per test for control-plane tests.

    The BYOD control-plane tables live on Sapybase's own Postgres, not on a
    tenant DB; this gives those tests a clean server to apply their own DDL to.
    """
    with bare_ephemeral_database(tenant_db_server) as dsn:
        yield dsn


@pytest.fixture
def cp_conn(control_plane_db_dsn: str) -> Iterator[psycopg2.extensions.connection]:
    """A control-plane DB connection with a stub `companies` table + the migration DDL applied.

    Shared by the Phase 1.2 store tests and the Phase 1.3 crypto-integration tests.
    """
    conn = psycopg2.connect(control_plane_db_dsn)
    try:
        with conn.cursor() as cur:
            # Minimal stand-in for the real companies table (the FK target).
            cur.execute("CREATE TABLE IF NOT EXISTS companies (id UUID PRIMARY KEY)")
            cur.execute(CONTROL_PLANE_SCHEMA_SQL)  # "migration applies"
        conn.commit()
        yield conn
    finally:
        conn.close()


@pytest.fixture
def make_company(cp_conn: psycopg2.extensions.connection) -> Callable[[], str]:
    """Factory: insert a fresh companies row and return its id."""

    def _create() -> str:
        company_id = str(uuid.uuid4())
        with cp_conn.cursor() as cur:
            cur.execute("INSERT INTO companies (id) VALUES (%s)", (company_id,))
        cp_conn.commit()
        return company_id

    return _create
