# BYOD Go-Live — Do-This-Tomorrow Checklist

**Goal:** take BYOD from "deployed but dark" to "enabled for the first paying client," safely.
**Start here and work top to bottom.** Each step says what to do, the exact command/where, and **Done when**.

**Status going in (2026-06-18):** all code complete + deployed to production (`MainV2`), running dark. All config + observability blockers closed (KMS, egress IPs, `/metrics` gate, crons, alerts in Mimir, **§3.2 paging verified with a real page email**). BYOD is OFF: `BYOD_ENABLED` and `BYOD_CANARY_COMPANY_IDS` are unset.

**What's left = 3 things:** (A) rotate leaked secrets, (B) Step 7 canary validation against a real tenant DB, (C) Step 8 sign-off + enable. A–C below.

Detail docs this references:
- Canary runbook: [`runbooks/byod_canary_dryrun.md`](runbooks/byod_canary_dryrun.md)
- Failure-state runbooks + on-call sign-off: [`runbooks/byod_runbook.md`](runbooks/byod_runbook.md)
- Readiness gate: [`byod-production-readiness.md`](byod-production-readiness.md)
- Client onboarding requirements: [`byod-client-onboarding.md`](byod-client-onboarding.md)

---

## A. Security cleanup — DO THIS FIRST (~15 min) 🔒

Two tokens were printed into chat in earlier sessions; treat them as compromised. The AM config now lives in Grafana Cloud, so the local secret files are no longer needed.

- [ ] **A1. Rotate the Resend API key.** Resend dashboard → API Keys → revoke the old key (`re_j5WgBxWz…`, used as the SMTP password) → create a new one. You only need it again if you re-load the AM config; if so, put the new value in a fresh `.env.alertmanager` at that time.
- [ ] **A2. Rotate the Alloy data-write token.** Grafana Cloud → Access Policies → the `stack-1696599-alloy-byod-alloy-render` `glc_…` token → rotate → update the Alloy Render Background Worker's `GRAFANA_CLOUD_API_KEY` env → redeploy that worker → confirm `up=1` still in Grafana Explore.
- [ ] **A3. Delete local secret files.** `rm -f ".env.alertmanager" ~/.byod_rules_token` (repo root). Confirm `.env.alertmanager` is gone — it was never committed (`.gitignore` covers `**/.env*`), so this is local-only.

**Done when:** old Resend key + old Alloy token are revoked, Alloy still scrapes (`up=1`), and the two local files are deleted.

---

## B. Step 7 — Canary validation against a REAL tenant DB (the big one)

This is the gate that unit tests can't cover. Use ONE internal / non-paying tenant. Full procedure (curls, flags, matrix) is in [`runbooks/byod_canary_dryrun.md`](runbooks/byod_canary_dryrun.md) — this is the ordered summary.

### B0. Prereq — stand up a throwaway tenant Postgres
- [ ] A Postgres reachable **from Render's egress IPs** (`74.220.48.0/24` + `74.220.56.0/24`), **pgvector ≥ 0.5.0** installed, with a **superuser DSN** for provisioning (the engine creates the DML-only `vaayu_runtime` role itself). Not one of Sapybase's own DBs. (Supabase / Neon / a cheap RDS all work.)
- [ ] Keep a psql terminal open on it — you'll inject faults in B3.

### B1. Onboard + provision (order matters: connection before provision)
Set `BASE=https://sapyai.onrender.com`, `CLERK`=the canary user's clerk id, `AUTH`=admin session header.
- [ ] `POST /api/admin/users/$CLERK/byod/enroll` → seeds the CUSTOM byo_database config.
- [ ] `PUT  /api/admin/users/$CLERK/byod/connection` `{"db_url":"postgresql://…?sslmode=require"}` → validates + encrypts + stores the DSN.
- [ ] `POST /api/admin/users/$CLERK/byod/test` `{"db_url":"…"}` → probes pgvector + vector(768). (optional)
- [ ] `POST /api/admin/users/$CLERK/byod/provision` `{"reason":"canary"}` → **expect `status:LIVE`, `schema_version:0001`**. Note the returned `company_id`.
- [ ] `POST /api/admin/users/$CLERK/byod/health` → `healthy:true`.

**Done when:** provision returns LIVE and health is green.

