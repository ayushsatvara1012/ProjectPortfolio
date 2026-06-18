"""BYOD metrics emission — wires the (previously dark) METRIC_CATALOG to a real
Prometheus endpoint so the §16.9 alerts in ``byod_alerts.yml`` can actually fire.

Design
------
* Metric objects are built FROM ``slo.METRIC_CATALOG`` (single source of truth) so
  the emitted names/labels can never drift from the dashboard / alert contract.
* Thin façade: callers in the hot path use ``metrics.routing_violation(cid)`` etc.
  Every façade call is exception-safe — a metrics failure must NEVER break request
  handling or tenant isolation (same fail-soft posture as the rest of BYOD).
* If ``prometheus_client`` is not installed the whole module degrades to safe
  no-ops, so the import-light BYOD modules and the no-DB test suite import and run
  unchanged.

Cardinality note: per-``company_id`` labels are intentional (BYOD is Enterprise/
Custom-gated → a small tenant count). Revisit before opening BYOD to a large fleet.
"""
from __future__ import annotations

import os
from typing import Dict, Optional

from . import slo

try:  # prometheus_client is optional at import time (fail-soft to no-ops).
    from prometheus_client import (
        CONTENT_TYPE_LATEST,
        Counter,
        Gauge,
        Histogram,
        generate_latest,
    )

    _ENABLED = True
except Exception:  # pragma: no cover - exercised only when the dep is absent
    _ENABLED = False
    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4; charset=utf-8"


# Multiprocess mode (gunicorn -w N): each worker has its own in-process registry,
# so a /metrics scrape would hit one random worker. Setting PROMETHEUS_MULTIPROC_DIR
# makes every worker write to shared mmap files that MultiProcessCollector aggregates
# at scrape time (readiness 2.1). The dir must exist before any metric is built.
_MULTIPROC_DIR = os.environ.get("PROMETHEUS_MULTIPROC_DIR") or None
if _ENABLED and _MULTIPROC_DIR:
    try:
        os.makedirs(_MULTIPROC_DIR, exist_ok=True)
    except OSError:  # pragma: no cover - defensive; render() still degrades safely
        pass

# How each gauge aggregates across worker processes (ignored in single-process mode).
# Additive resource counts sum across live workers; per-tenant state takes the max so
# any worker observing an open breaker / higher schema version is reflected.
_GAUGE_MULTIPROC_MODE = {
    "byod_global_connections_in_flight": "livesum",
    "byod_tenant_pool_connections_in_use": "livesum",
    "byod_tenant_pool_size": "livesum",
    "byod_tenant_circuit_breaker_state": "max",
    "byod_tenant_schema_version": "max",
}


def _build() -> Dict[str, object]:
    """Instantiate one Prometheus collector per METRIC_CATALOG entry."""
    if not _ENABLED:
        return {}
    built: Dict[str, object] = {}
    for name, spec in slo.METRIC_CATALOG.items():
        mtype = spec["type"]
        labels = tuple(spec.get("labels") or ())
        # Counter names in the catalog already carry the _total suffix; prometheus
        # appends its own, so strip it to avoid byod_..._total_total.
        prom_name = name[:-6] if (mtype == "counter" and name.endswith("_total")) else name
        if mtype == "gauge":
            # multiprocess_mode is accepted in both modes; only used under multiproc.
            built[name] = Gauge(
                prom_name, spec["description"], labels,
                multiprocess_mode=_GAUGE_MULTIPROC_MODE.get(name, "max"),
            )
        elif mtype == "histogram":
            built[name] = Histogram(prom_name, spec["description"], labels)
        else:
            built[name] = Counter(prom_name, spec["description"], labels)
    return built


_M: Dict[str, object] = _build()


def _safe(fn):
    """Decorator: a metrics emission must never raise into the caller."""

    def wrapper(*args, **kwargs):
        if not _ENABLED:
            return
        try:
            return fn(*args, **kwargs)
        except Exception:  # pragma: no cover - defensive; metrics never break a request
            return

    return wrapper


# ── Shared/tenant HTTP request rate + latency (error-rate source, §16.9) ─────
# Emitted by the request middleware for EVERY request. ``plane`` is "shared" for
# normal control-plane traffic and "tenant" when the request hit a BYOD tenant DB;
# ``status_class`` is 2xx/4xx/5xx — these are the numerator/denominator of the
# shared-plane error-rate regression gate and the dashboard latency panels.

