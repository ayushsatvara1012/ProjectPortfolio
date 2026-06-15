"""Phase 0.1 test gate: spin a tenant DB, run a vector query, tear it down.

Exit criteria (RFC §13, Phase 0.1):
    "CI spins a tenant DB, runs a vector query, tears it down."

These tests exercise the harness end to end against a *real* Postgres+pgvector
database (testcontainer locally, service container in CI). They skip cleanly if
no backend is available, so the broader suite is unaffected.
"""
from __future__ import annotations

from embedding_config import EMBEDDING_DIMENSIONS

from .tenant_harness import (
    KNOWLEDGE_FIXTURES,
    TENANT_COMPANY_ID,
    make_embedding,
    vector_literal,
)


def test_pgvector_extension_and_dimension(tenant_conn) -> None:
    """The tenant DB has pgvector and the embedding column matches EMBEDDING_DIMENSIONS."""
    with tenant_conn.cursor() as cur:
        cur.execute("SELECT extname FROM pg_extension WHERE extname = 'vector'")
        assert cur.fetchone() is not None, "pgvector extension not installed on tenant DB"

        # The vector column's declared dimension must equal embedding_config —
        # format_type renders the typmod as e.g. 'vector(768)'.
        cur.execute(
            """
            SELECT format_type(a.atttypid, a.atttypmod)
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            WHERE c.relname = 'company_knowledge' AND a.attname = 'embedding'
            """
        )
        col_type = cur.fetchone()[0]
        assert col_type == f"vector({EMBEDDING_DIMENSIONS})", col_type


def test_fixtures_seeded(tenant_conn) -> None:
    """Seed data landed for the known tenant."""
    with tenant_conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM company_knowledge WHERE company_id = %s",
            (TENANT_COMPANY_ID,),
        )
        assert cur.fetchone()[0] == len(KNOWLEDGE_FIXTURES)


def test_vector_query_returns_nearest_neighbour(tenant_conn) -> None:
    """The core gate: a cosine-distance vector search returns the expected row.

    Querying with the embedding of a known fixture must return that fixture as
    the nearest neighbour (distance ~0), mirroring the production RAG operator
    (`embedding <=> %s::vector`).
    """
    target = KNOWLEDGE_FIXTURES[0]
    query_vec = vector_literal(make_embedding(target.seed))

    with tenant_conn.cursor() as cur:
        cur.execute(
            """
            SELECT url, content, embedding <=> %s::vector AS distance
            FROM company_knowledge
            WHERE company_id = %s
            ORDER BY embedding <=> %s::vector
            LIMIT 1
            """,
            (query_vec, TENANT_COMPANY_ID, query_vec),
        )
        row = cur.fetchone()

    assert row is not None
    url, content, distance = row
    assert url == target.url
    assert content == target.content
    assert distance < 1e-6, f"expected near-zero cosine distance, got {distance}"


def test_tenant_db_is_torn_down(tenant_db_server) -> None:
    """The ephemeral database is dropped after use (true spin-up → teardown)."""
    from urllib.parse import urlsplit

    import psycopg2

    from .tenant_harness import ephemeral_database

    with ephemeral_database(tenant_db_server) as dsn:
        db_name = urlsplit(dsn).path.lstrip("/")
        psycopg2.connect(dsn).close()  # sanity: connectable while alive

    # After the context exits the database must be gone from the server catalog.
    admin = psycopg2.connect(tenant_db_server)
    admin.autocommit = True
    try:
        with admin.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
            assert cur.fetchone() is None, "tenant database was not dropped"
    finally:
        admin.close()