### B2. Flip the flags for the canary ONLY, then exercise the lifecycle
- [ ] On Render set `BYOD_ENABLED=true` and `BYOD_CANARY_COMPANY_IDS=<canary company_id>` → redeploy.
- [ ] Confirm a **non-canary** company still serves from the shared DB (isolation).
- [ ] Chat/RAG → grounded answer + a `chat_logs` row appears **on the tenant DB** (check via psql).
- [ ] Ingest a source → `company_knowledge` rows + embeddings on the tenant DB.
- [ ] Analytics/dashboard renders for the canary off tenant data.
- [ ] Trigger the weekly-digest cron path → routes through `get_tenant_db`, no other tenant affected.
- [ ] In Grafana: `sapybase_http_requests_total{plane="tenant",company_id="<canary>"}` climbs; no page alerts; error rate flat.

**Done when:** every lifecycle item works end-to-end against the remote DB and metrics look clean.

### B3. Failure injection — each must degrade, isolate, recover, and alert
Run each row from [`runbooks/byod_canary_dryrun.md`](runbooks/byod_canary_dryrun.md) §2. For each, verify (a) others stayed up, (b) only the expected alert fired, (c) it auto-recovered.
- [ ] **Kill the tenant DB** → breaker opens, tenant fast-fails → `BYODTenantBreakerOpen` (ticket). Restart → recovers.
- [ ] **Read-only the tenant DB** → chat_log write degrades soft, chat still answers → `BYODTenantWriteDegraded` (ticket). Unset → recovers.
- [ ] **Rotate the tenant's password** → status `NEEDS_RECONNECT`. Re-store DSN + provision → LIVE.
- [ ] **KMS blip** → warm tenants served from cache, cold fails → `BYODKmsDecryptErrors` (**PAGE**). This is the **real page** (§3.2 was synthetic) — confirm it reaches the pager inbox. Restore KMS → recovers.

**Done when:** all four behave per the runbook and the KMS page actually paged.

### B4. Shared-fleet regression (GA criterion)
- [ ] After metrics accumulate: `python sapybase_ai_engine/scripts/capture_slo_baseline.py --from <metrics_export>` to refresh `baseline.json` off real numbers.
- [ ] `evaluate_regression(plane="shared")` passes — shared error/latency at or below the Phase-0 baseline with the canary live.

**Done when:** the shared plane shows no regression.

---

## C. Step 8 — Sign-off & enable the first paying client

- [ ] **C1. Rollback rehearsal.** Remove the canary from `BYOD_CANARY_COMPANY_IDS` (or `BYOD_ENABLED=false`) → next request serves the shared/dark path, tenant DB untouched. (Optionally `POST /byod/switch-out` for the full reverse — tenant DB only ever read.)
- [ ] **C2. On-call sign-off.** Fill the blank sign-off line in [`runbooks/byod_runbook.md`](runbooks/byod_runbook.md#on-call-sign-off) confirming paging routes work (§3.2 synthetic + B3 real KMS page).
- [ ] **C3. Commercial.** Contract/DPA covers BYOD data handling; send the client the egress IPs (`74.220.48.0/24` + `74.220.56.0/24`) + min Postgres/pgvector (≥ 0.5.0) — see [`byod-client-onboarding.md`](byod-client-onboarding.md).
- [ ] **C4. Enable for the real client.** Onboard them (B1 steps with their DSN) → add their `company_id` to `BYOD_CANARY_COMPANY_IDS` → redeploy. Keep `BYOD_ENABLED=true`.
- [ ] **C5. Watch the first billing cycle.** Grafana dashboard + alerts; metering correct; no shared-fleet regression.

**Done when:** sign-off recorded, client enabled, and the first cycle is clean. **BYOD is then production-live.** 🎉

---

## Optional polish (NOT blocking a careful pilot — do anytime)
- [ ] §3.3 import the Grafana dashboard (`observability/dashboards/byod_slo_dashboard.json`).
- [ ] §3.4 wire `baseline.json --check` into CI/release.
- [ ] §4.6 one focused `/code-review` pass over the BYOD modules.

---

### Quick reference
- **Backend:** `https://sapyai.onrender.com` (Render, gunicorn -w 4). Egress IPs `74.220.48.0/24` + `74.220.56.0/24`.
- **Flags (the on-switch):** `BYOD_ENABLED=true` + `BYOD_CANARY_COMPANY_IDS=<company_id,…>`. Both unset today = dark.
- **The 3 page alerts:** `BYODKmsDecryptErrors`, `BYODGlobalCeilingReached`, `BYODRoutingIntegrityViolation`. AM tenant id for any mimirtool reload = **`1656651`** (not the metrics id `3317422`).
- **⚠️ Back up `BYOD_KMS_MASTER_KEYS`** — losing it makes every tenant's stored DSN unrecoverable.
