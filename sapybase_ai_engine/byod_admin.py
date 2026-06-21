"""BYOD super-admin config logic: create-from-template, masked URL, Test, connection.

RFC docs/rfc-byod.md Phase 2.1 (§3.1 fully super-admin configurable). This is the
first phase that wires the dark Phase-1 modules (validate / encrypt / store)
together behind the super-admin surface, while everything still ships dark
(routing real traffic is Phase 3).

BYOD is a **specialization of the existing Custom-Plan machinery** (§3): putting a
client on BYOD seeds a per-client ``custom_plan_config`` from the
``BYOD_PLAN_DEFAULTS`` template, after which the super-admin can override **every**
field through the existing ``PATCH /custom-plan/override`` and ``/limits``
endpoints (override persists & resolves exactly as CUSTOM already does). On top of
that, BYOD adds the DB connection: the DSN is validated (Phase 1.4), envelope-
encrypted (Phase 1.3), and stored ciphertext-only (Phase 1.2), and is only ever
shown **masked** (§5.1) — never decrypted just to display it.

This module holds the cursor-taking business logic (caller owns the transaction /
commit, mirroring byod_store), so it is unit-testable against an ephemeral control-
plane Postgres. The thin FastAPI endpoints in main.py translate these into HTTP
and map the typed errors to status codes (404 / 400 / 503), never logging a DSN.
"""
from __future__ import annotations

import json
import secrets
from typing import Callable, Optional, Sequence

import byod_crypto
import byod_dataplane
import byod_health
import byod_probe
import byod_store
from byod_dsn import validate_db_url
from byod_store import TenantDbStatus
from config import BYOD_PLAN_DEFAULTS
from models import CustomPlanConfig

# Bytes of entropy for the generated vaayu_runtime password (token_urlsafe).
_RUNTIME_PASSWORD_BYTES = 32

# §5.1: the only DSN form ever shown in the UI. Produced WITHOUT decrypting the
# stored ciphertext — there is nothing to reveal, so KMS is not touched here.
MASKED_URL = "postgresql://••••@••••"

# §16.6: a fixed namespace for the per-tenant provisioning advisory lock, so the
# (namespace, hashtext(company_id)) key can't collide with any other advisory
# lock domain. 0x42594F44 == b"BYOD"; fits a signed int4.
_PROVISION_LOCK_NAMESPACE = 0x42594F44

Resolver = Callable[[str], Sequence[str]]
Connector = Callable[[str], object]


class ByodAdminError(Exception):
    """Base class for BYOD admin-logic failures."""


class UserNotFound(ByodAdminError):
    """No user with the given clerk_id."""


class CompanyNotFound(ByodAdminError):
    """The user has no company to attach a tenant database to."""


class ConnectionNotConfigured(ByodAdminError):
    """No tenant DSN has been stored yet — call set_connection before provisioning."""


class RoutingNotLive(ByodAdminError):
    """Routing can only be ENABLED for a LIVE (provisioned + healthy) tenant."""


def seed_byod_config() -> dict:
    """Build the per-client ``custom_plan_config`` seed from the BYOD template
    (§3.1). Validated through :class:`CustomPlanConfig` so it can never drift from
    the schema the override endpoints accept."""
    cfg = CustomPlanConfig(**BYOD_PLAN_DEFAULTS)
    return cfg.model_dump(exclude_none=False)


def resolve_company_id(cur, clerk_id: str) -> Optional[str]:
    """Map an admin-facing ``clerk_id`` to its ``company_id`` (the key everything
    in the data plane is routed by). Returns None if the user has no company."""
    cur.execute(
        """
        SELECT c.id::text
          FROM companies c
          JOIN users u ON c.user_id = u.id
         WHERE u.clerk_id = %s
        """,
        (clerk_id,),
    )
    row = cur.fetchone()
    return row[0] if row else None


def enroll_in_byod(cur, clerk_id: str) -> dict:
    """Create-from-template: put the user on a CUSTOM tier seeded from the BYOD
    template (§3.1). The super-admin can then override any field via the existing
    custom-plan endpoints. Caller commits. Raises :class:`UserNotFound`."""
    cur.execute("SELECT id FROM users WHERE clerk_id = %s", (clerk_id,))
    if cur.fetchone() is None:
        raise UserNotFound(clerk_id)
    cfg = seed_byod_config()
    cur.execute(
        "UPDATE users SET tier = 'CUSTOM', custom_plan_config = %s WHERE clerk_id = %s",
        (json.dumps(cfg), clerk_id),
    )
    return cfg


