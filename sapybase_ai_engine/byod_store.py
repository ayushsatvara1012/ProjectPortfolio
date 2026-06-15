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
    "schema_version",
    "status",
    "created_at",
    "updated_at",
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

    -- Schema-version registry (sec 8.1): the tenant DB's current data-plane
    -- alembic version, mirrored here. NULL until provisioned.
    schema_version  TEXT,

    -- Provisioning lifecycle (sec 4 / 10 / 16.5).
    status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PROVISIONING','LIVE','NEEDS_RECONNECT','DISABLED','ERROR')),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operational lookups: list tenants by lifecycle state (e.g. all NEEDS_RECONNECT).
CREATE INDEX IF NOT EXISTS idx_byod_tenant_databases_status
    ON {TABLE_NAME} (status);
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
    schema_version: Optional[str]
    status: str
    created_at: object  # datetime — kept loose to avoid a hard import here
    updated_at: object


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
        schema_version=row[5],
        status=row[6],
        created_at=row[7],
        updated_at=row[8],
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


def update_tenant_db_status(cur: "_Cursor", company_id: str, status: str) -> bool:
    """Transition the lifecycle status; returns True if a row was updated."""
    if status not in TENANT_DB_STATUSES:
        raise ValueError(f"invalid status {status!r}; expected one of {sorted(TENANT_DB_STATUSES)}")
    cur.execute(
        f"UPDATE {TABLE_NAME} SET status = %s, updated_at = NOW() WHERE company_id = %s",
        (status, company_id),
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
