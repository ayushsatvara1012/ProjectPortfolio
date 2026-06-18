# BYOD observability (RFC Phase 0.3)

Error-rate / latency **SLOs as code**, a **dashboard as code**, and a captured
**baseline** so later BYOD phases can *prove* they did not regress the shared
fleet (RFC §13).

## Files

| File | Purpose |
|---|---|
| [`slo.py`](slo.py) | Single source of truth: SLO targets (shared + per-tenant), the metric catalog, the §16.9 `EXCEPTIONAL_STATES` matrix, `ALERTS` (alerts-as-code), and `OPERATIONAL_RUNBOOKS`. Pure data + `evaluate_regression()` / `exceptional_state_coverage()` / `render_prometheus_rules()`. |
| [`metrics.py`](metrics.py) | Live emission façade — builds one Prometheus collector per `METRIC_CATALOG` entry and emits at the engine chokepoints (`byod_pool`/`byod_engine`/`byod_metering`). Exposed via `GET /metrics`. Fail-soft + no-op if `prometheus_client` is absent. |
| [`dashboards/byod_slo_dashboard.json`](dashboards/byod_slo_dashboard.json) | Grafana dashboard. Shared-plane row (the regression gate) + per-tenant row (templated by `$company_id`). Every panel references a metric from the catalog. |
| [`alerts/byod_alerts.yml`](alerts/byod_alerts.yml) | Prometheus alerting rules, **generated** from `slo.ALERTS` via `render_prometheus_rules()`. One alert per §16.9 state; every `runbook_url` links into the runbook doc. Drift-checked by `tests/byod/test_byod_runbooks.py`. |
| [`baseline.json`](baseline.json) | Captured baseline artifact: SLO snapshot + shared/tenant measurements + git commit + timestamp. |
| [`../scripts/capture_slo_baseline.py`](../scripts/capture_slo_baseline.py) | Generates/refreshes `baseline.json`; `--check` compares current measurements and exits non-zero on regression. |

## §16.9 exceptional-state coverage (Phase 8.4 GA gate)

Every RFC §16.9 exceptional state is bound — in `slo.EXCEPTIONAL_STATES` — to a
detection metric (in `METRIC_CATALOG`), an alert (in `ALERTS` → `alerts/byod_alerts.yml`),
and a runbook section in [`../../docs/runbooks/byod_runbook.md`](../../docs/runbooks/byod_runbook.md).
The gate test `tests/byod/test_byod_runbooks.py` fails if any state loses any of the
three, if the matrix drifts from the RFC, or if the alerts file goes stale.

```bash
# Regenerate the alert rules after editing slo.ALERTS:
python -c "import json,observability.slo as s; \
  open('observability/alerts/byod_alerts.yml','w').write(json.dumps(s.render_prometheus_rules(),indent=2,sort_keys=True))"
```

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
