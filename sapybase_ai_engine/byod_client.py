"""BYOD client self-serve logic (UI plan Phase 4): the small, own-company-only
surface a BYOD-entitled customer drives themselves — view status, test a candidate
DSN, submit a DSN while onboarding, and request an admin-run change. Mirrors
``byod_admin.py``'s cursor-taking style (the caller owns the transaction / commit);
the thin ``/api/byod/me*`` endpoints in main.py add the session-scoped authz that
makes this safe: the company is resolved **only** from the caller's own session —
there is **no** ``clerk_id`` / ``company_id`` path param, so there is no IDOR — and
the routes are gated on the ``byo_database`` entitlement.

**D1/D3 reconciliation (plan §0 — the security-relevant rule):** a client may store
a DSN **only while onboarding** — when there is no tenant row yet, or the row is
``PENDING`` / ``NEEDS_RECONNECT``. Once the tenant is ``LIVE`` the connection is
**frozen to the client**: a change becomes a *re-onboarding* the admin drives, never
a silent self-update of a live connection. All privileged mutations (provision,
enable/disable routing, switch-in/out, offboard) stay **admin-only** (byod_admin).

This module never decrypts, logs, or returns a plaintext DSN. Storage reuses the
exact same validate → envelope-encrypt → store path as the admin connection
endpoint (``byod_admin.set_connection``) — there is no parallel, weaker code path
for secrets.
"""
from __future__ import annotations

from typing import Optional

import byod_admin
import byod_store
from byod_admin import MASKED_URL, CompanyNotFound
from byod_store import TenantDbStatus

# Statuses in which the client is allowed to enter / replace their DSN — i.e. while
# the tenant is still onboarding (or re-onboarding after a password rotation). A row
# that does not exist yet is treated as the very first onboarding step (allowed).
# Any other state (LIVE / PROVISIONING / DISABLED / ERROR) freezes the connection
# to the client; changing it is an admin-driven re-onboarding (plan §0).
CLIENT_EDITABLE_STATUSES = frozenset({TenantDbStatus.PENDING, TenantDbStatus.NEEDS_RECONNECT})

# The self-serve change requests a client may raise (no mutation — these only signal
# the operator). "reconnect" = my DB password/host changed, please re-provision;
# "leave" = please take me off BYOD (admin runs switch-out / offboard).
REQUEST_KINDS = frozenset({"reconnect", "leave"})

# Single source of truth for the onboarding requirements the client UI renders, so
# the dashboard copy can never drift from what the engine actually enforces
# (docs/byod-client-onboarding.md / byod_dsn.py / byod_probe.py).
EGRESS_IP_RANGES = ("74.220.48.0/24", "74.220.56.0/24")
CLIENT_REQUIREMENTS = {
    "egress_ip_ranges": list(EGRESS_IP_RANGES),
    "tls_required": True,
    "min_pgvector_version": "0.5.0",
    "embedding_dimensions": 768,
    "dsn_format": "postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require",
    "checklist": [
        "Allowlist Sapybase's egress IP ranges on your database firewall.",
        "Database host is publicly reachable over TLS (sslmode=require).",
        "pgvector >= 0.5.0 available; a vector(768) column is creatable.",
        "A fresh database with no conflicting schema.",
        "The provisioning role can CREATE EXTENSION, tables, and a role.",
    ],
}


class ByodClientError(Exception):
    """Base class for BYOD client self-serve failures."""


class ConnectionFrozen(ByodClientError):
    """The tenant is past onboarding (e.g. LIVE) so the client may not change the
    DSN here — a change is an admin-driven re-onboarding (plan §0). Carries the
    current status for the caller to surface."""

    def __init__(self, status: str):
        super().__init__(status)
        self.status = status


class InvalidRequestKind(ByodClientError):
    """An unrecognised request-change ``kind`` (not in :data:`REQUEST_KINDS`)."""


class NoConnectionToChange(ByodClientError):
    """A change was requested but the caller has no tenant database to change yet
    (status "not started" — no row). There is nothing to reconnect or leave, so the
    endpoint surfaces a 409 rather than parking a request on a non-existent row."""


# Re-export so endpoints can reference one cohesive client surface.
test_dsn = byod_admin.test_dsn