@_safe
def http_request(route: str, status_class: str, plane: str, company_id: str) -> None:
    _M["sapybase_http_requests_total"].labels(
        route=route, status_class=status_class, plane=plane, company_id=str(company_id)
    ).inc()


@_safe
def observe_http_duration(route: str, plane: str, company_id: str, seconds: float) -> None:
    _M["sapybase_http_request_duration_seconds"].labels(
        route=route, plane=plane, company_id=str(company_id)
    ).observe(seconds)


# ── Per-tenant DB health / isolation ─────────────────────────────────────────

@_safe
def breaker_state(company_id: str, state_value: int) -> None:
    """0=closed, 1=open, 2=half-open (matches the catalog gauge encoding)."""
    _M["byod_tenant_circuit_breaker_state"].labels(company_id=str(company_id)).set(state_value)


@_safe
def db_error(company_id: str, kind: str) -> None:
    _M["byod_tenant_db_errors_total"].labels(company_id=str(company_id), kind=kind).inc()


@_safe
def observe_query_duration(company_id: str, seconds: float) -> None:
    _M["byod_tenant_query_duration_seconds"].labels(company_id=str(company_id)).observe(seconds)


@_safe
def pool_saturation(company_id: str, in_use: int, size: int) -> None:
    _M["byod_tenant_pool_connections_in_use"].labels(company_id=str(company_id)).set(in_use)
    _M["byod_tenant_pool_size"].labels(company_id=str(company_id)).set(size)


# ── Global ceiling (E7 / §16.3) ──────────────────────────────────────────────

@_safe
def global_in_flight(n: int) -> None:
    _M["byod_global_connections_in_flight"].set(n)


@_safe
def ceiling_rejection() -> None:
    _M["byod_global_connection_ceiling_rejections_total"].inc()


# ── Routing integrity (E5 — pages on any occurrence) ─────────────────────────

@_safe
def routing_violation(company_id: str) -> None:
    _M["byod_routing_integrity_violations_total"].labels(company_id=str(company_id)).inc()


# ── KMS / decrypted-DSN cache (§16.5) ────────────────────────────────────────

@_safe
def kms_decrypt_error(company_id: str, outcome: str) -> None:
    """outcome = served_cached | cold_fail."""
    _M["byod_kms_decrypt_errors_total"].labels(company_id=str(company_id), outcome=outcome).inc()


@_safe
def dsn_cache_serve(mode: str) -> None:
    """mode = fresh | stale."""
    _M["byod_dsn_cache_serves_total"].labels(mode=mode).inc()


# ── Schema version gate (§8.2 / §16.9) ───────────────────────────────────────

@_safe
def schema_gate(company_id: str, decision: str) -> None:
    """decision = met | blocked."""
    _M["byod_tenant_schema_gate_total"].labels(company_id=str(company_id), decision=decision).inc()


@_safe
def schema_version(company_id: str, version_value: float) -> None:
    _M["byod_tenant_schema_version"].labels(company_id=str(company_id)).set(version_value)


# ── Metering idempotency (E1) ────────────────────────────────────────────────

@_safe
def idempotent_replay(company_id: str) -> None:
    _M["byod_metering_idempotent_replays_total"].labels(company_id=str(company_id)).inc()


# ── Wrong-dimension vectors (§16.9) ──────────────────────────────────────────
# NOTE: no runtime caller yet — wrong-dimension rows are prevented structurally by
# the provisioning-time ``vector(N)`` column type, and the retrieval path reads only
# (content, url), never the embedding. This stays a defensive contract metric; a
# true runtime detector would require reading embeddings on the hot path.

@_safe
def vector_dimension_mismatch(company_id: str) -> None:
    _M["byod_tenant_vector_dimension_mismatch_total"].labels(company_id=str(company_id)).inc()


# ── /metrics endpoint plumbing ───────────────────────────────────────────────

def enabled() -> bool:
    return _ENABLED


def render() -> bytes:
    """Prometheus exposition text (empty if disabled).

    Under multiprocess mode (PROMETHEUS_MULTIPROC_DIR set) the scrape must aggregate
    every worker's mmap files via a fresh MultiProcessCollector registry — the default
    registry would only report the worker that happened to serve the scrape."""
    if not _ENABLED:
        return b""
    if _MULTIPROC_DIR:
        from prometheus_client import CollectorRegistry, multiprocess

        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry, path=_MULTIPROC_DIR)
        return generate_latest(registry)
    return generate_latest()


def content_type() -> str:
    return CONTENT_TYPE_LATEST
