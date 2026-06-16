"""Phase 6.1 test gate: engine schema version-gate (byod_schema + byod_engine).

Exit criteria (RFC docs/rfc-byod.md §13 Phase 6.1):
    "Engine version-gate: read new columns only when schema_version >= target
     (expand->migrate->contract). Engine tolerates a tenant N versions behind;
     no throw." (§8.2, rules 11/12; §16.9 "schema ahead/behind -> never throw")

All pure (no Postgres): the comparison core is I/O-free, and the control-plane
registry read is exercised with a fake conn + a monkeypatched store lookup, so the
whole gate runs in the no-DB engine-regression suite. Does NOT import main.py.

Two layers:
  * byod_schema — parse/compare versions; the rule-12 gate `version_meets`;
    fail-closed-to-old-shape on unknown/None/garbage; engine min/target pinned to
    the shipped schema constant (no drift).
  * byod_engine — tenant_schema_version reads the control-plane registry (fail-soft
    -> None) and tenant_supports_version composes it into THE GATE: a tenant N
    versions behind a future target -> False (read old shape), never raises.
"""
from __future__ import annotations

import pytest

import byod_dataplane
import byod_engine
import byod_schema


# ── Pure: version parsing ────────────────────────────────────────────────────────
def test_parse_version_numeric_padded():
    assert byod_schema.parse_version("0001") == 1
    assert byod_schema.parse_version("0005") == 5
    assert byod_schema.parse_version("0042") == 42
    assert byod_schema.parse_version("  0003  ") == 3  # tolerates surrounding space


def test_parse_version_unknown_is_none():
    assert byod_schema.parse_version(None) is None
    assert byod_schema.parse_version("") is None
    assert byod_schema.parse_version("v2") is None
    assert byod_schema.parse_version("abc") is None
    assert byod_schema.parse_version("01.2") is None


# ── Pure: the rule-12 gate (version_meets) ───────────────────────────────────────
def test_version_meets_equal_and_ahead():
    assert byod_schema.version_meets("0001", "0001") is True
    assert byod_schema.version_meets("0002", "0001") is True
    # tenant AHEAD of the engine's requirement still satisfies the gate (§16.9
    # "schema ahead" -> read known columns, ignore extras, never throw).
    assert byod_schema.version_meets("0009", "0005") is True


def test_version_meets_behind_is_false_not_raise():
    # THE GATE: a tenant N versions behind a (future) required version reads the
    # OLD shape — the new-column read is skipped, nothing throws.
    assert byod_schema.version_meets("0001", "0002") is False
    assert byod_schema.version_meets("0001", "0005") is False  # 4 versions behind
    assert byod_schema.version_meets("0003", "0010") is False


def test_version_meets_unknown_side_fails_closed():
    # Unknown/unparseable on either side -> False = fall back to the old shape;
    # never satisfies a gate, never raises (defensive against a corrupt registry).
    assert byod_schema.version_meets(None, "0001") is False
    assert byod_schema.version_meets("garbage", "0001") is False
    assert byod_schema.version_meets("0001", None) is False
    assert byod_schema.version_meets("0001", "garbage") is False
    assert byod_schema.version_meets(None, None) is False


# ── Pure: engine min/target bounds ───────────────────────────────────────────────
def test_engine_bounds_pinned_to_shipped_schema_no_drift():
    # Target and min are sourced from the authoritative schema constant so the
    # engine can never declare support for a shape it does not ship.
    assert byod_schema.ENGINE_TARGET_SCHEMA_VERSION == byod_dataplane.DATA_PLANE_SCHEMA_VERSION
    assert byod_schema.ENGINE_MIN_SCHEMA_VERSION == byod_dataplane.DATA_PLANE_SCHEMA_VERSION


def test_engine_supports_tenant_at_or_above_min():
    assert byod_schema.engine_supports_tenant(byod_schema.ENGINE_MIN_SCHEMA_VERSION) is True
    assert byod_schema.engine_supports_tenant("0099") is True  # well above the floor
    assert byod_schema.engine_supports_tenant("0000") is False  # below the floor
    assert byod_schema.engine_supports_tenant(None) is False  # unknown -> unsupported


