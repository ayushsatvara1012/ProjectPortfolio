# BYOD Go-Live — Do-This-Tomorrow Checklist

**Goal:** take BYOD from "deployed but dark" to "enabled for the first paying client," safely.
**Start here and work top to bottom.** Each step says what to do, the exact command/where, and **Done when**.

**Status going in (2026-06-18):** all code complete + deployed to production (`MainV2`), running dark. All config + observability blockers closed (KMS, egress IPs, `/metrics` gate, crons, alerts in Mimir, **§3.2 paging verified with a real page email**). BYOD is OFF: `BYOD_ENABLED` and `BYOD_CANARY_COMPANY_IDS` are unset.

**What's left = 3 things:** (A) rotate leaked secrets, (B) Step 7 canary validation against a real tenant DB, (C) Step 8 sign-off + enable.

**⚠️ Execution order (decided 2026-06-19): run B → C → A, NOT A first.** The security cleanup (A) must come **after** B3's real KMS page, because the live Alertmanager config in Grafana Cloud uses the *current* Resend API key as its SMTP password — revoking that key before B3 would silently break the very page we are trying to verify. Sections stay in A/B/C order below for reference; follow the execution order, not the section order.

Detail docs this references:
- Canary runbook: [`runbooks/byod_canary_dryrun.md`](runbooks/byod_canary_dryrun.md)
- Failure-state runbooks + on-call sign-off: [`runbooks/byod_runbook.md`](runbooks/byod_runbook.md)
- Readiness gate: [`byod-production-readiness.md`](byod-production-readiness.md)
- Client onboarding requirements: [`byod-client-onboarding.md`](byod-client-onboarding.md)

---

## A. Security cleanup — DO THIS LAST, after B3's real page (~15 min) 🔒

Two tokens were printed into chat in earlier sessions; treat them as compromised. **Do not start this section until B3's real KMS page has been verified delivered** — A1 revokes the key that page depends on. A2 (Alloy token) has no such dependency and may be done anytime.

- [x] **A1. Rotate the Resend API key — ONLY after B3's real page passed.** The live Alertmanager config embeds this key as its SMTP password, so revoking it without re-loading the config silently kills *all* paging. Order: Resend dashboard → API Keys → **create the new key first** → put it in a fresh `.env.alertmanager` → re-render + `mimirtool alertmanager load` the config with the new key (**AM tenant id `1656651`**) → fire a synthetic page to confirm delivery → **only then revoke** the old key (`re_j5WgBxWz…`). **(2026-06-20: new `sending_access` key created, loaded into live AM tenant `1656651`, synthetic page `BYODSyntheticPageTest` delivered to the pager inbox on the new key, old key `re_j5WgBxWz…` revoked. ✅ DONE.)**
- [x] **A2. Rotate the Alloy data-write token** — DONE 2026-06-20. Grafana Cloud has no "rotate" button → created a NEW token under access policy `stack-1696599-alloy-byod-alloy-render`, swapped it into the Alloy Render worker's `GRAFANA_CLOUD_API_KEY`, redeployed, confirmed `up=1` in Grafana Explore, then deleted the old token.
- [x] **A3. Delete local secret files** — DONE 2026-06-20 after A1's re-load was verified. `rm -f .env.alertmanager ~/.byod_rules_token` + `/tmp/byod_am.yaml`. `.env.alertmanager` was gitignored (never committed), so local-only.

**Done when:** old Resend key + old Alloy token are revoked, Alloy still scrapes (`up=1`), and the two local files are deleted. **✅ SECTION A COMPLETE 2026-06-20.** (Optional leftover: the `glc_…` *AM* token from the old `.env.alertmanager` was also surfaced in chat — rotate it the same way if treating chat-exposure as compromise; nothing depends on it locally now.)

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

### B4. Shared-fleet regression (GA criterion) — ✅ DONE 2026-06-20
- [x] Measured shared-plane SLOs from Grafana Cloud (Mimir) over [6h] with the canary live: **error_rate 0** (0×5xx, 0×4xx), **p95 12.3 ms**, **p99 24.5 ms** (~729 shared requests). Queries: `histogram_quantile(0.95|0.99, sum by (le)(rate(sapybase_http_request_duration_seconds_bucket{plane="shared"}[6h])))*1000` and `sum(rate(...status_class="5xx"))/sum(rate(...))`.
- [x] `scripts/capture_slo_baseline.py --check` of those numbers vs the committed Phase-0 baseline → **`[shared] OK`, exit 0**. Shared fleet far under budget (≤0.55% err, ≤1650 ms p95, ≤3300 ms p99) with the canary live → **no regression**.
- [ ] (Deliberately skipped) NOT refreshing `baseline.json` to these numbers — at pre-launch volume a 12 ms p95 baseline is an unrealistically tight budget that would false-positive once real load arrives. Keep the SLO ceilings as the stable regression budget; revisit with representative production traffic. Tenant plane excluded from the check (just fault-injected in B3 → artificially degraded).

**Done when:** the shared plane shows no regression. ✅

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
- [x] §4.6 focused `/code-review` over the BYOD **core** modules (pool/breaker, engine + DSN-resolution, SSRF/DSN validator, crypto/KMS) — done 2026-06-19, clean. Fixed one observability bug: `byod_pool` `global_in_flight` gauge was emitted *before* the decrement on release, leaving it stuck one-too-high at rest. Remaining modules (switchin/out, orchestrator, metering, store, ingest) not yet re-reviewed.

---

### Quick reference
- **Backend:** `https://sapyai.onrender.com` (Render, gunicorn -w 4). Egress IPs `74.220.48.0/24` + `74.220.56.0/24`.
- **Flags (the on-switch):** `BYOD_ENABLED=true` + `BYOD_CANARY_COMPANY_IDS=<company_id,…>`. Both unset today = dark.
- **The 3 page alerts:** `BYODKmsDecryptErrors`, `BYODGlobalCeilingReached`, `BYODRoutingIntegrityViolation`. AM tenant id for any mimirtool reload = **`1656651`** (not the metrics id `3317422`).
- **⚠️ Back up `BYOD_KMS_MASTER_KEYS`** — losing it makes every tenant's stored DSN unrecoverable.
