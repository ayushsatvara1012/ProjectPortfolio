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
SLO_VERSION = "2026-06-16.1"

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
    # ── §16.9 exceptional-state detection signals (Phase 8.4) ─────────────────
    # One detection metric per row of the §16.9 matrix that the breaker /
    # error-rate / pool signals above do not already cover. Every EXCEPTIONAL_STATES
    # row must point at a metric that exists here (asserted by the Phase-8.4 gate).
    "byod_tenant_vector_dimension_mismatch_total": {
        "type": "counter",
        "labels": ["company_id"],
        "description": "Wrong-dimension embedding rows skipped on read (§16.9 'wrong-dimension vectors'); tenant marked unhealthy.",
    },
    "byod_tenant_schema_version": {
        "type": "gauge",
        "labels": ["company_id"],
        "description": "Tenant data-plane schema version (numeric) recorded in the control-plane registry (§8.1); drift vs engine target is the §16.9 'schema ahead/behind' signal.",
    },
    "byod_tenant_schema_gate_total": {
        "type": "counter",
        "labels": ["company_id", "decision"],
        "description": "Version-gated feature reads, decision=met|blocked (§16.9 'schema ahead/behind' → version-gate, never throw, RFC §8.2).",
    },
    "byod_kms_decrypt_errors_total": {
        "type": "counter",
        "labels": ["company_id", "outcome"],
        "description": "KMS/decrypt failures, outcome=served_cached|cold_fail (§16.9 'KMS unavailable' → serve from decrypted-DSN cache; cold tenant fails alone, RFC §16.5).",
    },
    "byod_dsn_cache_serves_total": {
        "type": "counter",
        "labels": ["mode"],
        "description": "Decrypted-DSN cache serves, mode=fresh|stale; stale serves indicate degraded KMS operation (RFC §16.5).",
    },
    "byod_global_connections_in_flight": {
        "type": "gauge",
        "labels": [],
        "description": "Global tenant-connection in-flight count vs the fleet ceiling (§11 'global tenant-connection ceiling approached').",
    },
    "byod_global_connection_ceiling_rejections_total": {
        "type": "counter",
        "labels": [],
        "description": "Tenant-connection acquisitions shed at the global ceiling → 503 retry-after (§16.9 'global ceiling reached', E7).",
    },
    "byod_metering_idempotent_replays_total": {
        "type": "counter",
        "labels": ["company_id"],
        "description": "Metering writes deduped by idempotency key — no double-count (§16.9 'idempotency-key replay', E1).",
    },
    "byod_routing_integrity_violations_total": {
        "type": "counter",
        "labels": ["company_id"],
        "description": "Connection company_id-tag assertion failures → query aborted, never served cross-tenant (§16.9 'routing/company mismatch', E5). Any non-zero value pages.",
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

# ── §16.9 exceptional-state matrix → detection / alert / runbook (Phase 8.4) ──
# The GA gate (RFC §13 Phase 8.4): "All §16.9 states alert + have a runbook."
# This is the single machine-checked source of that mapping. Each row mirrors one
# row of the RFC §16.9 table and binds it to:
#   * metrics  — detection signal(s); every name MUST exist in METRIC_CATALOG
#   * alert    — an alert name that MUST exist in ALERTS
#   * runbook  — the anchor (id="...") of its section in docs/runbooks/byod_runbook.md
# `title` is verbatim from the RFC table so a dropped/renamed state is caught.
EXCEPTIONAL_STATES: tuple[dict[str, Any], ...] = (
    {
        "key": "tenant_db_read_only",
        "title": "Tenant DB read-only / in recovery",
        "detection": "write fails",
        "engine_behavior": "Serve the answer; skip/queue the chat_log write (degraded); alert.",
        "metrics": ["byod_tenant_db_errors_total"],
        "alert": "BYODTenantWriteDegraded",
        "runbook": "tenant-db-read-only",
    },
    {
        "key": "wrong_dimension_vectors",
        "title": "Wrong-dimension vectors",
        "detection": "dimension check",
        "engine_behavior": "Skip rows; mark tenant unhealthy; alert.",
        "metrics": ["byod_tenant_vector_dimension_mismatch_total"],
        "alert": "BYODTenantVectorDimensionMismatch",
        "runbook": "wrong-dimension-vectors",
    },
    {
        "key": "breaker_open",
        "title": "Breaker open (repeated failures)",
        "detection": "breaker state",
        "engine_behavior": "Fast-fail that tenant ('temporarily unavailable'); isolated.",
        "metrics": ["byod_tenant_circuit_breaker_state"],
        "alert": "BYODTenantBreakerOpen",
        "runbook": "breaker-open",
    },
    {
        "key": "schema_drift",
        "title": "Schema ahead/behind engine",
        "detection": "schema_version compare",
        "engine_behavior": "Version-gate features; never throw.",
        "metrics": ["byod_tenant_schema_gate_total", "byod_tenant_schema_version"],
        "alert": "BYODTenantSchemaGateBlocked",
        "runbook": "schema-drift",
    },
    {
        "key": "kms_unavailable",
        "title": "KMS unavailable",
        "detection": "decrypt error",
        "engine_behavior": "Serve from decrypted-DSN cache; if cold, fail that tenant only.",
        "metrics": ["byod_kms_decrypt_errors_total", "byod_dsn_cache_serves_total"],
        "alert": "BYODKmsDecryptErrors",
        "runbook": "kms-unavailable",
    },
    {
        "key": "global_ceiling",
        "title": "Global ceiling reached",
        "detection": "pool acquire",
        "engine_behavior": "Bounded wait -> 503 retry-after; fair scheduling.",
        "metrics": [
            "byod_global_connection_ceiling_rejections_total",
            "byod_global_connections_in_flight",
        ],
        "alert": "BYODGlobalCeilingReached",
        "runbook": "global-ceiling",
    },
    {
        "key": "idempotency_replay",
        "title": "Idempotency-key replay",
        "detection": "key seen",
        "engine_behavior": "No double meter, no duplicate row.",
        "metrics": ["byod_metering_idempotent_replays_total"],
        "alert": "BYODMeteringReplaySpike",
        "runbook": "idempotency-replay",
    },
    {
        "key": "routing_mismatch",
        "title": "Routing / company mismatch",
        "detection": "conn-tag assert",
        "engine_behavior": "Abort the query + alert (never serve cross-tenant).",
        "metrics": ["byod_routing_integrity_violations_total"],
        "alert": "BYODRoutingIntegrityViolation",
        "runbook": "routing-mismatch",
    },
)

# Operational runbooks required by RFC §11 (beyond the §16.9 per-state ones).
# Each value is the anchor id of its section in docs/runbooks/byod_runbook.md.
OPERATIONAL_RUNBOOKS: dict[str, str] = {
    "Onboarding failure": "onboarding-failure",
    "Stuck migration": "stuck-migration",
    "Tenant DB outage": "tenant-db-outage",
    "Credential rotation": "credential-rotation",
    "Emergency disconnect": "emergency-disconnect",
}

# ── Alerts as code (Phase 8.4) ───────────────────────────────────────────────
# Single source of truth for the BYOD alerts (RFC §11). Each expr references only
# METRIC_CATALOG metrics; `runbook` is the anchor in docs/runbooks/byod_runbook.md.
# `render_prometheus_rules()` projects these into a Prometheus rule group, and the
# committed observability/alerts/byod_alerts.yml is checked against it (drift guard,
# same discipline as baseline.json / the dashboard).
#   severity: page  -> wake someone now;  ticket -> next business hours;  info -> FYI.
ALERTS: dict[str, dict[str, Any]] = {
    "BYODTenantWriteDegraded": {
        "expr": 'sum by (company_id) (rate(byod_tenant_db_errors_total{kind="readonly"}[5m])) > 0',
        "severity": "ticket",
        "for": "5m",
        "summary": "Tenant DB rejecting writes (read-only / in recovery); chat_log writes degraded.",
        "runbook": "tenant-db-read-only",
    },
    "BYODTenantVectorDimensionMismatch": {
        "expr": "sum by (company_id) (increase(byod_tenant_vector_dimension_mismatch_total[15m])) > 0",
        "severity": "ticket",
        "for": "0m",
        "summary": "Tenant has wrong-dimension embedding rows; rows skipped, tenant marked unhealthy.",
        "runbook": "wrong-dimension-vectors",
    },
    "BYODTenantBreakerOpen": {
        "expr": "max by (company_id) (byod_tenant_circuit_breaker_state) == 1",
        "severity": "ticket",
        "for": "5m",
        "summary": "Tenant circuit breaker open >5m; that tenant is fast-failing (isolated).",
        "runbook": "breaker-open",
    },
    "BYODTenantSchemaGateBlocked": {
        "expr": 'sum by (company_id) (rate(byod_tenant_schema_gate_total{decision="blocked"}[15m])) > 0',
        "severity": "ticket",
        "for": "15m",
        "summary": "Tenant schema behind engine target; features version-gated off (no error, but a migration is owed).",
        "runbook": "schema-drift",
    },
    "BYODKmsColdTenantDown": {
        # A cold_fail means KMS is unavailable AND there is no cached DSN for that
        # tenant — it is hard-down *now*. Page fast: increase()[10m] latches on even
        # a single failure and stays > 0 for the whole window, so a brief burst
        # reliably clears for:1m (the rate[5m] aggregate below needs the failures to
        # *sustain* and silently misses short bursts — readiness 2d finding).
        "expr": 'sum(increase(byod_kms_decrypt_errors_total{outcome="cold_fail"}[10m])) > 0',
        "severity": "page",
        "for": "1m",
        "summary": "KMS/decrypt failure on a cold tenant (no cached DSN) — that tenant is DOWN now. Fast page; does not wait for a sustained rate.",
        "runbook": "kms-unavailable",
    },
    "BYODKmsDecryptErrors": {
        # served_cached: KMS is unavailable but we are still serving from the
        # decrypted-DSN cache (tenants up, but the cache is time-bounded — fix KMS
        # before it expires). Sustained-rate page; cold_fail is handled faster above.
        "expr": 'sum(rate(byod_kms_decrypt_errors_total{outcome="served_cached"}[5m])) > 0',
        "severity": "page",
        "for": "5m",
        "summary": "KMS/decrypt failures while serving from the decrypted-DSN cache (tenants still up, but the cache is time-bounded — fix KMS before it expires).",
        "runbook": "kms-unavailable",
    },
    "BYODGlobalCeilingReached": {
        "expr": "sum(rate(byod_global_connection_ceiling_rejections_total[5m])) > 0",
        "severity": "page",
        "for": "5m",
        "summary": "Global tenant-connection ceiling hit; requests shed with 503 retry-after.",
        "runbook": "global-ceiling",
    },
    "BYODMeteringReplaySpike": {
        "expr": "sum by (company_id) (rate(byod_metering_idempotent_replays_total[5m])) > 0.5",
        "severity": "info",
        "for": "15m",
        "summary": "Elevated idempotent metering replays; dedup is holding (no double-count) but investigate the retry source.",
        "runbook": "idempotency-replay",
    },
    "BYODRoutingIntegrityViolation": {
        "expr": "increase(byod_routing_integrity_violations_total[5m]) > 0",
        "severity": "page",
        "for": "0m",
        "summary": "Connection company_id-tag assertion failed — possible cross-tenant routing. Query aborted; investigate immediately.",
        "runbook": "routing-mismatch",
    },
}

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


# ── Phase 8.4: §16.9 coverage + alerts-as-code projection ────────────────────

# Anchor of the on-call sign-off section in the runbook doc — the GA-gate
# "on-call sign-off" lives there and is asserted present by the gate test.
RUNBOOK_DOC = "docs/runbooks/byod_runbook.md"


def _metrics_for(expr: str) -> list[str]:
    """Catalog metric names referenced by a PromQL expr (``_bucket`` suffix tolerated)."""
    return [m for m in METRIC_CATALOG if m in expr]


def exceptional_state_coverage() -> dict[str, Any]:
    """Coverage report for the §16.9 matrix — the machine-checked GA gate.

    For every exceptional state, verify each detection metric exists in
    METRIC_CATALOG and the alert exists in ALERTS (and its expr references a
    real catalog metric). Returns ``{"ok": bool, "states": [...]}``; ``ok`` is
    True only when every state is fully covered (metric + alert + runbook).
    """
    states = []
    ok = True
    for st in EXCEPTIONAL_STATES:
        missing_metrics = [m for m in st["metrics"] if m not in METRIC_CATALOG]
        alert = ALERTS.get(st["alert"])
        alert_ok = alert is not None and bool(_metrics_for(alert["expr"]))
        has_runbook = bool(st.get("runbook"))
        covered = not missing_metrics and alert_ok and has_runbook
        ok = ok and covered
        states.append(
            {
                "key": st["key"],
                "title": st["title"],
                "covered": covered,
                "missing_metrics": missing_metrics,
                "alert": st["alert"],
                "alert_defined": alert is not None,
                "alert_references_metric": alert_ok,
                "runbook": st.get("runbook"),
            }
        )
    return {"ok": ok, "states": states}


def render_prometheus_rules() -> dict[str, Any]:
    """Project ALERTS into a Prometheus alerting-rule group (alerts-as-code).

    The committed ``observability/alerts/byod_alerts.yml`` is generated from /
    checked against this (drift guard). YAML is a JSON superset, so the file is
    written with ``json`` and stays dependency-free.
    """
    rules = []
    for name, a in ALERTS.items():
        rules.append(
            {
                "alert": name,
                "expr": a["expr"],
                "for": a["for"],
                "labels": {"severity": a["severity"], "feature": "byod"},
                "annotations": {
                    "summary": a["summary"],
                    "runbook_url": f"{RUNBOOK_DOC}#{a['runbook']}",
                },
            }
        )
    return {"groups": [{"name": "byod", "rules": rules}]}
