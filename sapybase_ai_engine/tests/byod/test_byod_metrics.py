"""BYOD metrics emission (Phase 8.4 follow-up): the §16.9 detection metrics in
METRIC_CATALOG are now actually emitted, so byod_alerts.yml can fire.

Guards: the façade has a collector for every catalog metric (no drift), each façade
call writes to the right collector (read back via the Prometheus registry), emission
is fail-soft, and the pool chokepoints (routing mismatch) really increment the
metric. All pure (no DB) — runs in engine-regression (prometheus_client is a dep).
"""
from __future__ import annotations

import pytest

from observability import metrics, slo


def _val(name: str, labels: dict | None = None) -> float:
    """Current registry value for a sample (0.0 if never set)."""
    from prometheus_client import REGISTRY

    v = REGISTRY.get_sample_value(name, labels or {})
    return 0.0 if v is None else v


def test_collector_for_every_catalog_metric():
    # Façade must instantiate exactly the catalog — no metric without a collector,
    # no collector without a catalog entry.
    assert set(metrics._M) == set(slo.METRIC_CATALOG)


def test_metrics_module_enabled_with_prometheus_client():
    # prometheus_client is a declared dependency; in this env it must be active.
    assert metrics.enabled() is True


def test_counter_sample_keeps_total_suffix():
    metrics.routing_violation("cTotal")
    # We strip _total before constructing; prometheus re-adds it on the sample.
    assert _val("byod_routing_integrity_violations_total", {"company_id": "cTotal"}) == 1.0


def test_each_facade_writes_its_collector():
    b = _val("byod_global_connection_ceiling_rejections_total")
    metrics.ceiling_rejection()
    assert _val("byod_global_connection_ceiling_rejections_total") - b == 1.0

    metrics.dsn_cache_serve("stale")
    assert _val("byod_dsn_cache_serves_total", {"mode": "stale"}) >= 1.0

    metrics.kms_decrypt_error("cK", "cold_fail")
    assert _val("byod_kms_decrypt_errors_total", {"company_id": "cK", "outcome": "cold_fail"}) == 1.0

    metrics.breaker_state("cB", 1)
    assert _val("byod_tenant_circuit_breaker_state", {"company_id": "cB"}) == 1.0

    metrics.schema_gate("cS", "blocked")
    assert _val("byod_tenant_schema_gate_total", {"company_id": "cS", "decision": "blocked"}) == 1.0

    metrics.schema_version("cS", 2)
    assert _val("byod_tenant_schema_version", {"company_id": "cS"}) == 2.0

    metrics.idempotent_replay("cR")
    assert _val("byod_metering_idempotent_replays_total", {"company_id": "cR"}) == 1.0

    metrics.global_in_flight(5)
    assert _val("byod_global_connections_in_flight") == 5.0

    metrics.db_error("cD", "readonly")
    assert _val("byod_tenant_db_errors_total", {"company_id": "cD", "kind": "readonly"}) == 1.0


def test_emission_is_fail_soft():
    # Bad arguments (e.g. .set(None)) must be swallowed — metrics never break a request.
    metrics.breaker_state("x", None)  # type: ignore[arg-type]
    metrics.db_error("x", None)  # type: ignore[arg-type]
    metrics.observe_query_duration("x", None)  # type: ignore[arg-type]


def test_render_contains_emitted_metric():
    metrics.routing_violation("cRender")
    out = metrics.render().decode()
    assert "byod_routing_integrity_violations_total" in out


def test_pool_routing_mismatch_increments_metric():
    # Integration: the pool's assert_tenant abort path (E5) really emits the metric.
    from byod_pool import RoutingIntegrityError

    from .test_byod_pool import make_registry

    reg, _ = make_registry()
    before = _val("byod_routing_integrity_violations_total", {"company_id": "B"})
    with reg.get_tenant_db("A") as conn:
        with pytest.raises(RoutingIntegrityError):
            reg.assert_tenant(conn, "B")  # checked out for A → mismatch → abort + metric
    after = _val("byod_routing_integrity_violations_total", {"company_id": "B"})
    assert after - before == 1.0
