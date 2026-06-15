"""BYOD connection-string validation: SSRF + DNS re-check + DSN allowlist + TLS.

RFC docs/rfc-byod.md Phase 1.4 (§5.2 SSRF/DNS-rebinding, §5.3 transport, rule E4
DSN parameter allowlist, §16.2 "the tenant DB is hostile until proven otherwise").

``validate_db_url()`` is the BYOD analogue of ``validate_safe_url()`` in main.py:
same resolve-host-then-block-private SSRF approach, extended for Postgres DSNs.
It is the single chokepoint every tenant connection string passes through, both
at **onboarding** and on **every connect** (rule 8 — re-validate the resolved IP
each time to defeat DNS-rebinding / TOCTOU). Because the client controls the DSN,
it is untrusted input (§16.2): we accept only a strict canonical shape and reject
everything else, fail-closed (rule 10).

What it enforces:
  * **Scheme / shape** — only a ``postgres(ql)://`` URI. Keyword/value DSNs
    (``host=... options=...``) are rejected outright, since that form is the easy
    way to smuggle dangerous libpq params past a naive parser (E4).
  * **Parameter allowlist (E4)** — the only query parameter permitted is
    ``sslmode``. Everything else is rejected: ``options=-c...`` (arbitrary
    server-side GUCs / code), ``sslrootcert=`` / ``sslcert=`` / ``sslkey=``
    (local file references), ``host=`` / ``hostaddr=`` / ``service=`` /
    ``passfile=`` (connection redirection past the SSRF check), etc.
  * **TLS (§5.3, rule 9)** — ``sslmode`` must be present and at least ``require``
    (``verify-ca`` / ``verify-full`` preferred). ``disable`` / ``allow`` /
    ``prefer`` (which permit a plaintext fallback) and an absent sslmode are
    rejected.
  * **SSRF (§5.2, rule 8)** — the host is checked against the shared
    ``BLOCKED_LOGO_URL_PATTERNS`` blocklist (loopback, RFC-1918, link-local,
    ``0.0.0.0``, ``::1``, ``.internal``, cloud metadata endpoints), then the
    hostname is DNS-resolved and **every** resolved IP is re-validated against
    private/loopback/link-local/reserved ranges — catching a public name that
    resolves to a private address (DNS-rebinding).

This module is import-light (stdlib + ``config`` constants only; no DB, no
FastAPI) and the DNS resolver is injectable, so the whole gate is unit-testable
without a network. Callers (Phase 2 onboarding / Phase 1.5 connect path) translate
:class:`DsnValidationError` into the appropriate HTTP error or fail-closed action.
"""
from __future__ import annotations

import ipaddress
import re
import socket
from dataclasses import dataclass, field
from typing import Callable, List, Sequence
from urllib.parse import parse_qsl, urlparse

from config import BLOCKED_LOGO_URL_PATTERNS

# Accepted URI schemes for a Postgres connection string.
_ALLOWED_SCHEMES = frozenset({"postgres", "postgresql"})

# E4: the ONLY query parameter a tenant may set. host/port/dbname/user/password
# are structural parts of the URI (authority + path), not query params; sslmode is
# the one tunable we permit (TLS policy). Everything else is rejected.
_ALLOWED_QUERY_PARAMS = frozenset({"sslmode"})

# §5.3 / rule 9: sslmode values that actually guarantee TLS (no plaintext fallback).
# "require" is the documented minimum; verify-ca / verify-full are stronger.
_TLS_SSLMODES = frozenset({"require", "verify-ca", "verify-full"})

_DEFAULT_PG_PORT = 5432


class DsnValidationError(ValueError):
    """A tenant DSN failed validation (fail-closed). Message is safe to surface;
    it never contains the password or any decrypted credential (rule 7)."""


@dataclass(frozen=True)
class ValidatedDsn:
    """The safe, parsed view of an accepted DSN.

    Deliberately carries **no password** — it must never be logged or persisted
    (rule 7). ``resolved_ips`` lets a connect path pin to an already-validated
    address to close the resolve-then-connect TOCTOU window.
    """
    host: str
    port: int
    dbname: str
    user: str
    sslmode: str
    resolved_ips: tuple[str, ...] = field(default=())


