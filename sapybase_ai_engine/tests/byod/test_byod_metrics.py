"""BYOD metrics emission (Phase 8.4 follow-up): the §16.9 detection metrics in
METRIC_CATALOG are now actually emitted, so byod_alerts.yml can fire.

Guards: the façade has a collector for every catalog metric (no drift), each façade
call writes to the right collector (read back via the Prometheus registry), emission
is fail-soft, and the pool chokepoints (routing mismatch) really increment the
metric. All pure (no DB) — runs in engine-regression (prometheus_client is a dep).
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from observability import metrics, slo
from observability.request_metrics import RequestMetricsMiddleware


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


def test_http_request_facade_writes_collector():
    # Counter: status_class/plane/company_id land on sapybase_http_requests_total.
    metrics.http_request("/api/chat", "5xx", "shared", "cHTTP")
    assert _val(
        "sapybase_http_requests_total",
        {"route": "/api/chat", "status_class": "5xx", "plane": "shared", "company_id": "cHTTP"},
    ) == 1.0
    # Histogram: duration observed on the _count series for the same labels.
    metrics.observe_http_duration("/api/chat", "tenant", "cHTTP", 0.01)
    assert _val(
        "sapybase_http_request_duration_seconds_count",
        {"route": "/api/chat", "plane": "tenant", "company_id": "cHTTP"},
    ) == 1.0


def test_request_metrics_middleware_emits_per_request():
    """The real middleware, mounted on a minimal app, emits the request counter with
    the matched route template, the right status_class, and request.state-driven
    plane/company_id — and stays fail-soft (a handler raising is recorded as 5xx).

    NB: FastAPI/TestClient/Request are imported at MODULE TOP on purpose — with
    ``from __future__ import annotations`` the ``request: Request`` annotation is a
    string FastAPI resolves via the module globals, so a function-local import would
    make it 422 the request instead of injecting the Request."""
    app = FastAPI()
    app.add_middleware(RequestMetricsMiddleware)

    @app.get("/ok")
    def ok():
        return {"ok": True}

    @app.get("/tenant/{cid}")
    def tenant(cid: str, request: Request):
        # Exactly how the chat handler upgrades the plane: set request.state inside
        # the endpoint. It must be visible to the middleware (shared via scope) even
        # across Starlette's middleware/endpoint task boundary.
        request.state.metrics_plane = "tenant"
        request.state.metrics_company_id = "cMW"
        return {"cid": cid}

    @app.get("/boom")
    def boom():
        raise RuntimeError("kaboom")

    client = TestClient(app, raise_server_exceptions=False)

    before = _val(
        "sapybase_http_requests_total",
        {"route": "/ok", "status_class": "2xx", "plane": "shared", "company_id": ""},
    )
    client.get("/ok")
    assert _val(
        "sapybase_http_requests_total",
        {"route": "/ok", "status_class": "2xx", "plane": "shared", "company_id": ""},
    ) - before == 1.0

    # Tenant plane + company_id from request.state, route template (not raw path).
    client.get("/tenant/abc")
    assert _val(
        "sapybase_http_requests_total",
        {"route": "/tenant/{cid}", "status_class": "2xx", "plane": "tenant", "company_id": "cMW"},
    ) == 1.0

    # A handler exception is recorded as 5xx (fail-soft) before surfacing.
    client.get("/boom")
    assert _val(
        "sapybase_http_requests_total",
        {"route": "/boom", "status_class": "5xx", "plane": "shared", "company_id": ""},
    ) == 1.0

    # Unmatched route collapses to "unmatched" (bounded cardinality).
    client.get("/no-such-path")
    assert _val(
        "sapybase_http_requests_total",
        {"route": "unmatched", "status_class": "4xx", "plane": "shared", "company_id": ""},
    ) == 1.0


def test_emission_is_fail_soft():
    # Bad arguments (e.g. .set(None)) must be swallowed — metrics never break a request.
    metrics.breaker_state("x", None)  # type: ignore[arg-type]
    metrics.db_error("x", None)  # type: ignore[arg-type]
    metrics.observe_query_duration("x", None)  # type: ignore[arg-type]


def test_render_contains_emitted_metric():
    metrics.routing_violation("cRender")
    out = metrics.render().decode()
    assert "byod_routing_integrity_violations_total" in out


def test_render_multiproc_branch_aggregates(tmp_path, monkeypatch):
    # When PROMETHEUS_MULTIPROC_DIR is active, render() must use a MultiProcessCollector
    # registry (aggregating all workers) instead of the per-process default — and must
    # not raise even with an empty dir (no worker has written yet).
    monkeypatch.setattr(metrics, "_MULTIPROC_DIR", str(tmp_path))
    out = metrics.render()
    assert isinstance(out, bytes)


def test_gauges_have_multiprocess_mode():
    # Every gauge collector carries a multiprocess aggregation mode so it behaves
    # correctly under gunicorn -w N (no per-pid series explosion / random-worker reads).
    from prometheus_client import Gauge

    for name, spec in slo.METRIC_CATALOG.items():
        if spec["type"] == "gauge":
            collector = metrics._M[name]
            assert isinstance(collector, Gauge)
            assert getattr(collector, "_multiprocess_mode", None) in {"livesum", "max"}


def test_pool_routing_mismatch_increments_metric():
    # Integration: the pool's assert_tenant abort path (E5) really emits the metric.
    from db.byod_pool import RoutingIntegrityError

    from .test_byod_pool import make_registry

    reg, _ = make_registry()
    before = _val("byod_routing_integrity_violations_total", {"company_id": "B"})
    with reg.get_tenant_db("A") as conn:
        with pytest.raises(RoutingIntegrityError):
            reg.assert_tenant(conn, "B")  # checked out for A → mismatch → abort + metric
    after = _val("byod_routing_integrity_violations_total", {"company_id": "B"})
    assert after - before == 1.0
