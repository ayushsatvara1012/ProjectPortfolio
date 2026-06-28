"""Admin BYOD fleet-list store gate (UI plan Phase 1a).

Covers ``byod_store.list_all_tenants`` — the all-states projection the admin
panel's tenant table renders. Unlike ``list_live_tenants`` (LIVE-only, used by
the migration orchestrator), this must surface every lifecycle state, join the
owning company name + clerk_id, and carry **no** credential material.

Self-contained schema: the shared ``cp_conn`` fixture only stubs
``companies(id)``, so here we additively enrich it (company_name + user_id) and
add a minimal ``users`` stub, matching the real join shape
(``byod_tenant_databases`` -> ``companies`` -> ``users``).
"""
from __future__ import annotations

import uuid

import pytest

from db.byod_store import (
    TenantDbStatus,
    TenantSummary,
    list_all_tenants,
    set_pending_change_request,
    set_routing_enabled,
    store_tenant_db_record,
    update_tenant_db_status,
)


@pytest.fixture
def fleet_schema(cp_conn):
    """Enrich the stub control-plane schema to the columns the join reads."""
    with cp_conn.cursor() as cur:
        cur.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_name TEXT")
        cur.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS user_id UUID")
        cur.execute("CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, clerk_id TEXT)")
    cp_conn.commit()
    return cp_conn


@pytest.fixture
def make_tenant(fleet_schema):
    """Factory: create user + company + a tenant row in a given status.

    Returns the ``(company_id, clerk_id, company_name)`` so a test can assert the
    joined projection. ``with_user=False`` exercises the LEFT JOIN (orphan owner).
    """
    conn = fleet_schema

    def _create(status=TenantDbStatus.PENDING, *, company_name="Acme", with_user=True,
                routing_enabled=False):
        company_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        clerk_id = f"user_{uuid.uuid4().hex[:12]}" if with_user else None
        with conn.cursor() as cur:
            if with_user:
                cur.execute(
                    "INSERT INTO users (id, clerk_id) VALUES (%s, %s)", (user_id, clerk_id)
                )
            cur.execute(
                "INSERT INTO companies (id, company_name, user_id) VALUES (%s, %s, %s)",
                (company_id, company_name, user_id if with_user else None),
            )
            store_tenant_db_record(cur, company_id, dsn_ciphertext=b"enc", dsn_key_id="k")
            if status != TenantDbStatus.PENDING:
                update_tenant_db_status(cur, company_id, status)
            if routing_enabled:
                set_routing_enabled(cur, company_id, True)
        conn.commit()
        return company_id, clerk_id, company_name

    return _create


def test_empty_fleet_returns_empty_list(fleet_schema):
    with fleet_schema.cursor() as cur:
        assert list_all_tenants(cur) == []


def test_lists_all_lifecycle_states(make_tenant, fleet_schema):
    # One tenant in each non-PENDING terminal-ish state + a PENDING one.
    states = [
        TenantDbStatus.PENDING,
        TenantDbStatus.LIVE,
        TenantDbStatus.DISABLED,
        TenantDbStatus.NEEDS_RECONNECT,
        TenantDbStatus.ERROR,
    ]
    created = {make_tenant(status=s)[0]: s for s in states}

    with fleet_schema.cursor() as cur:
        rows = list_all_tenants(cur)

    assert len(rows) == len(states)
    assert all(isinstance(r, TenantSummary) for r in rows)
    assert {r.company_id: r.status for r in rows} == created


def test_projection_joins_owner_and_carries_no_credentials(make_tenant, fleet_schema):
    company_id, clerk_id, name = make_tenant(status=TenantDbStatus.LIVE, company_name="Globex")

    with fleet_schema.cursor() as cur:
        [row] = list_all_tenants(cur)

    assert row.company_id == company_id
    assert row.clerk_id == clerk_id
    assert row.company_name == "Globex"
    assert row.status == TenantDbStatus.LIVE
    assert row.created_at is not None and row.updated_at is not None
    # The summary is a safe projection — no DSN / ciphertext fields exist on it.
    assert not any("dsn" in f or "cipher" in f for f in row.__dataclass_fields__)


def test_routing_enabled_surfaces_in_summary(make_tenant, fleet_schema):
    make_tenant(status=TenantDbStatus.LIVE, routing_enabled=True)
    with fleet_schema.cursor() as cur:
        [row] = list_all_tenants(cur)
    assert row.routing_enabled is True


def test_pending_change_request_surfaces_in_summary(make_tenant, fleet_schema):
    # Phase 5: a client's open change request is the "flag on the fleet list".
    company_id, _, _ = make_tenant(status=TenantDbStatus.LIVE)
    with fleet_schema.cursor() as cur:
        set_pending_change_request(cur, company_id, "reconnect", "rotated")
    fleet_schema.commit()

    with fleet_schema.cursor() as cur:
        [row] = list_all_tenants(cur)
    assert row.pending_change_kind == "reconnect"
    assert row.pending_change_at is not None
    # A tenant with no request reports a clean flag.
    assert row.last_health_at is None


def test_provisioned_flag_reflects_runtime_dsn(make_tenant, fleet_schema):
    # A bare PENDING row has no runtime DSN yet -> provisioned is False.
    make_tenant(status=TenantDbStatus.PENDING)
    with fleet_schema.cursor() as cur:
        [row] = list_all_tenants(cur)
    assert row.provisioned is False


def test_left_join_keeps_tenant_without_user(make_tenant, fleet_schema):
    make_tenant(status=TenantDbStatus.PENDING, with_user=False)
    with fleet_schema.cursor() as cur:
        [row] = list_all_tenants(cur)
    assert row.clerk_id is None  # orphan owner still lists (LEFT JOIN)
