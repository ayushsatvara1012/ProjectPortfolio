# BYOD Operations Runbook

**Audience:** On-call engineers operating the BYOD (Build-Your-Own-Database) feature.
**Scope:** Every RFC §16.9 exceptional state + the RFC §11 operational runbooks.
**Source of truth:** `sapybase_ai_engine/observability/slo.py` (`METRIC_CATALOG`,
`EXCEPTIONAL_STATES`, `ALERTS`, `OPERATIONAL_RUNBOOKS`). Alerts are generated to
`sapybase_ai_engine/observability/alerts/byod_alerts.yml`. The Phase-8.4 gate test
`tests/byod/test_byod_runbooks.py` fails if any §16.9 state loses its detection
metric, alert, or the runbook section below.

> **Status (Phase 8.4):** the detection metrics ship **dark** — the names, labels,
> alerts and runbooks are the contract; wiring emitters into the request path is an
> operational follow-up (same posture as the Phase-0 observability scaffold). The
> "where it's detected in code" line in each section tells you the code path that
> *already* enforces the behavior today, so on-call can act before emitters land.

---

## Two planes (recap)

- **shared** — the existing shared-DB fleet. Its error-rate / latency SLO is the
  hard regression gate (`error_rate <= 0.5%`, `p95 <= 1500ms`).
- **tenant** — each BYOD tenant's own remote DB. A single slow/broken tenant must
  stay isolated (breaker + bounded pool + bulkhead); it must never degrade the
  shared fleet or another tenant.

Dashboard: `observability/dashboards/byod_slo_dashboard.json` (Grafana, templated
by `$company_id`). Alerts: `observability/alerts/byod_alerts.yml`.

---

# §16.9 Exceptional-state runbooks

Each state below maps 1:1 to a row of the RFC §16.9 matrix and to one
`EXCEPTIONAL_STATES` entry. The anchor id is what the alert's `runbook_url` links to.

<a id="tenant-db-read-only"></a>
## Tenant DB read-only / in recovery

- **Alert:** `BYODTenantWriteDegraded` (ticket) — `byod_tenant_db_errors_total{kind="readonly"}` rising.
- **Detection metric:** `byod_tenant_db_errors_total`.
- **Engine behavior (automatic):** serves the answer; **skips/queues the `chat_log` write** (degraded) rather than failing the request.
- **Where it's detected in code:** `byod_engine.tenant_log_chat` returns `False` and warns (sanitized) instead of raising; the chat reply path is unaffected.

**Diagnose**
1. Confirm it's the tenant's DB, not ours: the alert is per `company_id`; the shared plane should be green.
2. Common causes: the client put their DB into recovery/standby, hit disk-full, or a failover left a read-only replica as primary.

**Remediate**
1. The product stays up (answers served); only analytics writes (`chat_logs`) are dropped for that tenant. No emergency action required short-term.
2. Notify the customer their DB is rejecting writes (read-only / in recovery); ask them to restore a writable primary.
3. Once writable, the degradation clears on the next request automatically. There is **no backfill** of the dropped `chat_logs` rows (accepted §16.9 trade-off) — note it if the customer asks why a window of analytics is thin.
4. If writes keep failing and the breaker trips, follow [breaker-open](#breaker-open).

---

<a id="wrong-dimension-vectors"></a>
## Wrong-dimension vectors

- **Alert:** `BYODTenantVectorDimensionMismatch` (ticket) — any increase in `byod_tenant_vector_dimension_mismatch_total`.
- **Detection metric:** `byod_tenant_vector_dimension_mismatch_total`.
- **Engine behavior (automatic):** rows whose embedding dimension ≠ the engine's `EMBEDDING_DIMENSIONS` are **skipped** on read; the tenant is marked unhealthy. Retrieval falls back to whatever valid rows exist (or the bot's fallback protocol).
- **Where it's detected in code:** `byod_engine.validate_knowledge_rows` (E3) drops malformed/oversized/wrong-shape rows; provisioning (`byod_probe`) locks the column to `vector(EMBEDDING_DIMENSIONS)`.

