"""BYOD engine schema version-gate (RFC docs/rfc-byod.md Phase 6.1; §8.1/§8.2,
rules 11/12; §16.9 row "Schema ahead/behind engine").

Data-plane migrations are **additive** (expand -> migrate -> contract, §8.2): a
release adds tables/columns (nullable/defaulted), backfills in the background, and
only removes the old shape in a *later* release once no code reads it. During a
fleet rollout (Phase 6.2) the tenant DBs therefore sit at MANY different schema
versions at once. The engine copes by declaring the versions it supports and
**gating every read of a new column/table behind a ``tenant_schema_version >= vN``
check** (rule 12) so version skew never throws (§16.9: "schema ahead/behind ->
version-gate features, never throw").

This module is the **pure comparison core** — no DB, no I/O — so it is trivially
unit-testable. :func:`byod_engine.tenant_schema_version` /
:func:`byod_engine.tenant_supports_version` layer the control-plane registry read
(§8.1) on top of it.

The engine declares two bounds (§8.1: "the engine declares a min and target"):

  * :data:`ENGINE_TARGET_SCHEMA_VERSION` — the newest data-plane shape the engine
    knows how to read in full. A read of a column introduced at version ``vN`` is
    gated ``>= vN`` (with ``vN <= target``). Sourced from
    ``byod_dataplane.DATA_PLANE_SCHEMA_VERSION`` so the engine's target and the
    schema it actually ships can never drift.
  * :data:`ENGINE_MIN_SCHEMA_VERSION` — the OLDEST tenant schema the engine still
    supports at all. A tenant below this is too old to serve safely (only possible
    after a future *contract* removed a shape the engine still required) and is
    failed **soft**, never crashed. Today ``min == target ==`` the baseline, so no
    provisioned tenant is below min.

Version strings follow the data-plane Alembic lineage's zero-padded numeric
convention (``"0001"``, ``"0002"``, ...); :func:`parse_version` is defensive and
treats anything it cannot parse (incl. ``None``) as *unknown* — which the gates
read as "below any requirement", i.e. fall back to the OLD shape, never throw.
"""
from __future__ import annotations

from typing import Optional

from byod_dataplane import DATA_PLANE_SCHEMA_VERSION

# The newest data-plane schema the engine knows how to read. Reads of columns
# introduced at vN are gated `>= vN` for vN <= this. Pinned to the shipped schema
# constant so engine-target and on-disk-schema can never drift.
ENGINE_TARGET_SCHEMA_VERSION: str = DATA_PLANE_SCHEMA_VERSION

# The oldest tenant schema the engine still supports reading at all. Below this a
# tenant is failed soft (degraded), never crashed. min == target until a future
# contract phase raises the floor.
ENGINE_MIN_SCHEMA_VERSION: str = DATA_PLANE_SCHEMA_VERSION


def parse_version(version: Optional[str]) -> Optional[int]:
    """Parse a data-plane schema version string to its integer ordinal.

    Returns ``None`` for ``None`` or anything that is not a plain integer string
    (a corrupt/missing registry value). Callers treat ``None`` as *unknown* =
    below every requirement, so an unparseable version can never satisfy a gate
    and can never raise."""
    if version is None:
        return None
    try:
        return int(str(version).strip())
    except (TypeError, ValueError):
        return None


def version_meets(tenant_version: Optional[str], required: Optional[str]) -> bool:
    """Whether the tenant DB is known to be at schema version ``>= required``.

    This is the rule-12 gate: gate a read of a column/table introduced at
    ``required`` on this returning True. Fail-closed to the OLD shape — if either
    side is unknown/unparseable (incl. an unrecorded ``None`` tenant version), it
    returns ``False`` so the engine reads the old shape rather than risk querying
    a column that may not exist. Never raises (§16.9: never throw on skew).

    A tenant *ahead* of ``required`` (engine behind the tenant) also returns True:
    the engine reads the columns it knows about and ignores any extra ones the
    tenant has."""
    t = parse_version(tenant_version)
    r = parse_version(required)
    if t is None or r is None:
        return False
    return t >= r


def engine_supports_tenant(tenant_version: Optional[str]) -> bool:
    """Whether the engine still supports reading a tenant at ``tenant_version`` at
    all, i.e. it is ``>= ENGINE_MIN_SCHEMA_VERSION``.

    A tenant below the floor (possible only after a future contract) cannot be
    served safely and should be failed soft + alerted by the caller — distinct
    from a tenant merely *behind target*, which is served on the old shape."""
    return version_meets(tenant_version, ENGINE_MIN_SCHEMA_VERSION)
