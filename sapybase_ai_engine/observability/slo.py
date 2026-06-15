"""BYOD SLO definitions + metric catalog (RFC Phase 0.3).

Single source of truth for the error-rate / latency Service Level Objectives the
BYOD rollout is held to, for BOTH planes:

  * shared  — the existing shared-DB tenant fleet. Its error-rate / latency SLO
    is the HARD GATE every later phase must not regress (RFC §13: "Error rate
    must not regress.").
  * tenant  — each BYOD tenant's own (remote) database path, plus the
    BYOD-specific isolation signals (circuit breaker, per-tenant pool).

Pure data + pure functions — no I/O, no env reads, importable cheaply. The
companion dashboard (`dashboards/byod_slo_dashboard.json`) and the captured
`baseline.json` are both derived from / checked against this module so the three
can never silently drift.
"""
from __future__ import annotations

from typing import Any

# Bump when SLO targets or the metric catalog change; the committed baseline.json
# records the version it was captured against so drift is detectable.
SLO_VERSION = "2026-06-14.1"

# ── Metric catalog ───────────────────────────────────────────────────────────
# The contract for what the engine emits. `plane` distinguishes shared vs tenant
# traffic; `company_id` enables per-tenant breakdowns on the dashboard. Nothing
# emits these yet (Phase 0 is dark); this fixes the names/labels the dashboards
# and later instrumentation agree on.
METRIC_CATALOG: dict[str, dict[str, Any]] = {
    "sapybase_http_requests_total": {
        "type": "counter",
        "labels": ["route", "status_class", "plane", "company_id"],
        "description": "HTTP requests, partitioned by 2xx/4xx/5xx status_class — error-rate numerator/denominator.",
    },
    "sapybase_http_request_duration_seconds": {
        "type": "histogram",
        "labels": ["route", "plane", "company_id"],
        "description": "End-to-end request latency; source for p50/p95/p99.",
    },
    "byod_tenant_circuit_breaker_state": {
        "type": "gauge",
        "labels": ["company_id"],
        "description": "Per-tenant breaker: 0=closed, 1=open, 2=half-open (RFC §7.3).",
    },
    "byod_tenant_pool_connections_in_use": {
        "type": "gauge",
        "labels": ["company_id"],
        "description": "Per-tenant connection-pool connections currently checked out.",
    },
    "byod_tenant_pool_size": {
        "type": "gauge",
        "labels": ["company_id"],
        "description": "Per-tenant connection-pool size (for saturation = in_use / size).",
    },
    "byod_tenant_db_errors_total": {
        "type": "counter",
        "labels": ["company_id", "kind"],
        "description": "Per-tenant DB errors (timeout, connect, query) — per-tenant error-rate.",
    },
    "byod_tenant_query_duration_seconds": {
        "type": "histogram",
        "labels": ["company_id"],
        "description": "Per-tenant remote DB query latency.",
    },
}

# ── SLO objectives ───────────────────────────────────────────────────────────
# Shared plane: the regression gate. error_rate_max is the ceiling the shared
# fleet must stay at or below across every BYOD phase.
SHARED_SLO: dict[str, float] = {
    "availability_target": 0.999,     # 99.9% successful requests
    "error_rate_max": 0.005,          # <= 0.5% 5xx
    "latency_p95_ms_max": 1500.0,
    "latency_p99_ms_max": 3000.0,
}

# Tenant plane: a single slow/broken BYOD DB must stay isolated (RFC §7).
TENANT_SLO: dict[str, float] = {
    "error_rate_max": 0.02,           # <= 2% per-tenant DB errors (client infra SLA)
    "latency_p95_ms_max": 2500.0,     # remote DB adds network hop
    "latency_p99_ms_max": 5000.0,
    "breaker_open_ratio_max": 0.05,   # breaker open <= 5% of the time
    "pool_saturation_max": 0.90,      # in_use/size stays under 90%
}

SLOS: dict[str, dict[str, float]] = {"shared": SHARED_SLO, "tenant": TENANT_SLO}

# Keys that are "lower is better" error/latency signals subject to the
# no-regression check (others, like availability_target, are floors).
_REGRESSION_KEYS = (
    "error_rate_max",
    "latency_p95_ms_max",
    "latency_p99_ms_max",
)
# Map an SLO ceiling key to the measurement key it bounds.
_MEASUREMENT_FOR = {
    "error_rate_max": "error_rate",
    "latency_p95_ms_max": "latency_p95_ms",
    "latency_p99_ms_max": "latency_p99_ms",
}


def as_dict() -> dict[str, Any]:
    """Serializable snapshot of the SLO contract (for baseline.json + dashboards)."""
    return {
        "slo_version": SLO_VERSION,
        "slos": SLOS,
        "metric_catalog": METRIC_CATALOG,
    }


def evaluate_regression(
    baseline: dict[str, Any],
    current: dict[str, Any],
    *,
    plane: str = "shared",
    tolerance: float = 0.10,
) -> dict[str, Any]:
    """Compare current measurements against a captured baseline for one plane.

    `baseline` and `current` are measurement dicts like
    ``{"error_rate": 0.003, "latency_p95_ms": 900, "latency_p99_ms": 1800}``.

    A metric "regresses" if it exceeds ``max(baseline_value, slo_ceiling) *
    (1 + tolerance)`` — i.e. later phases may not make the shared fleet worse
    than it is today (with a small tolerance), nor breach the SLO ceiling.

    Returns ``{"ok": bool, "plane": str, "violations": [...]}``.
    """
    ceilings = SLOS.get(plane, {})
    violations = []
    for slo_key in _REGRESSION_KEYS:
        m_key = _MEASUREMENT_FOR[slo_key]
        if m_key not in current:
            continue
        cur_val = float(current[m_key])
        base_val = float(baseline.get(m_key, ceilings.get(slo_key, cur_val)))
        slo_ceiling = float(ceilings.get(slo_key, base_val))
        budget = max(base_val, slo_ceiling) * (1.0 + tolerance)
        if cur_val > budget:
            violations.append(
                {
                    "metric": m_key,
                    "current": cur_val,
                    "baseline": base_val,
                    "slo_ceiling": slo_ceiling,
                    "budget": budget,
                }
            )
    return {"ok": not violations, "plane": plane, "violations": violations}