def test_dsn(
    dsn: str,
    *,
    resolver: Optional[Resolver] = None,
    connect: Optional[Connector] = None,
) -> dict:
    """The **Test** button (Phase 2.2): validate the DSN (SSRF + DNS re-check +
    param allowlist + TLS, Phase 1.4) **and** open a real connection to prove the
    database can back the engine — pgvector installed at a supported version and
    a ``vector(768)`` column creatable (§16.7). Stores nothing.

    Raises ``DsnValidationError`` on an unsafe DSN (before connecting) or a
    :class:`byod_probe.ProbeError` if the DB is unreachable / incompatible. On
    success returns the safe (password-free) parsed view + proven capabilities."""
    result = byod_probe.probe_tenant_database(dsn, resolver=resolver, connect=connect)
    return {
        "ok": True,
        "masked_url": MASKED_URL,
        "host": result.host,
        "port": result.port,
        "dbname": result.dbname,
        "sslmode": result.sslmode,
        "pgvector_version": result.pgvector_version,
        "server_version": result.server_version,
        "embedding_dimensions": result.embedding_dimensions,
    }


def set_connection(
    cur,
    clerk_id: str,
    dsn: str,
    kms: byod_crypto.KmsProvider,
    *,
    resolver: Optional[Resolver] = None,
) -> dict:
    """Validate (fail-closed), envelope-encrypt, and store a tenant DSN as a
    ``PENDING`` record (onboarding / rotate-URL entry point). Caller commits.

    Never returns or logs the plaintext DSN. Raises :class:`CompanyNotFound`,
    ``DsnValidationError`` (bad DSN → 400), or ``KmsUnavailable`` (→ 503)."""
    company_id = resolve_company_id(cur, clerk_id)
    if company_id is None:
        raise CompanyNotFound(clerk_id)
    # Validate before trusting (§4.1 step 2) — raises on anything unsafe.
    if resolver is None:
        validate_db_url(dsn)
    else:
        validate_db_url(dsn, resolver=resolver)
    record = byod_crypto.store_encrypted_dsn(
        cur, company_id, dsn, kms, status=byod_store.TenantDbStatus.PENDING
    )
    return {"company_id": company_id, "masked_url": MASKED_URL, "status": record.status}


# Only LIVE is terminal: a re-submit there is a no-op. PROVISIONING means a prior
# attempt is in flight or crashed mid-pipeline — since every step is idempotent
# (advisory-locked + IF-NOT-EXISTS DDL), re-running safely drives it to LIVE.
_PROVISIONED_STATUSES = frozenset({TenantDbStatus.LIVE})


def _acquire_provision_lock(cur, company_id: str) -> None:
    """Take a transaction-scoped advisory lock on the control plane for this
    tenant (§16.6). Two concurrent provisions of the same company serialize here:
    the second blocks until the first commits/rolls back (auto-releasing the
    lock), then observes the updated status and short-circuits. Keyed by
    (namespace, hashtext(company_id)) so it can't collide with other lock uses."""
    cur.execute(
        "SELECT pg_advisory_xact_lock(%s, hashtext(%s))",
        (_PROVISION_LOCK_NAMESPACE, company_id),
    )


