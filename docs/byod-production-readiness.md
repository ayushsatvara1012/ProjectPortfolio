# BYOD — Production Readiness & Go-Live Plan

**Owner:** _(assign)_   **Status as of 2026-06-17:** GA gate passed; both launch blockers fixed (uncommitted). **Not yet enabled for any paying client.**
**Source of truth:** [RFC](rfc-byod.md) · [Runbook](runbooks/byod_runbook.md) · [Alerts](../sapybase_ai_engine/observability/alerts/byod_alerts.yml) · SLOs (`sapybase_ai_engine/observability/slo.py`)

This plan covers everything between "code complete" and "enable `byo_database` for the first paying client." Treat each unchecked box as a gate.

---

## 0. Where we are

- [x] Phases 0–8 complete; GA gate test suite green (engine-regression **908 passed / 94 skipped**; full BYOD suite on PG **414 passed**).
- [x] **Blocker 1 — GDPR erasure** fixed (control-plane names corrected; BYOD = offboard-only; client DB untouched). Tests: `tests/byod/test_byod_gdpr.py`.
- [x] **Blocker 2 — observability live** (`observability/metrics.py` + `GET /metrics`; §16.9 metrics emitted at chokepoints). Tests: `tests/byod/test_byod_metrics.py`.
- [ ] These fixes **committed** (currently uncommitted on `byo-feature`).

> Safe-by-default: BYOD stays off until `BYOD_ENABLED=true` **and** the tenant is in `BYOD_CANARY_COMPANY_IDS`. Nothing below is live until both are set.

---

## 1. Code — remaining fixes

| # | Item | Severity | Acceptance |
|---|---|---|---|
| 1.1 | **Re-train prune (additive-only today).** Re-training a changed source appends + dedups but never deletes superseded chunks on the tenant DB → answer quality drift + `max_chunks` quota creep. | Medium (pre-scale, not pre-pilot) | Re-train replaces/prunes stale chunks for a source on the tenant DB; test proves count stays bounded after N re-trains of changed content. |
| 1.2 | **Generic `sapybase_http_requests_total` shared-plane metric** not emitted (dashboard error-rate panels are blank). Not a §16.9 alert input. | Low | Request middleware emits the counter+duration with `plane`/`status_class`/`company_id`; dashboard error-rate panels populate. |
| 1.3 | **`byod_tenant_vector_dimension_mismatch_total`** has no runtime emitter (structurally prevented by `vector(N)` column type; read path never loads embeddings). | Accepted / defensive-only | Decision recorded: keep as defensive contract metric, OR add an explicit dimension check if a real detection need appears. |

---

## 2. Configuration & deployment

| # | Item | Severity | Acceptance |
|---|---|---|---|
| 2.1 | **`/metrics` under multiple workers.** `prometheus_client` default registry is **per-process** — with multiple Uvicorn/Gunicorn workers a scrape hits one random worker → wrong/jumpy counts. | **Blocker for accurate alerting** | Either run the scraped process single-worker, or enable multiprocess mode (`PROMETHEUS_MULTIPROC_DIR` + `prometheus_client.multiprocess` collector). Verify `/metrics` aggregates across workers. |
| 2.2 | **Protect `/metrics`.** It is not auth-gated in-app. | Blocker | Restrict at ingress/network (internal-only / scrape-allowlist). Confirm it is not publicly reachable. |
| 2.3 | **Fixed egress IP / NAT** (RFC §5.6) so clients can allowlist Sapybase. | Blocker (per client) | Egress IP pinned + documented; included in client onboarding instructions. |
| 2.4 | **KMS env configured in prod** (`BYOD_KMS_MASTER_KEYS`, `BYOD_KMS_ACTIVE_KEY_ID`). Engine fails closed without it. | Blocker | Keys present in prod secrets; a provision/decrypt smoke test succeeds. |
| 2.5 | **Switch-in 7-day purge cron scheduled** (`POST /api/internal/run-switchin-purge`, `CRON_SECRET`). If unscheduled, migrated clients' data lingers on the shared DB past the promised window. | Blocker (privacy promise) | Cron exists in the deploy scheduler; a dry-run shows it purges only past-window copies. |
| 2.6 | **Data-plane migration cron** (`POST /api/internal/run-data-plane-migrations`) scheduled (for future schema rollouts; no-op today). | Low | Scheduled; first run reports all tenants current. |
| 2.7 | **Pool / breaker / cache tunables** reviewed for prod (`BYOD_POOL_*`, `BYOD_DSN_CACHE_*`, batch concurrency). | Medium | Values set deliberately for the expected fleet size (not defaults by accident). |