**Diagnose**
1. A correctly provisioned BYOD DB cannot get wrong-dimension rows through our writers — the column type is fixed at provisioning. A mismatch means **rows were written out-of-band** (the client inserted into `company_knowledge` directly) or the embedding model dimension changed.
2. Check `embedding_config.EMBEDDING_DIMENSIONS` vs the tenant column: `SELECT atttypmod FROM pg_attribute WHERE attrelid='company_knowledge'::regclass AND attname='embedding';`

**Remediate**
1. If the client wrote rows directly: tell them only Sapybase-ingested rows are supported; the offending rows are skipped (no crash) until removed/re-ingested.
2. If the engine embedding dimension changed: that's a migration event — the tenant must be re-ingested. Escalate to engineering; do **not** hand-edit tenant data.
3. Skipped rows are safe to leave; they just don't participate in retrieval.

---

<a id="breaker-open"></a>
## Breaker open (repeated failures)

- **Alert:** `BYODTenantBreakerOpen` (ticket) — `byod_tenant_circuit_breaker_state == 1` for >5m.
- **Detection metric:** `byod_tenant_circuit_breaker_state` (0=closed, 1=open, 2=half-open).
- **Engine behavior (automatic):** that tenant **fast-fails** ("temporarily unavailable") without consuming a global ceiling slot; other tenants are unaffected (isolation). The breaker auto-probes (HALF_OPEN) after the cooldown and re-closes on success.
- **Where it's detected in code:** `byod_breaker.CircuitBreaker` / `byod_engine.tenant_breaker_open`; the pool calls `before_request()` first.

**Diagnose**
1. Per-tenant only. If many tenants' breakers open at once, suspect **us** (KMS, network egress, global ceiling) — jump to [kms-unavailable](#kms-unavailable) or [global-ceiling](#global-ceiling).
2. Single tenant: their DB is down, unreachable, timing out, or auth is failing. Check `byod_tenant_db_errors_total{company_id=...,kind}` for the failure class.