def provision(
    cur,
    clerk_id: str,
    kms: byod_crypto.KmsProvider,
    *,
    resolver: Optional[Resolver] = None,
    connect: Optional[Connector] = None,
) -> dict:
    """Provision a stored tenant database end-to-end (RFC §4.1 / A.5, Phases
    2.2+2.3): decrypt the migrate DSN in memory, re-validate it, **probe** it
    (pgvector + ``vector(768)`` + min version §16.7), **apply the data-plane
    schema** and **create the DML-only ``vaayu_runtime`` role** (§5.4), store the
    derived runtime DSN, **record the schema version** (§8.1), and flip the record
    to ``LIVE``.

    **Idempotent & advisory-locked (§16.6):** a transaction-scoped advisory lock
    serializes concurrent calls for the same tenant, so a double-click can't run
    the pipeline twice or leave a half-written state. Already ``LIVE`` → safe
    no-op. A prior crash leaves ``PROVISIONING``/``ERROR``; because every step is
    idempotent (IF-NOT-EXISTS DDL, role-if-exists), re-running safely completes it.
    On any failure the record is moved to ``ERROR`` (isolated + alertable, §10)
    and the error re-raised.

    Caller owns the transaction (commit on success / on the persisted ``ERROR`` /
    rollback — any of which releases the advisory lock). Raises
    :class:`CompanyNotFound`, :class:`ConnectionNotConfigured`,
    ``DsnValidationError``, ``KmsUnavailable``, :class:`byod_probe.ProbeError`, or
    :class:`byod_dataplane.DataPlaneProvisionError`. Never logs/returns a DSN."""
    company_id = resolve_company_id(cur, clerk_id)
    if company_id is None:
        raise CompanyNotFound(clerk_id)

    # Serialize concurrent provisions for this tenant before reading status.
    _acquire_provision_lock(cur, company_id)

    record = byod_store.get_tenant_db_record(cur, company_id)
    if record is None:
        raise ConnectionNotConfigured(clerk_id)

    # Idempotency: a re-submit once LIVE does nothing (no re-probe, no re-apply).
    if record.status in _PROVISIONED_STATUSES:
        return {
            "company_id": company_id,
            "masked_url": MASKED_URL,
            "status": record.status,
            "schema_version": record.schema_version,
            "idempotent": True,
        }

    # Decrypt the privileged (migrate) DSN in memory only (rule 7) — never logged.
    dsn = byod_crypto.load_decrypted_dsn(cur, company_id, kms)
    if dsn is None:
        raise ConnectionNotConfigured(clerk_id)

    try:
        byod_store.update_tenant_db_status(cur, company_id, TenantDbStatus.PROVISIONING)

        # 1. Probe: prove pgvector + vector(768) + min version, no mutation.
        probe = byod_probe.probe_tenant_database(dsn, resolver=resolver, connect=connect)

        # 2. Apply schema + create the DML-only runtime role (migrate connection).
        runtime_password = secrets.token_urlsafe(_RUNTIME_PASSWORD_BYTES)
        schema_version = byod_dataplane.provision_tenant_database(
            dsn,
            dbname=probe.dbname,
            runtime_password=runtime_password,
            connect=connect,
        )
        runtime_dsn = byod_dataplane.build_runtime_dsn(dsn, runtime_password)

        # 3. Health gate (§4.1 step 4): prove the *runtime* credential works
        #    end-to-end BEFORE persisting it or flipping LIVE — so a failure here
        #    leaves no partial state on the control plane (status -> ERROR only).
        byod_health.run_health_check(runtime_dsn, resolver=resolver, connect=connect)

        # 4. Healthy: store the runtime DSN (encrypted), record version, go LIVE.
        byod_crypto.store_encrypted_runtime_dsn(cur, company_id, runtime_dsn, kms)
        byod_store.update_tenant_db_schema_version(cur, company_id, schema_version)
        byod_store.update_tenant_db_status(cur, company_id, TenantDbStatus.LIVE)
        # Phase 5: provisioning ran a health probe and the tenant is now LIVE, so any
        # open client change request (e.g. a reconnect after a password rotation) is
        # resolved — record the probe time and clear the fleet-list flag.
        byod_store.set_last_health_at(cur, company_id)
        byod_store.clear_pending_change_request(cur, company_id)
    except Exception:
        # Fail-soft on availability: isolate this tenant in ERROR and alert (§10).
        byod_store.update_tenant_db_status(cur, company_id, TenantDbStatus.ERROR)
        raise

    return {
        "company_id": company_id,
        "masked_url": MASKED_URL,
        "status": TenantDbStatus.LIVE,
        "schema_version": schema_version,
        "pgvector_version": probe.pgvector_version,
        "server_version": probe.server_version,
        "embedding_dimensions": probe.embedding_dimensions,
        "idempotent": False,
    }


def check_health(
    cur,
    clerk_id: str,
    kms: byod_crypto.KmsProvider,
    *,
    resolver: Optional[Resolver] = None,
    connect: Optional[Connector] = None,
) -> dict:
    """On-demand health probe of a provisioned tenant (RFC §4.4 / §10 status
    surfacing). Connects with the **runtime** DSN, verifies liveness + data-plane
    reachability, and reflects the outcome in the lifecycle status:

      * healthy           -> ``LIVE`` (confirms / recovers from a prior error),
      * auth failure       -> ``NEEDS_RECONNECT`` (client rotated the DB password),
      * unreachable / bad  -> ``ERROR``.

    Caller commits (persisting the status) on both success and the health-error
    paths. Raises :class:`CompanyNotFound`, :class:`ConnectionNotConfigured` (not
    provisioned yet), ``KmsUnavailable``, or a :class:`byod_health.HealthError`.
    Never logs or returns the plaintext DSN."""
    company_id = resolve_company_id(cur, clerk_id)
    if company_id is None:
        raise CompanyNotFound(clerk_id)

    runtime_dsn = byod_crypto.load_decrypted_runtime_dsn(cur, company_id, kms)
    if runtime_dsn is None:
        raise ConnectionNotConfigured(clerk_id)

    try:
        result = byod_health.run_health_check(runtime_dsn, resolver=resolver, connect=connect)
    except byod_health.TenantAuthFailed:
        byod_store.update_tenant_db_status(cur, company_id, TenantDbStatus.NEEDS_RECONNECT)
        raise
    except Exception:
        byod_store.update_tenant_db_status(cur, company_id, TenantDbStatus.ERROR)
        raise

    byod_store.update_tenant_db_status(cur, company_id, TenantDbStatus.LIVE)
    byod_store.set_last_health_at(cur, company_id)  # Phase 5: record the probe time
    return {
        "company_id": company_id,
        "status": TenantDbStatus.LIVE,
        "healthy": result.healthy,
    }


