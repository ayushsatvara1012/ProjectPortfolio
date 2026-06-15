"""Pytest fixtures for the BYOD tenant-Postgres harness (RFC Phase 0.1)."""
from __future__ import annotations

from typing import Iterator

import psycopg2
import pytest

from .tenant_harness import (
    TenantDBUnavailable,
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