**Remediate**
1. Let the breaker do its job — it will recover automatically once the tenant DB is healthy (HALF_OPEN → CLOSED).
2. If auth is the cause (`kind=connect`, password rotated), follow [credential-rotation](#credential-rotation) — the tenant likely needs a NEEDS_RECONNECT.
3. If the DB is simply down, follow [tenant-db-outage](#tenant-db-outage).
4. Do not force-close the breaker manually; that just re-floods a sick DB. If you must, restart is the supported reset (state is in-process).

---

<a id="schema-drift"></a>
## Schema ahead/behind engine

- **Alert:** `BYODTenantSchemaGateBlocked` (ticket) — `byod_tenant_schema_gate_total{decision="blocked"}` rising for >15m.
- **Detection metrics:** `byod_tenant_schema_gate_total`, `byod_tenant_schema_version`.
- **Engine behavior (automatic):** features that need a newer column are **version-gated off** for behind tenants; the engine reads the old shape and **never throws**. A tenant *ahead* of the engine is fine (extra columns ignored).
- **Where it's detected in code:** `byod_schema.version_meets` (fail-closed to old shape) + `byod_engine.tenant_supports_version`.

**Diagnose**
1. A blocked gate means a tenant is behind the engine's target data-plane schema version (a migration is owed), not an error.
2. Check the registry version: it's in `byod_tenant_databases.schema_version` (control plane) and surfaced as `byod_tenant_schema_version`.

**Remediate**
1. Run the data-plane migration rollout: `POST /api/internal/run-data-plane-migrations` (CRON_SECRET). The orchestrator is advisory-locked, idempotent, and isolates unreachable tenants.
2. If a specific tenant won't advance, it's usually unreachable/contended — see the rollout report's `failed`/`contended` counts and follow [stuck-migration](#stuck-migration).
3. No customer-facing impact while gated (feature simply unavailable until migrated); prioritize but don't page.

---

<a id="kms-unavailable"></a>
## KMS unavailable

- **Alert:** `BYODKmsDecryptErrors` (**page**) — any `byod_kms_decrypt_errors_total` over 5m.
- **Detection metrics:** `byod_kms_decrypt_errors_total` (outcome=`served_cached`|`cold_fail`), `byod_dsn_cache_serves_total` (mode=`fresh`|`stale`).
- **Engine behavior (automatic):** decrypted DSNs are served from the in-memory cache (`byod_dsn_cache`), so **warm tenants keep working** through a KMS blip. Only a **cold** tenant (never decrypted, or past `max_stale_seconds`) fails — and **only that tenant**.
- **Where it's detected in code:** `byod_engine._resolve_runtime_dsn` (`get_fresh` → KMS → `get_stale` fallback); `byod_dsn_cache.DecryptedDsnCache`.

**Diagnose**
1. This is a **shared dependency** — `outcome=served_cached` rising on many tenants confirms KMS, not a tenant.
2. Check the KMS provider health / `BYOD_KMS_*` config. `outcome=cold_fail` tells you which tenants are actually down (cold).

**Remediate**
1. **Restore KMS** — that's the fix. Warm tenants are unaffected; recovery is automatic on the next successful decrypt (cache refills).
2. Stretch the outage budget if needed: raise `BYOD_DSN_CACHE_MAX_STALE_SECONDS` (default 3600) to keep serving stale-but-valid DSNs longer while you fix KMS. (DSNs are still re-validated on every connect — rule 8 — so this is safe.)
3. Do **not** roll keys or re-provision during the outage; cold tenants recover automatically once KMS is back.
4. If KMS is permanently degraded, escalate to security/infra — this is a Critical-tier dependency (RFC §12).

---

<a id="global-ceiling"></a>
## Global ceiling reached

- **Alert:** `BYODGlobalCeilingReached` (**page**) — any `byod_global_connection_ceiling_rejections_total` over 5m.
- **Detection metrics:** `byod_global_connection_ceiling_rejections_total`, `byod_global_connections_in_flight`.
- **Engine behavior (automatic):** acquisitions beyond the fleet ceiling get a **bounded wait → 503 retry-after** with fair scheduling; no tenant can monopolize the pool, and a busy pool is never evicted mid-query.
- **Where it's detected in code:** `byod_pool.TenantPoolRegistry` global ceiling (`CeilingExceeded` → 503), E7/§16.3.

**Diagnose**
1. Watch `byod_global_connections_in_flight` vs the configured `BYOD_POOL_GLOBAL_CEILING`. Sustained pinned-at-ceiling = capacity, not a bug.
2. Identify a noisy neighbor: high `byod_tenant_pool_connections_in_use` for one `company_id`, or many slow tenants holding connections (check `byod_tenant_query_duration_seconds`).

**Remediate**
1. A noisy/slow tenant holding connections: their breaker should trip and free slots — confirm via [breaker-open](#breaker-open). The per-tenant bulkhead caps any single tenant.
2. Genuine fleet growth: raise `BYOD_POOL_GLOBAL_CEILING` (and per-tenant caps if needed), or scale out engine replicas (the ceiling is per-process; horizontal scale multiplies capacity — RFC §7.5).
3. 503s are the designed backpressure (clients retry-after); they are not data loss. Communicate only if sustained.

---

<a id="idempotency-replay"></a>
## Idempotency-key replay

- **Alert:** `BYODMeteringReplaySpike` (info) — `byod_metering_idempotent_replays_total` rate > 0.5/s for >15m.
- **Detection metric:** `byod_metering_idempotent_replays_total`.
- **Engine behavior (automatic):** a replayed idempotency key is a **no-op** — no double meter, no duplicate row. The dedup is the safety mechanism, so this is **benign by design**.
- **Where it's detected in code:** `byod_metering.record_message_and_meter` (`ON CONFLICT DO NOTHING` on `(company_id, idempotency_key)`, E1/E2).

**Diagnose**
1. This alert is informational — it means dedup is *working*, but an elevated rate hints at a retry storm or a client double-submitting.
2. Cross-check: is there a 5xx/timeout spike on the chat path causing client retries? Is one `company_id` dominating?

**Remediate**
1. No data-integrity action needed — counts are correct (that's the whole point of the ledger).
2. If the rate is from upstream retries, fix the retry source (timeouts, client backoff). The reconciler (`byod_metering.reconcile_company`) repairs any store/meter drift idempotently if you suspect a counter lag.

---

<a id="routing-mismatch"></a>
## Routing / company mismatch

- **Alert:** `BYODRoutingIntegrityViolation` (**page**, fire-on-any) — any increase in `byod_routing_integrity_violations_total`.
- **Detection metric:** `byod_routing_integrity_violations_total`.
- **Engine behavior (automatic):** the query is **aborted** — a connection whose `company_id` tag doesn't match the requested tenant is never used to serve data (no cross-tenant leakage).
- **Where it's detected in code:** `byod_pool` WeakKeyDictionary conn-tag + `assert_tenant` → `RoutingIntegrityError` (E5).

**Diagnose**
1. **This should be impossible in normal operation.** Any non-zero value is a potential cross-tenant data-isolation event — treat as a security incident.
2. Capture the `company_id`(s), deploy/version, and recent changes to pool/registry code. Do not dismiss as flaky.

**Remediate**
1. **Page security/engineering immediately.** The abort prevented leakage *this time*, but a violation means the routing invariant was challenged.
2. Consider disabling BYOD routing for the affected tenant(s) via the canary allowlist (`BYOD_CANARY_COMPANY_IDS`) until root-caused — see [emergency-disconnect](#emergency-disconnect).
3. Preserve logs; root-cause before re-enabling. This maps to the §12 "cross-tenant" risk — the highest-severity isolation failure.

---

# §11 Operational runbooks

<a id="onboarding-failure"></a>
## Onboarding failure

A `POST /api/admin/users/{clerk_id}/byod/provision` left the tenant in `ERROR` (or `test`/`health` failed).

1. **Read the status:** `GET /api/admin/users/{clerk_id}/byod` → `status`, `provisioned`, `is_live`, `schema_version`. Provisioning is fail-soft: a failure leaves **no partial state** (no runtime DSN stored, no version recorded).
2. **Re-run the failing step** (all idempotent, advisory-locked per tenant):
   - DSN rejected (400) → the connection string failed `validate_db_url` (SSRF/TLS/param allowlist). Fix the DSN (must be `postgres(ql)://`, `sslmode in {require,verify-ca,verify-full}`, public host). Re-`PUT .../byod/connection`.
   - Probe 502/422 → DB unreachable, no `pgvector`, or pgvector too old (< 0.5.0 HNSW floor). Customer must install/upgrade `vector`.
   - Health 502 → schema/role applied but the runtime role can't read `company_knowledge`. Re-run provision (re-applies role grants).
3. **Re-provision:** `POST .../byod/provision` again — short-circuits if already `LIVE`, otherwise re-runs probe → schema → role → health → LIVE.
4. Errors are sanitized (E6) — they never contain the DSN/host. If you need the host, decrypt is in-memory only; do not log it.

---

<a id="stuck-migration"></a>
## Stuck migration

A data-plane rollout (`POST /api/internal/run-data-plane-migrations`) reports `failed`/`contended`, or a tenant won't advance its `schema_version`.

1. **Read the rollout report:** `migrated` / `current` / `contended` / `failed` / `skipped` counts + per-tenant `outcomes`.
2. **`contended`** = another runner holds the Postgres advisory lock — benign; it retries next pass. Don't intervene unless it never clears (a crashed runner left a session lock → the lock releases when that backend dies; verify no orphaned backend on the tenant DB).
3. **`skipped`** = the tenant's breaker is open — fix the tenant first ([breaker-open](#breaker-open)), then re-run the rollout.
4. **`failed`** = unreachable / missing migrate credential / verification failed. The version is **not** advanced on failure (rule 13). Sanitized error names the class only.
   - Verification failure (`MigrationVerificationError`) → the migration applied but the head didn't reach target; do not record. Inspect the tenant's `alembic_version`; engineering escalation.
5. **Re-run is always safe** — the orchestrator is idempotent and prefilters already-current tenants without connecting.

---

<a id="tenant-db-outage"></a>
## Tenant DB outage

A tenant's DB is down/unreachable (breaker open, `byod_tenant_db_errors_total{kind=connect}` rising).

1. **Confirm isolation:** the shared plane and other tenants must be green. The breaker fast-fails the affected tenant only; the global ceiling is protected ([global-ceiling](#global-ceiling)).
2. **Customer impact:** that tenant's bot returns "temporarily unavailable" / fallback. This is the client's infrastructure (RFC trust boundary) — we do not have access to fix their DB.
3. **Notify** the customer with the failure class (connect/timeout/auth). If auth → [credential-rotation](#credential-rotation).
4. **Recovery is automatic** — the breaker probes (HALF_OPEN) and re-closes once their DB is reachable. No action needed on our side once they're back.
5. If they need to leave BYOD while their DB is down, see [emergency-disconnect](#emergency-disconnect) (offboard preserves their data, removes only routing+creds).

---

<a id="credential-rotation"></a>
## Credential rotation

The tenant rotated their DB password (status `NEEDS_RECONNECT`, or auth failures `kind=connect` / breaker open on a previously healthy tenant).

1. **Detect:** `byod_health` classifies auth failures (SQLSTATE 28P01/28000) as `TenantAuthFailed` → the tenant goes `NEEDS_RECONNECT` (distinct from merely unreachable).
2. **Re-key:** have the customer supply the new connection string → `PUT /api/admin/users/{clerk_id}/byod/connection` (validates + envelope-encrypts; never logs the DSN).
3. **Re-provision/health:** `POST .../byod/provision` (or `.../byod/health`) to mint a fresh runtime DSN under the rotated migrate cred and return to `LIVE`. Provisioning **invalidates the decrypted-DSN cache** for that tenant so the new cred takes effect immediately (not after TTL).
4. **KMS master-key rotation** (our side, not the tenant's) is different: old + new keys coexist (`byod_crypto.rotate_*`), so rotation re-encrypts without an outage. Old-key ciphertext stays decryptable during rollout.

---

<a id="emergency-disconnect"></a>
## Emergency disconnect

You need to immediately stop the engine from connecting to a tenant's DB (security incident, customer request, runaway tenant).

1. **Fast kill (no data change):** remove the tenant from `BYOD_CANARY_COMPANY_IDS` (or flip `BYOD_ENABLED` off for a fleet-wide stop). `routing_active` goes false → that tenant's data-plane traffic reverts to the dark/shared path on the next request. No DB writes, instantly reversible.
2. **Offboard (E10, preserves customer data):** `POST /api/admin/users/{clerk_id}/byod/offboard` or `DELETE` the company — removes **only** the control-plane routing pointer + encrypted credentials. The engine stops connecting; the **client's DB is never touched** (no DROP/TRUNCATE/DELETE). Audit logs `BYOD_OFFBOARD {tenant_data_preserved: true}`.
3. **Switch back to shared** (if they want to keep using Sapybase): `POST .../byod/switch-out` reverse-migrates tenant→shared in checkpointed batches with verification, then offboards — and the tenant DB stays **read-only throughout** (we only SELECT from it).
4. Never delete tenant data as part of a disconnect. Explicit, user-confirmed deletion (GDPR/purge) is a separate, distinct path.

---

# On-call sign-off

Phase 8.4 GA gate (RFC §13): *"All §16.9 states alert + have a runbook; on-call sign-off."*

- [x] Every RFC §16.9 exceptional state has a detection metric in `METRIC_CATALOG`, an alert in `ALERTS` (rendered to `byod_alerts.yml`), and a runbook section above. **Enforced by** `tests/byod/test_byod_runbooks.py`.
- [x] Every RFC §11 operational runbook (onboarding failure, stuck migration, tenant DB outage, credential rotation, emergency disconnect) is present above.
- [x] Alerts route by severity: `page` (KMS, global ceiling, routing mismatch) wake on-call; `ticket`/`info` go to the queue.

**On-call sign-off:** _________________________  **Date:** ____________

> Reviewer: confirm each `page`-severity alert has a paging route configured in the
> alertmanager before enabling `byo_database` for the first paying client.