def test_provisioned_tenant_meets_current_target():
    # A freshly provisioned tenant (recorded at the baseline) satisfies every gate
    # the engine ships today (target == baseline), so nothing is dark-broken.
    baseline = byod_dataplane.DATA_PLANE_SCHEMA_VERSION
    assert byod_schema.version_meets(baseline, byod_schema.ENGINE_TARGET_SCHEMA_VERSION) is True


# ── byod_engine: control-plane registry read (fail-soft) ─────────────────────────
class _FakeRecord:
    def __init__(self, schema_version):
        self.schema_version = schema_version


class _FakeCursor:
    def cursor(self):
        return self

    def close(self):
        pass


def _configure_control(monkeypatch, *, record, factory_raises=False):
    """Point byod_engine's control-plane seam at a fake conn + a stubbed registry
    lookup returning ``record`` (or raise from the factory if asked)."""
    def factory():
        if factory_raises:
            raise RuntimeError('connect failed host "cp.internal"')
        return _FakeCursor()

    monkeypatch.setattr(byod_engine._Deps, "control_conn_factory", factory)
    monkeypatch.setattr(byod_engine._Deps, "control_conn_release", lambda c: None)
    monkeypatch.setattr(
        byod_engine.byod_store, "get_tenant_db_record", lambda cur, cid: record
    )


def test_tenant_schema_version_reads_registry(monkeypatch):
    _configure_control(monkeypatch, record=_FakeRecord("0007"))
    assert byod_engine.tenant_schema_version("c1") == "0007"


def test_tenant_schema_version_none_when_no_record(monkeypatch):
    _configure_control(monkeypatch, record=None)
    assert byod_engine.tenant_schema_version("c1") is None


def test_tenant_schema_version_unconfigured_is_none(monkeypatch):
    monkeypatch.setattr(byod_engine._Deps, "control_conn_factory", None)
    assert byod_engine.tenant_schema_version("c1") is None


def test_tenant_schema_version_failsoft_on_control_error(monkeypatch):
    # A control-plane connect failure degrades to None (read old shape), never
    # raises, and never leaks the host in a raw exception.
    _configure_control(monkeypatch, record=None, factory_raises=True)
    assert byod_engine.tenant_schema_version("c1") is None


# ── byod_engine: tenant_supports_version (composed gate) ──────────────────────────
def test_tenant_supports_version_true_when_at_or_above(monkeypatch):
    _configure_control(monkeypatch, record=_FakeRecord("0005"))
    assert byod_engine.tenant_supports_version("c1", "0005") is True
    assert byod_engine.tenant_supports_version("c1", "0002") is True


def test_tenant_supports_version_behind_reads_old_shape(monkeypatch):
    # THE PHASE GATE end-to-end: tenant at the baseline, engine asks for a FUTURE
    # required version -> False (read old shape), no throw, even N versions behind.
    _configure_control(monkeypatch, record=_FakeRecord("0001"))
    assert byod_engine.tenant_supports_version("c1", "0002") is False
    assert byod_engine.tenant_supports_version("c1", "0006") is False


def test_tenant_supports_version_failsoft_unprovisioned(monkeypatch):
    # No registry record (not yet provisioned / version unrecorded) -> gate closed,
    # old shape, no throw.
    _configure_control(monkeypatch, record=None)
    assert byod_engine.tenant_supports_version("c1", "0001") is False


def test_tenant_supports_version_uses_passed_version_without_reading(monkeypatch):
    # When the caller already resolved the version this request, no second
    # control-plane read happens (the lookup would explode if called).
    def _boom(cur, cid):
        raise AssertionError("should not re-read the registry")

    monkeypatch.setattr(byod_engine._Deps, "control_conn_factory", _FakeCursor)
    monkeypatch.setattr(byod_engine._Deps, "control_conn_release", lambda c: None)
    monkeypatch.setattr(byod_engine.byod_store, "get_tenant_db_record", _boom)

    assert byod_engine.tenant_supports_version("c1", "0002", schema_version="0005") is True
    assert byod_engine.tenant_supports_version("c1", "0006", schema_version="0005") is False
