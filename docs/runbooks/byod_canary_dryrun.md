# BYOD Canary Dry-Run & Failure-Injection — Step 7 (readiness §4.1–§4.3)

Executable runbook for the canary validation gate. Goal: prove the full BYOD
lifecycle works against a **real remote tenant DB** with real KMS + real
Prometheus/alerting, and that every §16.9 failure mode degrades-isolates-recovers
and fires the right alert — **before** any paying client is enabled.

**Use one internal / non-paying tenant.** Nothing here touches a real customer.
All `curl`s hit the admin API as a super-admin (`get_admin_user` + fresh-admin);
substitute `$BASE=https://sapyai.onrender.com`, `$CLERK` = the canary user's
clerk id, and an admin session token. Watch Grafana Cloud Explore + the loaded
`byod` alert rules throughout.

---

## 0. Prereqs (all already ✅ unless noted)

- [ ] Throwaway **tenant Postgres** reachable from Render's egress IPs, **pgvector ≥ 0.5.0**, superuser DSN for provisioning (engine creates the DML-only `vaayu_runtime` role itself). NOT one of Sapybase's own DBs.
- [x] KMS env on Render (`BYOD_KMS_MASTER_KEYS` + `BYOD_KMS_ACTIVE_KEY_ID`).
- [x] `/metrics` scraped by Alloy → Grafana Cloud (`up=1`); `byod_alerts.yml` in the Mimir ruler; AM paging route live (§3.2 done — a synthetic page already reached the inbox).
- [ ] A second terminal open on the **tenant DB** (psql as its owner/superuser) — you'll use it to inject faults in §2.

---

## 1. Onboard + provision the canary (§4.1 lifecycle)

Order matters — `provision` reads the **stored** DSN, so `connection` must run first.

```sh
# 1a. Seed a CUSTOM byo_database config from the template
curl -sX POST  "$BASE/api/admin/users/$CLERK/byod/enroll"        -H "$AUTH"

# 1b. Store the tenant DSN (validated: SSRF + allowlist + TLS, then envelope-encrypted)
curl -sX PUT   "$BASE/api/admin/users/$CLERK/byod/connection"    -H "$AUTH" \
     -H 'Content-Type: application/json' -d '{"db_url":"postgresql://user:pass@host:5432/db?sslmode=require"}'

# 1c. (optional) Test button — probe pgvector + vector(768) creatable, stores nothing
curl -sX POST  "$BASE/api/admin/users/$CLERK/byod/test"          -H "$AUTH" \
     -H 'Content-Type: application/json' -d '{"db_url":"postgresql://user:pass@host:5432/db?sslmode=require"}'

# 1d. Provision end-to-end → applies data-plane schema, creates vaayu_runtime, flips LIVE
curl -sX POST  "$BASE/api/admin/users/$CLERK/byod/provision"     -H "$AUTH" \
     -H 'Content-Type: application/json' -d '{"reason":"canary dry-run"}'
#   expect: {"status":"success","status":"LIVE","schema_version":"0001","pgvector_version":"0.x.y", ...}

# 1e. (optional) Relocate the canary's existing shared rows into its own DB (7-day rollback retained)
curl -sX POST  "$BASE/api/admin/users/$CLERK/byod/switch-in"     -H "$AUTH" \
     -H 'Content-Type: application/json' -d '{"reason":"canary switch-in"}'

# 1f. Health probe (connects with the DML-only runtime cred)
curl -sX POST  "$BASE/api/admin/users/$CLERK/byod/health"        -H "$AUTH"
#   expect: {"healthy":true,"status":"LIVE"}
```

**Then flip the flags for THIS tenant only** (Render env → redeploy):

```
BYOD_ENABLED=true
BYOD_CANARY_COMPANY_IDS=<the canary company_id>   # from provision/GET /byod response
```

Routing is dark for everyone not in the allowlist (`byod_flags`). Confirm a
non-canary company still serves from the shared DB.

**Exercise the lifecycle** (each should now hit the tenant DB, tagged
`plane="tenant"` in metrics):
- [ ] **Chat / RAG** — ask the bot something answerable from ingested content; verify a grounded answer + a `chat_logs` row lands **on the tenant DB** (psql).
- [ ] **Ingest** — add a knowledge source; verify `company_knowledge` rows + embeddings on the tenant DB.
- [ ] **Analytics / dashboard** — funnel + insights render for the canary off tenant data.
- [ ] **Background digest** — trigger the weekly digest cron path; verify it routes through `get_tenant_db` (breaker + bounded concurrency) without touching other tenants.
- [ ] **Switch-out** (rollback rehearsal, do last or in §3) — `POST /byod/switch-out` copies tenant→shared, verifies, then offboards; **the tenant DB is read-only throughout** (client data never modified).