def set_routing(cur, clerk_id: str, enabled: bool) -> dict:
    """Flip the Phase 3 routing switch for a tenant (UI plan §2.1 / §3 human gate).

    ENABLE is allowed only from ``LIVE`` (a tenant must be provisioned + healthy
    before it can serve real traffic — the §3 human gate). DISABLE is allowed from
    any state and is idempotent (it cuts the tenant back to the shared path while
    keeping its credentials). Caller commits, then invalidates the routing-decision
    cache so the toggle takes effect immediately. Raises :class:`CompanyNotFound`,
    :class:`ConnectionNotConfigured` (no row yet), or :class:`RoutingNotLive`
    (enable attempted on a non-LIVE tenant)."""
    company_id = resolve_company_id(cur, clerk_id)
    if company_id is None:
        raise CompanyNotFound(clerk_id)
    record = byod_store.get_tenant_db_record(cur, company_id)
    if record is None:
        raise ConnectionNotConfigured(clerk_id)
    if enabled and record.status != TenantDbStatus.LIVE:
        raise RoutingNotLive(record.status)
    byod_store.set_routing_enabled(cur, company_id, enabled)
    return {
        "company_id": company_id,
        "status": record.status,
        "routing_enabled": enabled,
    }


def get_admin_view(cur, clerk_id: str) -> dict:
    """The admin BYOD panel surface: plan overrides (editable) + the connection
    block (masked URL, status, schema version — read-only). Never decrypts the
    DSN. Raises :class:`UserNotFound`."""
    cur.execute(
        "SELECT tier, custom_plan_config FROM users WHERE clerk_id = %s",
        (clerk_id,),
    )
    row = cur.fetchone()
    if row is None:
        raise UserNotFound(clerk_id)
    tier, cfg_raw = row
    cfg = _as_dict(cfg_raw)

    company_id = resolve_company_id(cur, clerk_id)
    connection = None
    if company_id is not None:
        record = byod_store.get_tenant_db_record(cur, company_id)
        if record is not None:
            connection = {
                "masked_url": MASKED_URL,  # §5.1 — never the real DSN
                "status": record.status,
                "is_live": record.status == TenantDbStatus.LIVE,  # health surface
                "provisioned": record.runtime_dsn_ciphertext is not None,
                "routing_enabled": record.routing_enabled,  # Phase 3 switch state
                "schema_version": record.schema_version,
                "key_id": record.dsn_key_id,
                "created_at": _iso(record.created_at),
                "updated_at": _iso(record.updated_at),
                "last_health_at": _iso(record.last_health_at),  # Phase 5
            }

    return {
        "clerk_id": clerk_id,
        "company_id": company_id,
        "tier": tier,
        "byo_database": bool(cfg.get("byo_database")),
        "overrides": cfg,
        "connection": connection,
        # Phase 5: the client's open change request (the fleet-list flag), so the
        # admin drawer can show + dismiss it. None when there is no open request.
        "pending_change": _pending_change(record) if connection is not None else None,
    }


def _pending_change(record) -> Optional[dict]:
    """Project a tenant record's open change request (UI plan Phase 5) into the safe
    admin/client shape, or None when there is no open request."""
    if record is None or not record.pending_change_kind:
        return None
    return {
        "kind": record.pending_change_kind,
        "note": record.pending_change_note,
        "requested_at": _iso(record.pending_change_at),
    }


def clear_change_request(cur, clerk_id: str) -> dict:
    """Dismiss a client's open change request (UI plan Phase 5): the admin has acted
    on (or is acknowledging) the reconnect/leave signal, so clear the fleet-list flag.
    Performs no lifecycle mutation. Caller commits. Raises :class:`CompanyNotFound`."""
    company_id = resolve_company_id(cur, clerk_id)
    if company_id is None:
        raise CompanyNotFound(clerk_id)
    cleared = byod_store.clear_pending_change_request(cur, company_id)
    return {"company_id": company_id, "cleared": cleared}


def _as_dict(raw: object) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return {}
    return {}


def _iso(value: object) -> Optional[str]:
    return value.isoformat() if hasattr(value, "isoformat") else None
