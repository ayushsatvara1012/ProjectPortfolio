"""BYOD control-plane store: per-tenant encrypted-DSN registry + routing.

RFC docs/rfc-byod.md Phase 1.2 (§2, §6, §8.1). This is the **control-plane**
record for a BYOD tenant — it lives on Sapybase's own Postgres (the trusted,
authoritative plane), NOT on the client's database. One row per BYOD
``company_id`` holds:

  * the **encrypted DSN** (envelope-encryption fields — RFC §5.1; the actual KMS
    encrypt/decrypt is wired in Phase 1.3, so here we only store opaque
    ciphertext — PLAINTEXT IS NEVER STORED),
  * the **routing** pointer: ``company_id`` IS the key the engine resolves to a
    tenant DB (the row is the "ref"); routing is derived only server-side (E5),
  * the tenant DB's data-plane **schema_version** (the registry of §8.1), and
  * the provisioning **status** (lifecycle of §4 / §10 / §16.5).

Design notes:
  * Import-light **on purpose** (stdlib only at runtime) so the Alembic migration
    that ships this table can import :data:`CONTROL_PLANE_SCHEMA_SQL` without
    pulling the engine. The store functions take a DB **cursor** (dependency
    injection) — they never open or commit a connection, so the caller owns the
    transaction. Control-plane callers use the existing global pool (RFC A.3:
    "Control-plane handlers keep the existing global pool"); these helpers do not
    touch ``get_tenant_db`` (that is for the data plane only).
  * No runtime caller exists yet — onboarding (Phase 2) and the engine cutover
    (Phase 3) wire it in. It ships dark, like the rest of Phase 0–1.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:  # keep psycopg2 out of the runtime import path (alembic safety)
    from psycopg2.extensions import cursor as _Cursor

TABLE_NAME = "byod_tenant_databases"


# ── Provisioning lifecycle status ────────────────────────────────────────────
# Fail-closed on security, fail-soft on availability (RFC rule 10). The engine
# only opens a tenant connection for a LIVE row; every other state means "do not
# route real traffic" for that tenant — in isolation from all others.
class TenantDbStatus:
    PENDING = "PENDING"                # row created; DSN stored; not yet provisioned
    PROVISIONING = "PROVISIONING"      # migrations / role setup in flight (§4.1)
    LIVE = "LIVE"                      # health probe passed; engine may route here
    NEEDS_RECONNECT = "NEEDS_RECONNECT"  # auth failed (client rotated password, §16.5)
    DISABLED = "DISABLED"             # billing block / offboard-soft: stop connecting, keep creds (§16.6)
    ERROR = "ERROR"                  # provisioning/health failure; isolated + alerted (§10)


TENANT_DB_STATUSES: frozenset[str] = frozenset(
    {
        TenantDbStatus.PENDING,
        TenantDbStatus.PROVISIONING,
        TenantDbStatus.LIVE,
        TenantDbStatus.NEEDS_RECONNECT,
        TenantDbStatus.DISABLED,
        TenantDbStatus.ERROR,
    }
)

# Columns, in a single canonical order reused by every SELECT / RETURNING so the
# row→record mapping can never drift.
_COLUMNS = (
    "company_id",
    "dsn_ciphertext",
    "dsn_data_key",
    "dsn_nonce",
    "dsn_key_id",
    "runtime_dsn_ciphertext",
    "runtime_dsn_data_key",
    "runtime_dsn_nonce",
    "runtime_dsn_key_id",
    "schema_version",
    "status",
    "created_at",
    "updated_at",
    "routing_enabled",
    "pending_change_kind",
    "pending_change_note",
    "pending_change_at",
    "last_health_at",
)
_COLS_SQL = ", ".join(_COLUMNS)


# ── Schema (idempotent) ──────────────────────────────────────────────────────
# Shared by the Alembic migration (0014) AND the test harness, so the migrated
# table and the tested table are byte-for-byte the same DDL — no drift.
# NOTE: keep this DDL string strictly ASCII (no section signs / arrows) so it
# encodes safely regardless of the server's client_encoding. The rich RFC
# notation lives in this module's Python comments instead.
CONTROL_PLANE_SCHEMA_SQL = f"""
CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
    -- Routing key: resolved server-side from the authenticated bot/api_key -> company.
    -- One BYOD database per company (BYOD caps max_bots = 1). The row IS the
    -- company_id -> tenant-DB reference. ON DELETE CASCADE only removes THIS
    -- control-plane metadata when a company is deleted -- never the client's data.
    company_id      UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,

    -- Encrypted DSN (envelope encryption, RFC sec 5.1). Only ciphertext is stored.
    -- Phase 1.2 persists opaque bytes; Phase 1.3 fills these from the KMS path:
    --   dsn_ciphertext = DB URL encrypted under a per-record data key
    --   dsn_data_key   = that data key, wrapped by the KMS master key
    --   dsn_nonce      = AEAD nonce/IV
    --   dsn_key_id     = versioned master-key id (enables rotation, sec 16.5)
    dsn_ciphertext  BYTEA NOT NULL,
    dsn_data_key    BYTEA,
    dsn_nonce       BYTEA,
    dsn_key_id      TEXT  NOT NULL,

    -- Runtime (DML-only vaayu_runtime) DSN, envelope-encrypted the same way as
    -- the migrate DSN above (RFC sec 5.4 / Phase 2.3). NULL until provisioning
    -- creates the runtime role; this is the credential the engine request path
    -- uses (Phase 3), while the dsn_* columns above are the privileged migrate
    -- credential used only at provisioning/migration time.
    runtime_dsn_ciphertext  BYTEA,
    runtime_dsn_data_key    BYTEA,
    runtime_dsn_nonce       BYTEA,
    runtime_dsn_key_id      TEXT,

    -- Schema-version registry (sec 8.1): the tenant DB's current data-plane
    -- alembic version, mirrored here. NULL until provisioned.
    schema_version  TEXT,

    -- Provisioning lifecycle (sec 4 / 10 / 16.5).
    status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PROVISIONING','LIVE','NEEDS_RECONNECT','DISABLED','ERROR')),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Phase 3 routing switch (UI plan sec 2.1): the operator's explicit per-tenant
    -- on/off, flipped in-app without a redeploy. DARK by default (FALSE) so every
    -- existing row stays off until explicitly enabled -- behaviour is unchanged
    -- until then. The engine routes a tenant to its own DB only when BYOD_ENABLED
    -- (env kill switch) AND status = 'LIVE' AND routing_enabled = TRUE (with a
    -- one-release env-canary OR fallback during rollout).
    routing_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    -- Phase 5 client->admin change signal (UI plan sec 4 / Phase 5). When a client
    -- self-serve requests an admin-run change, the latest request is parked here so
    -- it surfaces on the admin fleet list (the "flag on the fleet list" the plan
    -- calls for) without a separate notifications system. Latest-wins (a repeat
    -- request overwrites) so spam can't pile up -- the dedup half of the plan's
    -- "rate-limited + dedup". 'reconnect' = my DB credential/host changed, please
    -- re-provision; 'leave' = take me off BYOD. NULL = no open request. Validated
    -- in app code (byod_client.REQUEST_KINDS); no DB CHECK so the additive ALTER on
    -- existing installs stays drift-free with this CREATE.
    pending_change_kind TEXT,
    pending_change_note TEXT,
    pending_change_at   TIMESTAMPTZ,

    -- Last successful health probe (UI plan Phase 1 fleet list / Phase 5 status
    -- card "last health"). Set by check_health / provision on the healthy path;
    -- distinct from updated_at (which any mutation bumps). NULL until first probed.
    last_health_at      TIMESTAMPTZ
);