Watch in Grafana: `sapybase_http_requests_total{plane="tenant",company_id="<canary>"}` climbs; no page alerts fire; error rate flat.

---

## 2. Failure injection (§4.2) — each degrades, isolates, recovers, and alerts

Induce on the tenant DB (or KMS) in the second terminal; observe engine behavior
+ the matching alert. Cross-reference the per-state detail in
[byod_runbook.md](byod_runbook.md). **Throughout: a healthy non-canary tenant
and the shared fleet must stay green (isolation).**

| # | Inject | Expected engine behavior | Metric / Alert | Recovery |
|---|--------|--------------------------|----------------|----------|
| 2a | **Kill the tenant DB** (stop it / firewall it) | After ≤5 failed queries the per-tenant **breaker opens**; that tenant **fast-fails** (no global ceiling slot consumed); others unaffected | `byod_tenant_circuit_breaker_state==1` → **BYODTenantBreakerOpen** (ticket, 5m) · [runbook](byod_runbook.md#breaker-open) | Bring DB back → breaker HALF_OPEN→CLOSED after cooldown; alert resolves |
| 2b | **Make tenant DB read-only** (`ALTER DATABASE … SET default_transaction_read_only=on` / recovery) | Writes raise SQLSTATE **25006**; `tenant_log_chat` **degrades soft** (skips the chat_log write, chat still answers) | `byod_tenant_db_errors_total{kind="readonly"}` → **BYODTenantWriteDegraded** (ticket) · [runbook](byod_runbook.md#tenant-db-read-only) | Unset read-only → writes resume; alert resolves |
| 2c | **Rotate the tenant's password** (so the stored runtime cred is stale) | Connect fails auth → `TenantAuthFailed` → status flips **NEEDS_RECONNECT** (distinct from generic unreachable) | breaker/db_error; health endpoint reports NEEDS_RECONNECT · [runbook](byod_runbook.md#credential-rotation) | Re-store DSN via `PUT /byod/connection` + `POST /byod/provision` (or health) → LIVE |
| 2d | **Simulate a KMS blip** (temporarily break `kms_from_env` / make the master key unavailable) | Warm tenants **served from the decrypted-DSN cache** (blip invisible within TTL); only a never-decrypted **cold** tenant fails (`outcome=cold_fail`) | `byod_kms_decrypt_errors_total` → **BYODKmsDecryptErrors** (**page**) · [runbook](byod_runbook.md#kms-unavailable) | Restore KMS → cold tenants recover; alert resolves. **This is one of the 3 page alerts — confirm it pages.** |

For each: record (a) the engine stayed up for everyone else, (b) the expected
alert fired (and only that one), (c) it auto-recovered, (d) the runbook steps
matched reality. Discrepancies are blockers.

> Note 2d gives you the **real** (non-synthetic) page that §3.2 only fired
> synthetically. Global-ceiling + routing-integrity (the other two page alerts)
> are validated structurally by the Phase 8.1/8.3 suites, not safely inducible on
> a live canary — note that in sign-off rather than forcing them.

---

## 3. Shared-fleet regression (§4.3) — the GA criterion

With BYOD enabled for the canary, the **shared** plane's error/latency must stay
at or below the Phase-0 baseline.

```sh
# Capture live numbers once metrics have accumulated, then gate:
python sapybase_ai_engine/scripts/capture_slo_baseline.py --from <metrics_export>   # refresh baseline.json off real data (§3.4)
# evaluate_regression(plane="shared") must pass — wire --check into the release gate
```

- [ ] `evaluate_regression(plane="shared")` OK against live numbers.
- [ ] No error-rate regression vs baseline with the canary live.

---

## 4. Rollback rehearsal (§5 gate)

Prove the off-switch reverts cleanly with **no data change**:
- [ ] Remove the canary from `BYOD_CANARY_COMPANY_IDS` (or `BYOD_ENABLED=false`) → next request serves from the shared/dark path; tenant DB untouched.
- [ ] (Full reverse) `POST /byod/switch-out` → rows back on shared, then offboard; tenant DB only ever read.

---

## Exit → Step 8

When §1–§4 pass: record **on-call sign-off** in [byod_runbook.md](byod_runbook.md#on-call-sign-off)
(paging routes confirmed — §3.2 + the real KMS page from 2d), then the §5
go-live checklist (commercial/DPA, egress IP to client, enable for the first
paying `company_id`, monitor the first billing cycle).