def get_client_view(cur, clerk_id: str) -> dict:
    """The client's own BYOD surface: lifecycle status, masked connection, whether
    they may (re)enter a DSN right now, and the onboarding requirements. Scoped to
    the caller's own company (resolved from their session by the endpoint). Never
    decrypts or returns the real DSN. A user with the entitlement but no company
    or no tenant row yet gets ``status = None`` ("not started") with editing
    allowed so they can begin onboarding."""
    company_id = byod_admin.resolve_company_id(cur, clerk_id)
    record = (
        byod_store.get_tenant_db_record(cur, company_id) if company_id is not None else None
    )

    connection = None
    if record is not None:
        connection = {
            "masked_url": MASKED_URL,  # §5.1 — never the real DSN
            "status": record.status,
            "is_live": record.status == TenantDbStatus.LIVE,
            "provisioned": record.runtime_dsn_ciphertext is not None,
            "schema_version": record.schema_version,
            "created_at": _iso(record.created_at),
            "updated_at": _iso(record.updated_at),
            "last_health_at": _iso(record.last_health_at),  # Phase 5: "last health"
        }

    can_edit = record is None or record.status in CLIENT_EDITABLE_STATUSES
    return {
        "company_id": company_id,
        "status": record.status if record is not None else None,  # None = not started
        "can_edit_connection": can_edit,
        "connection": connection,
        # Phase 5: the caller's own open change request, so the page can persistently
        # show "request received — pending review" across reloads (not just locally).
        "pending_change": byod_admin._pending_change(record),
        "requirements": CLIENT_REQUIREMENTS,
    }


def set_own_connection(
    cur,
    clerk_id: str,
    dsn: str,
    kms,
    *,
    resolver=None,
) -> dict:
    """Store the client's own tenant DSN — **only while onboarding** (no row yet, or
    status ∈ {PENDING, NEEDS_RECONNECT}); otherwise raise :class:`ConnectionFrozen`
    (the live connection is frozen to the client, plan §0). Reuses the admin
    validate → encrypt → store path verbatim (no parallel, weaker secret path). The
    record is left ``PENDING`` for super-admin review. Caller commits. Raises
    :class:`byod_admin.CompanyNotFound`, :class:`ConnectionFrozen`,
    ``DsnValidationError`` (→ 400), or ``KmsUnavailable`` (→ 503)."""
    company_id = byod_admin.resolve_company_id(cur, clerk_id)
    if company_id is None:
        raise CompanyNotFound(clerk_id)

    record = byod_store.get_tenant_db_record(cur, company_id)
    if record is not None and record.status not in CLIENT_EDITABLE_STATUSES:
        raise ConnectionFrozen(record.status)

    # Reuse the exact admin path (validate + envelope-encrypt + store as PENDING).
    result = byod_admin.set_connection(cur, clerk_id, dsn, kms, resolver=resolver)
    # The client just re-entered their DSN — that resolves any open reconnect request
    # they had raised, so clear the fleet-list flag (Phase 5).
    byod_store.clear_pending_change_request(cur, company_id)
    return result


def request_change(cur, clerk_id: str, kind: str, note: Optional[str] = None) -> dict:
    """Record a client's self-serve change request (``reconnect`` / ``leave``) as an
    admin-visible signal (UI plan Phase 5). Parks the *latest* request on the tenant
    row so it surfaces on the admin fleet list — latest-wins, so repeated requests
    dedup rather than pile up (with the endpoint rate limit, this is the plan's
    "rate-limited + dedup"). Performs **no** lifecycle mutation: "leave" never
    deletes data; the admin runs switch-out / offboard. Caller commits. Raises
    :class:`InvalidRequestKind`, :class:`byod_admin.CompanyNotFound`, or
    :class:`NoConnectionToChange` (no tenant row yet — nothing to change)."""
    if kind not in REQUEST_KINDS:
        raise InvalidRequestKind(kind)
    company_id = byod_admin.resolve_company_id(cur, clerk_id)
    if company_id is None:
        raise CompanyNotFound(clerk_id)
    if not byod_store.set_pending_change_request(cur, company_id, kind, note):
        # No tenant row → "not started"; there is no connection to reconnect or leave.
        raise NoConnectionToChange(company_id)
    return {"company_id": company_id, "kind": kind, "acknowledged": True}


def _iso(value: object) -> Optional[str]:
    return value.isoformat() if hasattr(value, "isoformat") else None