-- Operational lookups: list tenants by lifecycle state (e.g. all NEEDS_RECONNECT).
CREATE INDEX IF NOT EXISTS idx_byod_tenant_databases_status
    ON {TABLE_NAME} (status);
""".strip()

# Additive migration for existing (pre-runtime-DSN) installs: the CREATE TABLE
# above is IF NOT EXISTS, so it won't add columns to an already-created table.
# Migration 0015 runs these idempotent ALTERs; ASCII-only, kept here as the
# single source of truth (imported by the Alembic migration).
RUNTIME_DSN_ADD_COLUMNS_SQL = f"""
ALTER TABLE {TABLE_NAME} ADD COLUMN IF NOT EXISTS runtime_dsn_ciphertext BYTEA;
ALTER TABLE {TABLE_NAME} ADD COLUMN IF NOT EXISTS runtime_dsn_data_key   BYTEA;
ALTER TABLE {TABLE_NAME} ADD COLUMN IF NOT EXISTS runtime_dsn_nonce      BYTEA;
ALTER TABLE {TABLE_NAME} ADD COLUMN IF NOT EXISTS runtime_dsn_key_id     TEXT;
""".strip()

RUNTIME_DSN_DROP_COLUMNS_SQL = f"""
ALTER TABLE {TABLE_NAME} DROP COLUMN IF EXISTS runtime_dsn_key_id;
ALTER TABLE {TABLE_NAME} DROP COLUMN IF EXISTS runtime_dsn_nonce;
ALTER TABLE {TABLE_NAME} DROP COLUMN IF EXISTS runtime_dsn_data_key;
ALTER TABLE {TABLE_NAME} DROP COLUMN IF EXISTS runtime_dsn_ciphertext;
""".strip()

# Additive migration (0019) for the Phase 3 routing switch. Idempotent + dark by
# default (NOT NULL DEFAULT FALSE), so existing rows stay off and behaviour is
# unchanged until a row is explicitly enabled. Single source of truth (imported by
# the Alembic migration so app code + migration never drift).
ROUTING_ENABLED_ADD_COLUMN_SQL = (
    f"ALTER TABLE {TABLE_NAME} "
    "ADD COLUMN IF NOT EXISTS routing_enabled BOOLEAN NOT NULL DEFAULT FALSE;"
)

ROUTING_ENABLED_DROP_COLUMN_SQL = (
    f"ALTER TABLE {TABLE_NAME} DROP COLUMN IF EXISTS routing_enabled;"
)

# Additive migration (0020) for the Phase 5 client->admin change signal + last
# health probe (UI plan §4 / Phase 5). Idempotent (ADD COLUMN IF NOT EXISTS) and
# dark by default (all NULLABLE, default NULL) so existing rows are untouched and
# behaviour is unchanged until a client actually raises a request. Single source
# of truth (imported by the Alembic migration so app code + migration never drift).
PHASE5_SIGNALS_ADD_COLUMNS_SQL = f"""
ALTER TABLE {TABLE_NAME} ADD COLUMN IF NOT EXISTS pending_change_kind TEXT;
ALTER TABLE {TABLE_NAME} ADD COLUMN IF NOT EXISTS pending_change_note TEXT;
ALTER TABLE {TABLE_NAME} ADD COLUMN IF NOT EXISTS pending_change_at   TIMESTAMPTZ;
ALTER TABLE {TABLE_NAME} ADD COLUMN IF NOT EXISTS last_health_at      TIMESTAMPTZ;
""".strip()

PHASE5_SIGNALS_DROP_COLUMNS_SQL = f"""
ALTER TABLE {TABLE_NAME} DROP COLUMN IF EXISTS last_health_at;
ALTER TABLE {TABLE_NAME} DROP COLUMN IF EXISTS pending_change_at;
ALTER TABLE {TABLE_NAME} DROP COLUMN IF EXISTS pending_change_note;
ALTER TABLE {TABLE_NAME} DROP COLUMN IF EXISTS pending_change_kind;
""".strip()

# Mirror of the migration's downgrade, kept here so tests can reset cleanly.
CONTROL_PLANE_SCHEMA_DROP_SQL = (
    f"DROP INDEX IF EXISTS idx_byod_tenant_databases_status;\n"
    f"DROP TABLE IF EXISTS {TABLE_NAME};"
)


@dataclass(frozen=True)
class TenantDbRecord:
    """A control-plane BYOD routing/credential record (read result)."""

    company_id: str
    dsn_ciphertext: bytes
    dsn_data_key: Optional[bytes]
    dsn_nonce: Optional[bytes]
    dsn_key_id: str
    runtime_dsn_ciphertext: Optional[bytes]
    runtime_dsn_data_key: Optional[bytes]
    runtime_dsn_nonce: Optional[bytes]
    runtime_dsn_key_id: Optional[str]
    schema_version: Optional[str]
    status: str
    created_at: object  # datetime — kept loose to avoid a hard import here
    updated_at: object
    routing_enabled: bool = False  # Phase 3 routing switch; defaulted for back-compat
    # Phase 5 client->admin change signal + last health probe; defaulted for back-compat.
    pending_change_kind: Optional[str] = None
    pending_change_note: Optional[str] = None
    pending_change_at: object = None
    last_health_at: object = None


def _to_bytes(value: object) -> Optional[bytes]:
    """Normalize a psycopg2 bytea (memoryview) to bytes; pass through None."""
    if value is None:
        return None
    if isinstance(value, memoryview):
        return value.tobytes()
    return bytes(value)


def _row_to_record(row: tuple) -> TenantDbRecord:
    return TenantDbRecord(
        company_id=str(row[0]),
        dsn_ciphertext=_to_bytes(row[1]),  # type: ignore[arg-type]
        dsn_data_key=_to_bytes(row[2]),
        dsn_nonce=_to_bytes(row[3]),
        dsn_key_id=row[4],
        runtime_dsn_ciphertext=_to_bytes(row[5]),
        runtime_dsn_data_key=_to_bytes(row[6]),
        runtime_dsn_nonce=_to_bytes(row[7]),
        runtime_dsn_key_id=row[8],
        schema_version=row[9],
        status=row[10],
        created_at=row[11],
        updated_at=row[12],
        routing_enabled=bool(row[13]),
        pending_change_kind=row[14],
        pending_change_note=row[15],
        pending_change_at=row[16],
        last_health_at=row[17],
    )


def store_tenant_db_record(
    cur: "_Cursor",
    company_id: str,
    *,
    dsn_ciphertext: bytes,
    dsn_key_id: str,
    dsn_data_key: Optional[bytes] = None,
    dsn_nonce: Optional[bytes] = None,
    schema_version: Optional[str] = None,
    status: str = TenantDbStatus.PENDING,
) -> TenantDbRecord:
    """Upsert the encrypted-DSN / routing record for ``company_id``.

    Full upsert (initial onboarding OR a DSN rotation, §4.3): on conflict it
    replaces the credential material and resets status/schema_version to the
    given values, bumping ``updated_at``. Lifecycle-only transitions should use
    :func:`update_tenant_db_status` / :func:`update_tenant_db_schema_version`,
    which never touch the credential. Caller owns the transaction (no commit).
    """
    if status not in TENANT_DB_STATUSES:
        raise ValueError(f"invalid status {status!r}; expected one of {sorted(TENANT_DB_STATUSES)}")

    cur.execute(
        f"""
        INSERT INTO {TABLE_NAME}
            (company_id, dsn_ciphertext, dsn_data_key, dsn_nonce, dsn_key_id,
             schema_version, status, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (company_id) DO UPDATE SET
            dsn_ciphertext = EXCLUDED.dsn_ciphertext,
            dsn_data_key   = EXCLUDED.dsn_data_key,
            dsn_nonce      = EXCLUDED.dsn_nonce,
            dsn_key_id     = EXCLUDED.dsn_key_id,
            schema_version = EXCLUDED.schema_version,
            status         = EXCLUDED.status,
            updated_at     = NOW()
        RETURNING {_COLS_SQL}
        """,
        (
            company_id,
            psycopg2_bytea(dsn_ciphertext),
            psycopg2_bytea(dsn_data_key),
            psycopg2_bytea(dsn_nonce),
            dsn_key_id,
            schema_version,
            status,
        ),
    )
    return _row_to_record(cur.fetchone())


def get_tenant_db_record(cur: "_Cursor", company_id: str) -> Optional[TenantDbRecord]:
    """Resolve ``company_id`` → its routing/credential record, or None.

    This is the routing read (§6): the engine maps an authenticated bot to a
    company_id and looks up which database to open here.
    """
    cur.execute(
        f"SELECT {_COLS_SQL} FROM {TABLE_NAME} WHERE company_id = %s",
        (company_id,),
    )
    row = cur.fetchone()
    return _row_to_record(row) if row else None


def list_live_tenants(cur: "_Cursor") -> "list[tuple[str, Optional[str]]]":
    """Return ``(company_id, schema_version)`` for every LIVE tenant DB.

    The fleet the migration orchestrator (Phase 6.2 / §8.3 / A.8) rolls over: only
    LIVE tenants are provisioned + reachable enough to migrate. Other states
    (PENDING/PROVISIONING/ERROR/NEEDS_RECONNECT/DISABLED) are intentionally
    excluded — they have no usable migrate credential or are known-unreachable.
    Ordered by company_id for a deterministic, resumable rollout order.
    """
    cur.execute(
        f"SELECT company_id::text, schema_version FROM {TABLE_NAME} "
        f"WHERE status = %s ORDER BY company_id",
        (TenantDbStatus.LIVE,),
    )
    return [(row[0], row[1]) for row in cur.fetchall()]


@dataclass(frozen=True)
class TenantSummary:
    """A fleet-list row for the admin BYOD panel (Phase 1, UI plan §2.2).

    Unlike :class:`TenantDbRecord` this carries **no** credential material — it is
    the safe, joinable projection an operator sees in the tenant table: who owns
    it (``clerk_id`` / ``company_name``), its lifecycle ``status``, whether it has
    been provisioned (a runtime DSN exists), its ``schema_version`` and timestamps.
    The DSN ciphertext is deliberately absent (never needed to render the list).
    """

    company_id: str
    clerk_id: Optional[str]
    company_name: Optional[str]
    status: str
    schema_version: Optional[str]
    provisioned: bool
    routing_enabled: bool
    created_at: object
    updated_at: object
    # Phase 5: the client's open change request (the "flag on the fleet list") +
    # last successful health probe, both defaulted for back-compat.
    pending_change_kind: Optional[str] = None
    pending_change_at: object = None
    last_health_at: object = None


def list_all_tenants(cur: "_Cursor") -> "list[TenantSummary]":
    """Return a :class:`TenantSummary` for **every** BYOD tenant, any state.

    The admin fleet view (UI plan Phase 1) needs all lifecycle states, unlike
    :func:`list_live_tenants` (LIVE-only, for the migration orchestrator). Joins
    ``companies`` for the display name and ``users`` for the owning ``clerk_id``
    (LEFT JOIN — a company without a user row still lists, with a null owner).
    Ordered newest-first so freshly onboarded tenants surface at the top. Carries
    no DSN/credential bytes — only the safe projection the table renders.
    """
    cur.execute(
        f"""
        SELECT t.company_id::text,
               u.clerk_id,
               c.company_name,
               t.status,
               t.schema_version,
               (t.runtime_dsn_ciphertext IS NOT NULL) AS provisioned,
               t.routing_enabled,
               t.created_at,
               t.updated_at,
               t.pending_change_kind,
               t.pending_change_at,
               t.last_health_at
          FROM {TABLE_NAME} t
          JOIN companies c ON c.id = t.company_id
          LEFT JOIN users u ON u.id = c.user_id
         ORDER BY t.created_at DESC
        """
    )
    return [
        TenantSummary(
            company_id=row[0],
            clerk_id=row[1],
            company_name=row[2],
            status=row[3],
            schema_version=row[4],
            provisioned=bool(row[5]),
            routing_enabled=bool(row[6]),
            created_at=row[7],
            updated_at=row[8],
            pending_change_kind=row[9],
            pending_change_at=row[10],
            last_health_at=row[11],
        )
        for row in cur.fetchall()
    ]


def update_tenant_db_status(cur: "_Cursor", company_id: str, status: str) -> bool:
    """Transition the lifecycle status; returns True if a row was updated."""
    if status not in TENANT_DB_STATUSES:
        raise ValueError(f"invalid status {status!r}; expected one of {sorted(TENANT_DB_STATUSES)}")
    cur.execute(
        f"UPDATE {TABLE_NAME} SET status = %s, updated_at = NOW() WHERE company_id = %s",
        (status, company_id),
    )
    return cur.rowcount > 0


def set_routing_enabled(cur: "_Cursor", company_id: str, enabled: bool) -> bool:
    """Flip the Phase 3 routing switch (UI plan §2.1); True if a row was updated.

    This is the *intent* flag the operator toggles in-app — it does NOT by itself
    open a connection. The engine still requires ``BYOD_ENABLED`` (env kill) AND
    ``status == LIVE`` before this matters (see byod_engine.routing_active). Callers
    must invalidate the routing-decision cache after committing so the change takes
    effect immediately rather than after the TTL."""
    cur.execute(
        f"UPDATE {TABLE_NAME} SET routing_enabled = %s, updated_at = NOW() WHERE company_id = %s",
        (bool(enabled), company_id),
    )
    return cur.rowcount > 0


def get_routing_fields(cur: "_Cursor", company_id: str) -> "Optional[tuple[str, bool]]":
    """Lightweight routing read for the hot path: ``(status, routing_enabled)`` for
    ``company_id``, or ``None`` if there is no row.

    Deliberately selects only the two routing columns (no DSN ciphertext) because
    byod_engine.routing_active runs this per chat request behind a short-TTL cache —
    keeping the row small minimises the cost of a cache-miss read."""
    cur.execute(
        f"SELECT status, routing_enabled FROM {TABLE_NAME} WHERE company_id = %s",
        (company_id,),
    )
    row = cur.fetchone()
    return (row[0], bool(row[1])) if row else None


def set_pending_change_request(
    cur: "_Cursor", company_id: str, kind: str, note: Optional[str] = None
) -> bool:
    """Park a client's open change request on the tenant row (UI plan Phase 5); True
    if a row was updated.

    This is the "flag on the fleet list": ``kind`` ∈ {reconnect, leave} (validated by
    the caller, :data:`byod_client.REQUEST_KINDS`) plus an optional ``note`` and the
    request time. **Latest-wins** — a repeat request overwrites the prior one rather
    than stacking, which is the dedup half of the plan's "rate-limited + dedup" (the
    rate limit lives on the endpoint). Performs no lifecycle mutation; the request is
    only a signal an operator acts on. Caller owns the transaction."""
    cur.execute(
        f"""UPDATE {TABLE_NAME}
               SET pending_change_kind = %s,
                   pending_change_note = %s,
                   pending_change_at   = NOW(),
                   updated_at          = NOW()
             WHERE company_id = %s""",
        (kind, note, company_id),
    )
    return cur.rowcount > 0


def clear_pending_change_request(cur: "_Cursor", company_id: str) -> bool:
    """Clear any open change request on the tenant row (UI plan Phase 5); True if a
    row was updated.

    Called when the request is resolved: an admin dismisses it, the tenant is
    (re-)provisioned to LIVE, or the client themselves re-submits a DSN (acting on
    their own reconnect). Idempotent — clearing an already-clear row is a harmless
    no-op. Caller owns the transaction."""
    cur.execute(
        f"""UPDATE {TABLE_NAME}
               SET pending_change_kind = NULL,
                   pending_change_note = NULL,
                   pending_change_at   = NULL,
                   updated_at          = NOW()
             WHERE company_id = %s""",
        (company_id,),
    )
    return cur.rowcount > 0


def set_last_health_at(cur: "_Cursor", company_id: str) -> bool:
    """Stamp the last successful health probe (UI plan Phase 1 fleet / Phase 5 status
    card); True if a row was updated. Set on the healthy path of ``check_health`` and
    ``provision``. Caller owns the transaction."""
    cur.execute(
        f"UPDATE {TABLE_NAME} SET last_health_at = NOW() WHERE company_id = %s",
        (company_id,),
    )
    return cur.rowcount > 0


def set_runtime_dsn(
    cur: "_Cursor",
    company_id: str,
    *,
    runtime_dsn_ciphertext: bytes,
    runtime_dsn_key_id: str,
    runtime_dsn_data_key: Optional[bytes] = None,
    runtime_dsn_nonce: Optional[bytes] = None,
) -> bool:
    """Store the envelope-encrypted runtime (vaayu_runtime) DSN for ``company_id``
    (RFC §5.4 / Phase 2.3). Updates only the runtime credential columns, leaving
    the migrate DSN / status / schema_version untouched. Returns True if a row was
    updated. Caller owns the transaction."""
    cur.execute(
        f"""
        UPDATE {TABLE_NAME} SET
            runtime_dsn_ciphertext = %s,
            runtime_dsn_data_key   = %s,
            runtime_dsn_nonce      = %s,
            runtime_dsn_key_id     = %s,
            updated_at             = NOW()
        WHERE company_id = %s
        """,
        (
            psycopg2_bytea(runtime_dsn_ciphertext),
            psycopg2_bytea(runtime_dsn_data_key),
            psycopg2_bytea(runtime_dsn_nonce),
            runtime_dsn_key_id,
            company_id,
        ),
    )
    return cur.rowcount > 0


def update_tenant_db_schema_version(cur: "_Cursor", company_id: str, schema_version: str) -> bool:
    """Record the tenant DB's data-plane schema version (§8.1); True if updated."""
    cur.execute(
        f"UPDATE {TABLE_NAME} SET schema_version = %s, updated_at = NOW() WHERE company_id = %s",
        (schema_version, company_id),
    )
    return cur.rowcount > 0


def delete_tenant_db_record(cur: "_Cursor", company_id: str) -> bool:
    """Remove routing + credentials for ``company_id`` (offboard, §4.6 / §16.6).

    Deletes ONLY this control-plane row — the client's database and its data are
    never touched. Returns True if a row was removed.
    """
    cur.execute(f"DELETE FROM {TABLE_NAME} WHERE company_id = %s", (company_id,))
    return cur.rowcount > 0


def psycopg2_bytea(value: Optional[bytes]):
    """Wrap bytes as a psycopg2 Binary adapter; pass through None.

    Imported lazily so this module stays import-light for the migration context.
    """
    if value is None:
        return None
    import psycopg2  # local import — see module docstring

    return psycopg2.Binary(value)
