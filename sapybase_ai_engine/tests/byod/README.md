# BYOD test harness

Test infrastructure for the Build-Your-Own-Database feature (see
[`docs/rfc-byod.md`](../../../docs/rfc-byod.md)). This package provides an
**ephemeral tenant Postgres + pgvector** database so every BYOD phase can be
tested against a *real* remote-tenant database rather than a mock.

## Phase 0.1 gate

> CI spins a tenant DB, runs a vector query, tears it down.

Implemented by [`test_tenant_db_harness.py`](test_tenant_db_harness.py).

## Running locally

Two ways — the harness picks a backend automatically:

1. **Zero-config (Docker):** just run the tests. The harness starts a
   `pgvector/pgvector:pg16` container via `testcontainers` and tears it down
   afterwards. Requires Docker running and the dev deps installed:

   ```bash
   pip install -r requirements-dev.txt
   pytest tests/byod -v
   ```

2. **Point at an existing server:** set `BYOD_TEST_TENANT_DSN` to any
   Postgres+pgvector server. The harness creates a uniquely named database on
   it per test and drops it on teardown (so the server is never polluted):

   ```bash
   export BYOD_TEST_TENANT_DSN=postgresql://postgres:postgres@localhost:5432/postgres
   pytest tests/byod -v
   ```

If neither Docker nor `BYOD_TEST_TENANT_DSN` is available, the tests **skip**
(they never fail), so the rest of the suite is unaffected.

## In CI

The `byod-tenant-harness` job in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)
runs a `pgvector/pgvector:pg16` service container and sets `BYOD_TEST_TENANT_DSN`
to it.

## Fixtures

- `tenant_db_server` (session) — one ephemeral server for the whole run.
- `tenant_db_dsn` (per-test) — a fresh provisioned database; dropped on teardown.
- `tenant_conn` (per-test) — a psycopg2 connection with pgvector registered.

Seed data and the deterministic embedding helper live in
[`tenant_harness.py`](tenant_harness.py); the fixture schema is
[`data_plane_schema.sql`](data_plane_schema.sql). The vector column dimension is
locked to `EMBEDDING_DIMENSIONS` from `embedding_config.py` (substituted at load
time) so the two can never silently drift.

> The fixture schema is a minimal, representative slice — **not** the
> authoritative data-plane migration set, which arrives in Phase 3.1.
