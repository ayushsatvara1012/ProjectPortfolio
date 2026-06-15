"""Phase 0.3 gate: SLOs + dashboards-as-code are well-formed and the baseline
is captured & consistent, so later phases can prove no regression.

Exit criterion (RFC §13, Phase 0.3): "Baseline captured so later phases can
prove no regression." These tests need no database and run everywhere.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from observability import slo

_OBS_DIR = Path(__file__).resolve().parents[1].parent / "observability"
_DASHBOARD_PATH = _OBS_DIR / "dashboards" / "byod_slo_dashboard.json"
_BASELINE_PATH = _OBS_DIR / "baseline.json"


# ── SLO definitions ──────────────────────────────────────────────────────────

def test_both_planes_defined_with_sane_thresholds():
    assert set(slo.SLOS) == {"shared", "tenant"}
    for plane, s in slo.SLOS.items():
        assert 0.0 < s["error_rate_max"] < 1.0, plane
        assert s["latency_p95_ms_max"] > 0, plane
        assert s["latency_p99_ms_max"] >= s["latency_p95_ms_max"], plane


def test_metric_catalog_supports_shared_and_per_tenant():
    cat = slo.METRIC_CATALOG
    # Shared error-rate + latency sources, partitionable by plane.
    assert "plane" in cat["sapybase_http_requests_total"]["labels"]
    assert "status_class" in cat["sapybase_http_requests_total"]["labels"]
    assert "plane" in cat["sapybase_http_request_duration_seconds"]["labels"]
    # Per-tenant isolation signals, all keyed by company_id.
    for m in (
        "byod_tenant_circuit_breaker_state",
        "byod_tenant_pool_connections_in_use",
        "byod_tenant_pool_size",
        "byod_tenant_db_errors_total",
        "byod_tenant_query_duration_seconds",
    ):
        assert "company_id" in cat[m]["labels"], m


# ── Dashboard-as-code ────────────────────────────────────────────────────────

def _load_dashboard() -> dict:
    return json.loads(_DASHBOARD_PATH.read_text())


def test_dashboard_is_valid_json_with_shared_and_tenant_rows():
    dash = _load_dashboard()
    row_titles = [p["title"] for p in dash["panels"] if p.get("type") == "row"]
    assert any("Shared" in t for t in row_titles)
    assert any("tenant" in t.lower() for t in row_titles)


def test_dashboard_targets_reference_catalog_metrics():
    dash = _load_dashboard()
    catalog = set(slo.METRIC_CATALOG)
    referenced: set[str] = set()
    for panel in dash["panels"]:
        for target in panel.get("targets", []):
            expr = target.get("expr", "")
            hits = [m for m in catalog if m in expr]  # _bucket suffix still matches its base
            assert hits, f"panel {panel.get('id')} expr references no catalog metric: {expr}"
            referenced.update(hits)
    # Core SLO signals must all appear somewhere on the dashboard.
    assert {
        "sapybase_http_requests_total",
        "sapybase_http_request_duration_seconds",
        "byod_tenant_db_errors_total",
        "byod_tenant_query_duration_seconds",
        "byod_tenant_circuit_breaker_state",
    } <= referenced


def test_dashboard_has_per_tenant_template_variable():
    dash = _load_dashboard()
    names = [v["name"] for v in dash["templating"]["list"]]
    assert "company_id" in names


# ── Baseline artifact ────────────────────────────────────────────────────────

def test_baseline_exists_and_is_consistent_with_code():
    assert _BASELINE_PATH.exists(), "run scripts/capture_slo_baseline.py to capture the baseline"
    baseline = json.loads(_BASELINE_PATH.read_text())

    # Drift guard: the SLO snapshot in the baseline must match the code.
    assert baseline["slo"] == json.loads(json.dumps(slo.as_dict())), (
        "baseline.json SLO snapshot is stale; regenerate with scripts/capture_slo_baseline.py"
    )
    assert baseline["slo_version"] == slo.SLO_VERSION

    # Shared-plane baseline (the regression gate) has the comparable measurements.
    shared = baseline["measurements"]["shared"]
    for k in ("error_rate", "latency_p95_ms", "latency_p99_ms"):
        assert k in shared
    # git commit recorded (or explicitly unknown)
    assert re.fullmatch(r"[0-9a-f]{7,40}|unknown", baseline["git_commit"])


# ── Regression comparison engine ─────────────────────────────────────────────

def test_no_regression_when_within_baseline():
    baseline = {"error_rate": 0.003, "latency_p95_ms": 900, "latency_p99_ms": 1800}
    current = {"error_rate": 0.0031, "latency_p95_ms": 905, "latency_p99_ms": 1810}
    report = slo.evaluate_regression(baseline, current, plane="shared")
    assert report["ok"], report


def test_regression_flagged_when_error_rate_blows_budget():
    baseline = {"error_rate": 0.003, "latency_p95_ms": 900, "latency_p99_ms": 1800}
    # error_rate budget = max(0.003, slo 0.005) * 1.10 = 0.0055; 0.02 >> that.
    current = {"error_rate": 0.02, "latency_p95_ms": 900, "latency_p99_ms": 1800}
    report = slo.evaluate_regression(baseline, current, plane="shared")
    assert not report["ok"]
    assert any(v["metric"] == "error_rate" for v in report["violations"])


def test_regression_uses_slo_ceiling_as_floor_for_budget():
    # Even if the captured baseline measured worse than the SLO, the budget never
    # drops below the SLO ceiling.
    baseline = {"error_rate": 0.001, "latency_p95_ms": 100, "latency_p99_ms": 200}
    # current within SLO ceiling (0.005) but above tiny baseline — must still pass
    # because budget = max(baseline, slo_ceiling)*1.1.
    current = {"error_rate": 0.005, "latency_p95_ms": 1500, "latency_p99_ms": 3000}
    report = slo.evaluate_regression(baseline, current, plane="shared")
    assert report["ok"], report
