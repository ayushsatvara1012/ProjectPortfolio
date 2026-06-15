# BYOD observability (RFC Phase 0.3)

Error-rate / latency **SLOs as code**, a **dashboard as code**, and a captured
**baseline** so later BYOD phases can *prove* they did not regress the shared
fleet (RFC §13).

## Files

| File | Purpose |
|---|---|
| [`slo.py`](slo.py) | Single source of truth: SLO targets (shared + per-tenant) and the metric catalog. Pure data + the `evaluate_regression()` comparison. |
| [`dashboards/byod_slo_dashboard.json`](dashboards/byod_slo_dashboard.json) | Grafana dashboard. Shared-plane row (the regression gate) + per-tenant row (templated by `$company_id`). Every panel references a metric from the catalog. |
| [`baseline.json`](baseline.json) | Captured baseline artifact: SLO snapshot + shared/tenant measurements + git commit + timestamp. |
| [`../scripts/capture_slo_baseline.py`](../scripts/capture_slo_baseline.py) | Generates/refreshes `baseline.json`; `--check` compares current measurements and exits non-zero on regression. |

## Two planes

- **shared** — the existing shared-DB fleet. `error_rate_max = 0.5%`,
  `p95 <= 1500ms`. This SLO is the **hard gate** every later phase must not
  regress.
- **tenant** — each BYOD tenant's own remote DB path plus isolation signals
  (circuit breaker, per-tenant pool). A slow/broken tenant DB must stay isolated.

## Capturing & checking the baseline

```bash
# Capture (defaults measurements to the SLO ceilings until a metrics pipeline feeds real numbers)
python scripts/capture_slo_baseline.py
python scripts/capture_slo_baseline.py --from metrics_export.json   # real numbers

# Later phases: fail the build if the shared fleet regressed
python scripts/capture_slo_baseline.py --check current_measurements.json
```

A measurements file is JSON:

```json
{"shared": {"error_rate": 0.003, "latency_p95_ms": 900, "latency_p99_ms": 1800}}
```

## Status (Phase 0)

Nothing emits these metrics yet — Phase 0 ships **dark** (see
[`../byod_flags.py`](../byod_flags.py)). This phase fixes the SLO contract, the
metric names/labels, the dashboard, and the baseline so instrumentation added in
Phases 1–8 has a target and a regression gate to check against. Once a metrics
pipeline (e.g. Prometheus) exists, re-run the capture with `--from` to replace
the ceiling placeholders with measured numbers, and import the dashboard JSON
into Grafana.
