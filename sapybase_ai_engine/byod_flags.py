"""BYOD dark feature flag + canary-tenant wiring (RFC Phase 0.2).

This is the operational *rollout* switch for Build-Your-Own-Database. It is DARK
by default: with no env configuration, ``byo_database_active()`` returns False
for every tenant, so existing shared-DB behavior is byte-for-byte unchanged
(RFC §13 delivery principle: "Dark by default. With the flag off, existing
shared-DB behavior is byte-for-byte unchanged.").

Two independent gates, BOTH required to be True for a tenant:

  1. Global kill switch — env ``BYOD_ENABLED`` (default off). One flip disables
     BYOD fleet-wide during an incident.
  2. Canary allowlist  — env ``BYOD_CANARY_COMPANY_IDS`` (comma-separated
     company ids). Only listed tenants are eligible during rollout. Empty/unset
     means nobody is a canary.

Env is read at call time (not import) so the switch can be flipped without a code
change, and tests can monkeypatch it.

SCOPE NOTE: this is the rollout gate ONLY. Whether a tenant's *plan* is entitled
to BYOD (``PLAN_LIMITS["BYOD"]`` / ``custom_plan_config.byo_database`` via
``has_entitlement``) is a SEPARATE check introduced in Phase 1.1. The engine
cutover (Phase 3) routes a tenant to its own database only when BOTH the
plan entitlement AND this rollout gate pass. Until then nothing in the engine
consumes this module — it ships dark on purpose.
"""
from __future__ import annotations

import os

# Canonical feature-flag key, mirrored into config.py / entitlements.ts in
# Phase 1.1. Defined here so all BYOD code refers to one constant.
BYO_DATABASE_FEATURE_KEY = "byo_database"

_TRUTHY = {"1", "true", "yes", "on"}


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in _TRUTHY


def byo_database_globally_enabled() -> bool:
    """Global kill switch — off unless ``BYOD_ENABLED`` is truthy."""
    return _env_bool("BYOD_ENABLED", False)


def canary_company_ids() -> frozenset[str]:
    """Parsed ``BYOD_CANARY_COMPANY_IDS`` allowlist (empty when unset)."""
    raw = os.getenv("BYOD_CANARY_COMPANY_IDS", "")
    return frozenset(part.strip() for part in raw.split(",") if part.strip())


def is_canary_tenant(company_id: object) -> bool:
    """True if ``company_id`` is in the canary allowlist."""
    if not company_id:
        return False
    return str(company_id) in canary_company_ids()


def byo_database_active(company_id: object) -> bool:
    """Whether the BYOD rollout is active for this tenant. DARK by default.

    Returns True only when the global switch is on AND the tenant is a canary.
    Any falsy/None ``company_id`` is False.
    """
    if not company_id:
        return False
    return byo_database_globally_enabled() and is_canary_tenant(company_id)
