# BYOD — Production Readiness & Go-Live Plan

**Owner:** _(assign)_   **Status as of 2026-06-18:** GA gate passed; both launch blockers fixed, committed + pushed (`74955beb`). Code items §1.1 (re-train prune) + §1.2 (http request metrics) done + tested locally (uncommitted). **Not yet enabled for any paying client.**
**Source of truth:** [RFC](rfc-byod.md) · [Runbook](runbooks/byod_runbook.md) · [Alerts](../sapybase_ai_engine/observability/alerts/byod_alerts.yml) · SLOs (`sapybase_ai_engine/observability/slo.py`)

This plan covers everything between "code complete" and "enable `byo_database` for the first paying client." Treat each unchecked box as a gate.

---

## 0. Where we are

- [x] Phases 0–8 complete; GA gate test suite green (engine-regression **908 passed / 94 skipped**; full BYOD suite on PG **414 passed**).
- [x] **Blocker 1 — GDPR erasure** fixed (control-plane names corrected; BYOD = offboard-only; client DB untouched). Tests: `tests/byod/test_byod_gdpr.py`.
- [x] **Blocker 2 — observability live** (`observability/metrics.py` + `GET /metrics`; §16.9 metrics emitted at chokepoints). Tests: `tests/byod/test_byod_metrics.py`.
- [x] These fixes **committed + pushed** on `byo-feature` (`74955beb`).

> Safe-by-default: BYOD stays off until `BYOD_ENABLED=true` **and** the tenant is in `BYOD_CANARY_COMPANY_IDS`. Nothing below is live until both are set.

---

## 1. Code — remaining fixes

| # | Item | Severity | Acceptance |
|---|---|---|---|
| 1.1 | ✅ **DONE (uncommitted).** Re-train now prunes superseded chunks for a source on the tenant DB on a *complete* run (disabled on quota/cost-capped runs to protect the un-ingested tail); orphaned parents removed too. `byod_ingest.plan_prune` + `IngestResult.pruned`. Tests prove the count stays bounded after N re-trains of changed content (`test_byod_ingest.py`, verified on real PG). | Medium (pre-scale, not pre-pilot) | ✅ Met. |
| 1.2 | ✅ **DONE (uncommitted).** Pure-ASGI `RequestMetricsMiddleware` emits `sapybase_http_requests_total` + `_request_duration_seconds` for every request with `route`/`status_class`/`plane`/`company_id`; chat hot path tags tenant traffic via `request.state`. (Pure ASGI on purpose — `BaseHTTPMiddleware` runs the endpoint in a child task and would not see the tag.) Tests in `test_byod_metrics.py`. | Low | ✅ Met. |
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
| 2.7 | **Pool / breaker / cache tunables** reviewed for prod (`BYOD_POOL_*`, `BYOD_DSN_CACHE_*`, batch concurrency). | Medium | ✅ **Reviewed (early-pilot, ≤10 tenants, gunicorn -w 4).** Defaults kept deliberately; `BYOD_POOL_PER_TENANT_MAX=3` and `BYOD_POOL_GLOBAL_CEILING=100` set explicitly on Render to pin fleet sizing. **Key fact:** pools are per-worker, so effective per-tenant max = 3×4 = **12 conns/tenant** and global = 100×4 = 400; revisit before raising worker count or fleet size. DSN cache: TTL 300s / max-stale 3600s (KMS-blip ride-through) / 1024 entries. Breaker: 5 fails→open, 30s cooldown (code default, not env-tunable). |

---

## 3. Observability & alerting wiring

| # | Item | Severity | Acceptance |
|---|---|---|---|
| 3.1 | **Load `byod_alerts.yml` into the real Prometheus** and confirm every rule parses + evaluates (exprs are unit-checked against the catalog, not yet run in Prometheus). | Blocker | Rules load with no errors; a synthetic signal fires the expected alert. |
| 3.2 | ✅ **DONE.** **Alertmanager paging routes** loaded LIVE to the Grafana Cloud Mimir Alertmanager (`mimirtool alertmanager load`, AM tenant `--id=1656651` — the Alertmanager datasource's basic-auth User, *not* the metrics id `3317422`; that mismatch was the earlier 401). Config read back + confirmed. **Route + end-to-end delivery verified by synthetic test fire:** a `severity=page,feature=byod` alert POSTed to `/alertmanager/api/v2/alerts` registered `active`, routed to receiver `byod-pager` (verified via `/alerts/groups`, not the queue), and the `[PAGE] BYOD BYODKmsDecryptErrors` email **landed in the pager inbox** (SMTP→Resend→inbox confirmed). All three page alerts match on the same two labels (not alertname), so one fire validates all three. Runbook: [`alerts/README.md`](../sapybase_ai_engine/observability/alerts/README.md). | Blocker | A test fire of each `page` alert reaches the on-call pager. `ticket`/`info` route to the queue. |
| 3.3 | **Import the Grafana dashboard** (`observability/dashboards/byod_slo_dashboard.json`) and confirm panels bind to live metrics. | Medium | Dashboard renders with real data for a canary tenant. |
| 3.4 | **Capture a real SLO baseline** (`scripts/capture_slo_baseline.py --from <metrics_export>`) once live metrics exist, replacing the ceiling placeholders. | Medium | `baseline.json` reflects measured shared-plane numbers; `--check` wired into CI/release. |

---

## 4. Testing & validation (beyond the unit/integration suites)

> **Executable runbook for §4.1–§4.3:** [`runbooks/byod_canary_dryrun.md`](runbooks/byod_canary_dryrun.md) — onboarding curls (enroll → connection → provision → switch-in → health), the flag flip, the lifecycle checklist, the four-row failure-injection matrix, and the shared-fleet regression gate. Needs a throwaway tenant Postgres (pgvector ≥ 0.5.0) reachable from the Render egress IPs.

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
- [x] §3 alerting wired; §3.1 + §3.2 verified by test fire. _(3.1 rules in Mimir ruler; 3.2 AM paging route + page email delivered. 3.3/3.4 dashboard+baseline are non-blocking polish.)_
- [ ] §4.1–§4.4 canary validation passed.
- [ ] **On-call sign-off** recorded in [byod_runbook.md](runbooks/byod_runbook.md) (paging routes confirmed).
- [ ] Commercial: contract/DPA covers BYOD data handling; client given egress IP + min Postgres/pgvector requirements (≥ 0.5.0).
- [ ] **Enable:** set `BYOD_ENABLED=true` + add the client's `company_id` to `BYOD_CANARY_COMPANY_IDS`. Monitor closely for the first billing cycle.
- [ ] **Rollback rehearsed:** removing the tenant from the canary allowlist (or `BYOD_ENABLED=false`) reverts to the dark/shared path with no data change.

---

## Quick triage: what's actually blocking a first paying client

**Must-do (blockers):** ~~2.1 metrics multiproc~~ ✅ · ~~2.2 protect /metrics~~ ✅ · ~~2.3 egress IP~~ ✅ · ~~2.4 KMS env~~ ✅ · ~~2.5 purge cron~~ ✅ · ~~3.1 alerts in Prometheus~~ ✅ · ~~3.2 paging~~ ✅ · 4.1–4.3 canary + regression · §5 sign-off.
**Can follow (not blocking a careful pilot):** ~~1.1 re-train prune~~ ✅ · ~~1.2 http SLO metric~~ ✅ · 3.3/3.4 dashboard+baseline polish · 4.5/4.6 perf+exhaustive review.