# ── DNS resolution seam (injectable for deterministic tests) ──────────────────
def _default_resolver(host: str) -> List[str]:
    """Resolve a host to all of its A/AAAA addresses (IP literals pass through)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:  # unresolvable → fail closed
        raise DsnValidationError("Database host could not be resolved.") from exc
    # De-dupe while preserving a stable order.
    seen: dict[str, None] = {}
    for info in infos:
        seen.setdefault(info[4][0], None)
    if not seen:
        raise DsnValidationError("Database host could not be resolved.")
    return list(seen)


Resolver = Callable[[str], Sequence[str]]


def _is_blocked_ip(ip: ipaddress._BaseAddress) -> bool:
    """True if an IP is anything other than a normal, routable public address."""
    # IPv4-mapped / -compatible IPv6 (e.g. ::ffff:10.0.0.1) hide a v4 address.
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        return _is_blocked_ip(mapped)
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def validate_db_url(dsn: str, *, resolver: Resolver = _default_resolver) -> ValidatedDsn:
    """Validate a BYOD tenant Postgres DSN; raise :class:`DsnValidationError` on
    any problem (fail-closed), else return its safe :class:`ValidatedDsn` view.

    Designed to be cheap and side-effect-free apart from the DNS lookup, so it can
    be called on **every** connect (rule 8) as well as at onboarding.
    """
    if not isinstance(dsn, str) or not dsn.strip():
        raise DsnValidationError("A database connection string is required.")
    dsn = dsn.strip()

    # 1. Shape: only a postgres(ql):// URI. Reject keyword/value DSNs outright —
    #    that form ("host=... options=...") is how dangerous libpq params slip in.
    parsed = urlparse(dsn)
    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise DsnValidationError(
            "Connection string must be a postgresql:// URL."
        )

    # urlparse accepts a bad port lazily; touching .port surfaces it as ValueError.
    try:
        port = parsed.port or _DEFAULT_PG_PORT
    except ValueError as exc:
        raise DsnValidationError("Database port is invalid.") from exc

    host = parsed.hostname
    if not host:
        raise DsnValidationError("Database host is missing.")

    # 2. Credentials must be present (public-internet, password auth over TLS).
    if not parsed.username:
        raise DsnValidationError("Connection string must include a username.")
    if not parsed.password:
        raise DsnValidationError("Connection string must include a password.")

    # 3. Exactly one database name (no path traversal / extra segments).
    dbname = parsed.path.lstrip("/")
    if not dbname or "/" in dbname:
        raise DsnValidationError("Connection string must name exactly one database.")

    # 4. Parameter allowlist (E4): only sslmode is permitted; reject the rest
    #    (options=, sslrootcert=, sslcert=, sslkey=, host=, hostaddr=, service=,
    #     passfile=, target_session_attrs=, gssencmode=, ...).
    params = parse_qsl(parsed.query, keep_blank_values=True)
    sslmode: str | None = None
    for key, value in params:
        lkey = key.lower()
        if lkey not in _ALLOWED_QUERY_PARAMS:
            raise DsnValidationError(
                f"Connection parameter '{key}' is not allowed. "
                "Only 'sslmode' may be set."
            )
        if lkey == "sslmode":
            if sslmode is not None:
                raise DsnValidationError("Connection string sets 'sslmode' more than once.")
            sslmode = value.lower()

    # 5. TLS (§5.3, rule 9): sslmode required, must guarantee encryption.
    if sslmode is None:
        raise DsnValidationError(
            "Connection string must set sslmode=require (or verify-ca / verify-full)."
        )
    if sslmode not in _TLS_SSLMODES:
        raise DsnValidationError(
            f"sslmode='{sslmode}' permits an unencrypted connection. "
            "Use sslmode=require, verify-ca, or verify-full."
        )

    # 6. SSRF — host blocklist (§5.2). Reuse the shared logo/URL blocklist (covers
    #    loopback, RFC-1918, link-local, 0.0.0.0, ::1, .internal, metadata hosts).
    for pattern in BLOCKED_LOGO_URL_PATTERNS:
        if re.search(pattern, host):
            raise DsnValidationError(
                "Database host points to a private, loopback, or internal address."
            )

    # 7. SSRF — resolve and re-check EVERY resolved IP (rule 8, DNS-rebinding):
    #    a public-looking name that resolves to a private address is rejected.
    resolved = resolver(host)
    if not resolved:
        raise DsnValidationError("Database host could not be resolved.")
    for ip_str in resolved:
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError as exc:
            raise DsnValidationError("Database host resolved to an invalid address.") from exc
        if _is_blocked_ip(ip):
            raise DsnValidationError(
                "Database host resolves to a private, loopback, or internal address."
            )

    return ValidatedDsn(
        host=host,
        port=port,
        dbname=dbname,
        user=parsed.username,
        sslmode=sslmode,
        resolved_ips=tuple(resolved),
    )