---

## 3. Observability & alerting wiring

| # | Item | Severity | Acceptance |
|---|---|---|---|
| 3.1 | **Load `byod_alerts.yml` into the real Prometheus** and confirm every rule parses + evaluates (exprs are unit-checked against the catalog, not yet run in Prometheus). | Blocker | Rules load with no errors; a synthetic signal fires the expected alert. |
| 3.2 | **Alertmanager paging routes** for the three `page`-severity alerts (KMS / global-ceiling / routing-mismatch). | Blocker | A test fire of each `page` alert reaches the on-call pager. `ticket`/`info` route to the queue. |
| 3.3 | **Import the Grafana dashboard** (`observability/dashboards/byod_slo_dashboard.json`) and confirm panels bind to live metrics. | Medium | Dashboard renders with real data for a canary tenant. |
| 3.4 | **Capture a real SLO baseline** (`scripts/capture_slo_baseline.py --from <metrics_export>`) once live metrics exist, replacing the ceiling placeholders. | Medium | `baseline.json` reflects measured shared-plane numbers; `--check` wired into CI/release. |

---

## 4. Testing & validation (beyond the unit/integration suites)

| # | Item | Severity | Acceptance |
|---|---|---|---|
| 4.1 | **Canary dry-run with one internal / non-paying tenant** — real DSN, real KMS, real Prometheus scrape. Exercise: onboard → provision → chat (RAG) → analytics → background digest → switch-out. | **Blocker** | Full lifecycle works end-to-end against a real remote DB; metrics + alerts observed; no error-rate regression vs baseline. |
| 4.2 | **Failure-injection on the canary:** kill the tenant DB (breaker opens + isolates), make it read-only (chat_log degrades), rotate its password (→ NEEDS_RECONNECT), simulate a KMS blip (serve-from-cache). | Blocker | Each degrades + recovers per the runbook; the matching alert fires; shared fleet stays green. |
| 4.3 | **Shared-fleet regression check** — error rate at/below Phase-0 baseline with BYOD enabled for the canary. | Blocker (GA criterion) | `evaluate_regression(plane="shared")` OK with live numbers. |
| 4.4 | **GDPR erasure rehearsal** on the canary (offboard-only): account delete removes control-plane footprint + stops connecting; client DB confirmed untouched. | High | Verified on a real BYOD tenant. |
| 4.5 | **Load/perf sanity** of the new metric emission on the hot path (per-`company_id` label cardinality acceptable at expected tenant count). | Medium | No measurable latency regression; cardinality within Prometheus budget. |
| 4.6 | **Exhaustive review pass** — the audit was risk-prioritized, not line-by-line across all 21 BYOD modules. Consider `/code-review` or a focused second read before GA. | Medium | Reviewed; no new blockers. |

---

## 5. Go-live gates (sign-off)

- [ ] All §1 (code) blockers/medium-as-decided closed.
- [ ] All §2 (config) blockers closed.
- [ ] §3 alerting wired; §3.1 + §3.2 verified by test fire.
- [ ] §4.1–§4.4 canary validation passed.
- [ ] **On-call sign-off** recorded in [byod_runbook.md](runbooks/byod_runbook.md) (paging routes confirmed).
- [ ] Commercial: contract/DPA covers BYOD data handling; client given egress IP + min Postgres/pgvector requirements (≥ 0.5.0).
- [ ] **Enable:** set `BYOD_ENABLED=true` + add the client's `company_id` to `BYOD_CANARY_COMPANY_IDS`. Monitor closely for the first billing cycle.
- [ ] **Rollback rehearsed:** removing the tenant from the canary allowlist (or `BYOD_ENABLED=false`) reverts to the dark/shared path with no data change.

---

## Quick triage: what's actually blocking a first paying client

**Must-do (blockers):** 2.1 metrics multiproc · 2.2 protect /metrics · 2.3 egress IP · 2.4 KMS env · 2.5 purge cron · 3.1 alerts in Prometheus · 3.2 paging · 4.1–4.3 canary + regression · §5 sign-off.
**Can follow (not blocking a careful pilot):** 1.1 re-train prune · 1.2 http SLO metric · 3.3/3.4 dashboard+baseline polish · 4.5/4.6 perf+exhaustive review.
