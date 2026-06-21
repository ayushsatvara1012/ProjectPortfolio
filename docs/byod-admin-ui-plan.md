# BYOD Admin & Client UI — Implementation Plan

**Goal:** make BYOD fully operable from the Sapybase app — onboard, provision,
enable/disable, monitor, and offboard a client **without ever touching Render env
vars or running curl/console scripts** — with a self-serve client onboarding step
and high security throughout.

**Status:** Phases 1–6 BUILT — the operability layer is COMPLETE (admin fleet view
+ lifecycle actions + DB-driven routing switch + client self-serve onboarding +
client status/reconnect + change-request signal + per-tenant metering/usage panel +
final responsive/dark/a11y pass). BYOD itself is GA + production-ready (Sections A/B
+ C1/C2 done); this UI layer makes it fully click-operable.

---

## 0. Decisions (locked with the user 2026-06-20)

| # | Decision | Choice |
|---|---|---|
| D1 | Who enters the DSN / who triggers go-live | **Hybrid** — client self-serve enters + tests their DSN; **super-admin** reviews → Provision → Enable. A human gate before any tenant serves real traffic. |
| D2 | How a client lands on the BYOD plan | **Admin assigns manually** after payment (existing `enroll`). No billing webhook now — left as a future item (§8). |
| D3 | Ongoing client self-service | **View status/health + request changes** (reconnect / leave). All mutations (provision, enable/disable, switch-out, live DSN change) stay **admin-only**. |

**Reconciliation of D1 + D3 (important):** the client may enter a DSN **only while
the tenant is in an onboarding state** (`PENDING`, or `NEEDS_RECONNECT` after a
password rotation). Once `LIVE`, the connection is **frozen to the client** — a
change is a *re-onboarding* (client re-enters under `NEEDS_RECONNECT` → admin
re-provisions + re-enables), never a silent self-update of a live connection. This
honours "client enters" (D1) without granting "self-update connection" (D3).

---

## 1. Current state (grounded in code, not assumed)

**Backend — the engine is done; only a front door + one switch are missing.**
- All lifecycle ops already exist as super-admin endpoints in
  [`main.py:7113-7463`](../sapybase_ai_engine/main.py): `enroll`, `test`,
  `provision`, `health`, `switch-in`, `switch-out`, `offboard`, `connection` (PUT),
  plus a GET admin **detail** view (`byod_admin.get_admin_view`). All are gated by
  `get_admin_user` + `require_fresh_admin` (Clerk JWT < 10 min), rate-limited, and
  keyed by `clerk_id`.
- Control row [`byod_store.py`](../sapybase_ai_engine/byod_store.py) statuses:
  `PENDING / PROVISIONING / LIVE / NEEDS_RECONNECT / DISABLED / ERROR`. **`DISABLED`
  already means "stop connecting, keep creds."**
- Entitlement: `byo_database` is a per-plan flag ([`config.py:48`](../sapybase_ai_engine/config.py))
  assigned via the custom-plan machinery (`enroll`).
- DSN secrecy is already enforced: validated (SSRF/TLS/param-allowlist via
  `byod_dsn.validate_db_url`), envelope-encrypted at rest (KMS), **never logged or
  returned** (only a masked form), audited without the secret.

**The three real gaps:**
1. **Routing reads only env.** [`byod_flags.byo_database_active`](../sapybase_ai_engine/byod_flags.py)
   = `BYOD_ENABLED` (env) AND `company_id ∈ BYOD_CANARY_COMPANY_IDS` (env). This is
   *why* enabling a client needs a Render edit + redeploy.
2. **No fleet-list endpoint** — only per-`clerk_id` detail.
3. **No client-facing UI or endpoints** — everything is super-admin today.

**Frontend conventions (to match):** App Router, `'use client'` interactive
components, `useAuthenticatedFetch` ([`src/lib/hooks/useAuthenticatedFetch`](../src/lib/hooks/useAuthenticatedFetch.ts)),
`@tanstack/react-query`, Tailwind + dark mode, framer-motion. Super-admin panel is
tabbed at [`settings/admin/page.tsx`](../src/app/(app)/dashboard/settings/admin/page.tsx)
(e.g. `ExploreEnquiriesTab`) — a BYOD tab drops in there.

---

## 2. Target architecture

### 2.1 The one engine change — move the per-tenant on/off into the DB
Add an explicit boolean so an operator can toggle routing with **no redeploy**, and
keep `BYOD_ENABLED` as the global kill-switch.

- **Migration (control plane):** `ALTER TABLE byod_tenant_databases ADD COLUMN
  routing_enabled BOOLEAN NOT NULL DEFAULT FALSE;` (additive, idempotent, dark by
  default — existing rows stay off, so behaviour is unchanged until explicitly set).
  Add the column to `byod_store` `_COLUMNS`, `TenantDbRecord`, and a
  `set_routing_enabled(cur, company_id, enabled)` helper.
- **New routing rule:** a tenant routes to its own DB iff
  **`BYOD_ENABLED` (env, global kill) AND `status == LIVE` AND `routing_enabled == TRUE`.**
  Status `LIVE` proves it's provisioned + healthy; `routing_enabled` is the admin's
  switch. `DISABLED`/`ERROR`/`NEEDS_RECONNECT`/`PENDING` never route.
- **Hot-path performance:** `routing_active()` is called per chat request, so it must
  not hit the DB every time. Add a small **routing-decision cache** (company_id →
  (status, routing_enabled), TTL ~30–60 s) — mirror the existing
  [`byod_dsn_cache`](../sapybase_ai_engine/byod_dsn_cache.py) pattern. **Invalidate
  explicitly** on every mutation that changes routing (provision, health,
  enable/disable, offboard, switch-out) so a toggle takes effect immediately; the
  short TTL is the self-healing backstop.
- **Backwards-compat during rollout:** keep reading the env canary list as an **OR
  fallback** for one release (`routing = global_kill AND status_live AND
  (routing_enabled OR company_id ∈ env_canary)`), so the current canary
  (`d8c73846…`) keeps working. Then set `routing_enabled = TRUE` on its row and drop
  the env-canary branch in a follow-up. `BYOD_ENABLED` stays forever as the master
  kill.

### 2.2 New endpoints
**Admin (super-admin + fresh-admin), additive to the existing set:**
- `GET  /api/admin/byod/tenants` — fleet list: for each BYOD company →
  `{company_id, clerk_id, company_name, status, schema_version, routing_enabled,
  last_health_at, masked_dsn?}`. Backed by a new `byod_store.list_all_tenants` (the
  existing `list_live_tenants` is LIVE-only; the admin view needs all states).
- `POST /api/admin/users/{clerk_id}/byod/enable` and `.../byod/disable` — flip
  `routing_enabled` (+ invalidate the routing cache + audit). Enable is allowed only
  from `LIVE`; disable allowed from any state (idempotent).

**Client (authenticated user, scoped to their OWN company — NOT admin):**
- `GET  /api/byod/me` — status/health/masked DSN/requirements for the caller's own
  company.
- `POST /api/byod/me/test` — validate + probe a candidate DSN (stores nothing).
- `PUT  /api/byod/me/connection` — store the DSN, **only if** current status ∈
  {`PENDING`, `NEEDS_RECONNECT`} (else 409). Leaves status `PENDING` for admin review.
- `POST /api/byod/me/request-change` — `{kind: "reconnect"|"leave", note}` → creates
  an admin notification/task; performs **no** mutation.

**Client-endpoint authz (the critical bit):** company is resolved **from the
authenticated session only** — these routes take **no** `clerk_id`/`company_id`
path param (prevents IDOR). They require the `byo_database` entitlement, are
rate-limited, and reuse the exact same `validate_db_url` + KMS-encrypt path as the
admin `connection` endpoint (no parallel, weaker code path for secrets).

---

## 3. Security model (high security — non-negotiables)

- **DSN secrecy:** plaintext DSN never logged, never returned, never persisted —
  validated → envelope-encrypted (existing KMS) → stored as ciphertext; UI shows only
  a masked form. Client-side never caches it. TLS in transit (HTTPS) end-to-end.
- **Validation before storage:** every DSN (admin or client path) goes through
  `validate_db_url` (SSRF / DNS-rebinding / private-IP / TLS-required / param
  allowlist) — reuse, don't reimplement.
- **AuthZ separation:** admin routes = `get_admin_user` + `require_fresh_admin`
  (arbitrary `clerk_id`). Client routes = the user's own session, **own company
  only**, entitlement-gated, **no id param**.
- **Human gate (D1):** a tenant cannot reach `routing_enabled = TRUE` without an
  explicit super-admin action. Self-serve stops at "DSN stored + tested = PENDING."
- **Audit everything:** admin actions already call `log_admin_action` (DSN-free).
  Add equivalent audit rows for the new enable/disable + client actions (masked only).
- **Fresh-admin during long ops:** provision/switch-in/out can exceed the < 10-min
  admin-JWT window. UI must detect a 401 "stale admin" and trigger a silent token
  refresh / step-up re-auth, then retry — never lose a long migration to an expired
  token.
- **Global kill stays infra:** `BYOD_ENABLED`, KMS keys, pool/ceiling tunables,
  `CRON_SECRET` remain Render env — deliberately **not** in the click-UI.

---

## 4. Phases (each independently shippable; ordered to de-risk)

> Each phase ends with tests green + a doc tick. Frontend is responsive (Tailwind
> breakpoints + dark mode) from the first phase.

### Phase 1 — Admin read-only fleet view *(no engine change; lowest risk)*
**Backend:** add `byod_store.list_all_tenants` + `GET /api/admin/byod/tenants`
(super-admin + fresh-admin). Join `companies` for name/clerk_id.
**Frontend:** new **"BYOD" tab** in [`settings/admin/page.tsx`] — a responsive table
(company, owner, status badge, schema_version, routing_enabled, last health) using
`useAuthenticatedFetch` + react-query; a row opens a read-only detail drawer fed by
the existing `get_admin_view`.
**Done when:** you can see every BYOD tenant + status in-app on desktop and mobile.
**Edge cases:** zero tenants → empty state; a company with entitlement but no
`byod_tenant_databases` row → "Not started" pseudo-status.

### Phase 2 — Admin lifecycle actions *(wire existing endpoints; no engine change)*
**Frontend only** (plus tiny request-model reuse): wire buttons in the detail drawer
to the endpoints that already exist — **Enroll**, **Set/Update connection** (masked
input), **Test** (green/red result), **Provision**, **Health check**, **Switch-in**,
**Switch-out**, **Offboard**. Each = an optimistic react-query mutation with a
confirm dialog for destructive ones (offboard/switch-out) and an audit-reason field
where the model requires `reason`.
**Done when:** a full tenant lifecycle is doable from the panel with zero curl.
**Edge cases:** double-click provision (already advisory-locked server-side → safe);
stale-admin 401 → token refresh + retry (§3); validation 400 → show the sanitized
message; 503 KMS-unavailable → "encryption service unavailable, retry."

### Phase 3 — DB-driven on/off switch *(the one engine change)*
**Backend:** the §2.1 migration + `set_routing_enabled` + the new `routing_active`
rule + routing-decision cache + invalidation hooks on every routing-affecting
endpoint + the `enable`/`disable` admin endpoints. **Tests:** unit (routing truth
table across status × routing_enabled × global kill), cache invalidation, and a
backwards-compat test proving the env-canary fallback still routes the existing
canary. Migrate the live canary by setting `routing_enabled = TRUE` on its row.
**Frontend:** an **Enable/Disable toggle** per tenant (only enable-able from `LIVE`),
with an "are you sure" on disable (it cuts the tenant to the shared path).
**Done when:** enabling/disabling a client is a one-click in-app action with **no
Render edit and no redeploy**, verified by a chat landing on the tenant DB after
enable and on the shared DB after disable (the C1 rehearsal, now UI-driven).
**Edge cases:** in-flight requests during a toggle complete on the old path (cache
TTL bounded — acceptable, documented); `BYOD_ENABLED=false` global kill overrides the
DB flag (master switch wins); toggling a non-LIVE tenant → 409 with reason.

### Phase 4 — Client self-serve onboarding (hybrid) *(client UI + client endpoints)*
**Backend:** the four `/api/byod/me*` endpoints (§2.2) with own-company authz +
entitlement gate + reused validate/encrypt path.
**Frontend:** a new client page (e.g. `dashboard/database/page.tsx`) shown only to
`byo_database`-entitled users — a guided wizard: (1) show **requirements + egress
IPs** to allowlist (from [`byod-client-onboarding.md`](byod-client-onboarding.md)),
(2) paste DSN (masked) → **Test** (live result), (3) submit → "Submitted for review"
(status `PENDING`). Admin sees it in the Phase-1 list and provisions/enables (Phase
2/3).
**Done when:** a client can subscribe → self-onboard their DB → admin approves, all
in-app, no email/curl for the DSN.
**Edge cases:** DSN fails SSRF/TLS validation → clear sanitized inline error; DB not
reachable from egress IPs → actionable "allowlist these IPs" message; client submits
while already `LIVE` → blocked (frozen, §0 reconciliation); pgvector missing/too old
→ the existing probe error surfaced verbatim-safe.

### Phase 5 — Client status + request-changes + reconnect flow ✅ BUILT 2026-06-21
**Frontend (client):** a status card (LIVE / NEEDS_RECONNECT / DISABLED / ERROR with
plain-English copy + last health), a **"Request reconnect"** / **"Request to leave"**
button (→ `request-change`), and — only under `NEEDS_RECONNECT` — re-open the DSN
entry (re-onboarding per §0; lands `PENDING` for admin re-provision).
**Backend:** `request-change` raises an admin notification (reuse whatever admin
task/notify mechanism exists; if none, an audit row + a flag on the fleet list).
**Done when:** a client whose DB password rotated can self-heal the credential and
the admin gets a clear signal to re-provision.
**Edge cases:** spam of requests → rate-limited + dedup; "leave" never deletes client
data (maps to switch-out/offboard, admin-run).

> **As built (2026-06-21):** No general admin-notification system exists, so the
> plan's fallback was taken — **a persisted flag on the fleet list**. Migration
> `0020` adds `pending_change_kind` / `pending_change_note` / `pending_change_at`
> (the client→admin signal) + `last_health_at` to `byod_tenant_databases` (additive,
> dark, NULL by default; single-source-of-truth DDL in `byod_store`).
> `byod_client.request_change` now **parks the latest request** on the tenant row
> (latest-wins ⇒ dedup; with the existing `10/minute` route limit that satisfies
> "rate-limited + dedup") — still **no lifecycle mutation** ("leave" never deletes
> data). The signal surfaces in `GET /api/admin/byod/tenants`, the admin detail view,
> and the client's own `GET /api/byod/me` (so the client sees a persistent "pending
> review" banner across reloads). It is **cleared** on: admin **provision → LIVE**
> (reconnect resolved), the client **re-submitting a DSN** (self-heal), or an explicit
> new admin endpoint `POST …/byod/clear-request` ("Dismiss request" in the drawer).
> `last_health_at` is stamped by `check_health` + `provision` and shown in both the
> client status card and the admin drawer. The admin tab gains a **Requests** filter +
> a "Reconnect/Leave requested" pill on every row. A no-row caller (status "not
> started") requesting a change gets a `409` (nothing to reconnect/leave). Tests:
> store helpers + dedup + migration-0020 wiring + client round-trips (request parks &
> surfaces, dedup, re-onboard clears, 409) + fleet-list flag + client-page component
> tests (persistent banner, button collapse, last-health, correct kind). Backend
> `pytest tests/byod` green (366 passed); frontend `vitest` green (282); `tsc` clean.

### Phase 6 — Metering/usage panel + polish ✅ BUILT 2026-06-21 *(doubles as C5 "watch the cycle")*
**Frontend:** a per-tenant usage/metering view (message counts, billing-relevant
totals from the existing metering tables/`byod_metering`) + health/latency at-a-glance
in the admin detail; final responsive + dark-mode + a11y pass.
**Done when:** you can watch a tenant's first billing cycle (C5) from the panel.

> **As built (2026-06-21):** Read-only, control-plane-only (never the untrusted
> tenant DB, §6). **Backend:** `byod_metering.summarize_company_usage(cur, company_id)`
> rolls up the authoritative billing counter + current window from `usage_tracking`
> **and** all-time + trailing-window (24h/7d/30d) + last-metered from the idempotent
> `byod_usage_ledger` (one row per metered message). New admin endpoint
> `GET /api/admin/users/{clerk_id}/byod/usage` (super-admin + fresh-admin, 30/min,
> DSN-free). **Frontend:** a `UsagePanel` in the admin detail drawer (`ByodTab.tsx`)
> — "Messages billed" + "Metered (all time)" stat tiles, a 24h/7d/30d window grid, a
> caption explaining the (normal) counter-vs-ledger gap, and a refresh control;
> health at-a-glance is the existing status pill + "Last health" already in the
> drawer. **a11y pass:** dialog `aria-label`, `aria-label="Close"` on the icon-only
> close button, decorative material-symbols marked `aria-hidden`, `aria-label`ed
> refresh control. **Verified:** the exact rollup SQL run against the prod control DB
> for the live canary (`d8c73846…` → messages_used 53 / ledger_total 51 / last_24h 12
> — the ~2 gap is expected, the counter predates per-message metering, which is why
> both numbers are surfaced). Tests: backend store-level rollup (zero/empty,
> counts-N, idempotent-replay-not-double-counted, window-exclusion) + frontend
> component (loading/data/error/refresh). `tsc` clean; frontend `vitest` 286 green;
> backend `pytest tests/byod` 366 green (Postgres-backed rollup tests skip without
> Docker, as the rest of the suite does). UNCOMMITTED on MainV2.

---

## 5. Edge cases & exceptions (consolidated)

| Area | Case | Handling |
|---|---|---|
| Routing | Global kill on, DB flag on | Kill wins → no routing (master switch). |
| Routing | Toggle during live traffic | In-flight finish on old path; new requests flip within cache TTL (≤60 s) or instantly on explicit invalidation. |
| Routing | Enable a non-LIVE tenant | 409 — must be provisioned+healthy first. |
| Secrets | DSN in logs/responses | Impossible by construction — validated→encrypted→masked; audit is DSN-free. |
| AuthZ | Client hits another company's data | Prevented — client routes resolve company from session, no id param (no IDOR). |
| Auth | Admin JWT expires mid-provision | Detect stale-admin 401 → refresh/step-up → retry. |
| Provision | Double submit | Server advisory-lock serializes; re-submit once LIVE is a no-op. |
| Onboarding | Bad DSN (SSRF/TLS/param) | 400 with sanitized message; nothing stored. |
| Onboarding | DB unreachable from egress | Probe error → "allowlist 74.220.48.0/24 + 74.220.56.0/24." |
| Onboarding | pgvector missing / < 0.5.0 | Probe error surfaced; client must install/upgrade. |
| Lifecycle | Client password rotated | Status → NEEDS_RECONNECT; client re-enters DSN (re-onboard) → admin re-provisions. |
| Lifecycle | Client leaves | switch-out (reverse-migrate, tenant read-only) or offboard (documented loss) — admin-run; client DB never deleted. |
| KMS | Encryption service down | 503 on connection/provision; existing DSN cache rides short blips for live tenants. |
| Migration | Rollout of the routing change | Additive column defaults FALSE (dark); env-canary OR-fallback for one release; no behaviour change until a row is explicitly enabled. |

---

## 6. Testing strategy

- **Backend unit:** routing truth table (status × routing_enabled × global kill);
  cache invalidation on each mutation; `list_all_tenants` shape; client-endpoint
  authz (own-company-only, entitlement gate, no-id-param IDOR test); DSN reuse path.
- **Backend integration (throwaway PG, as the existing BYOD suite does):**
  enable→chat lands on tenant DB; disable→chat lands on shared DB (UI-driven C1);
  client `connection` only accepted in PENDING/NEEDS_RECONNECT.
- **Frontend:** component/interaction tests for the wizard (Test pass/fail states),
  the toggle (confirm + disabled-when-not-LIVE), stale-admin retry; responsive
  snapshots at mobile + desktop.
- **Regression:** the existing `tests/byod/*` suite must stay green (no change to the
  dark-by-default contract until a row is explicitly enabled).

---

## 7. Out of scope now / future

- **D2 billing automation:** auto-enroll on a subscription/payment webhook (a
  subscription-status model already exists in the admin UI — ACTIVE/AWAITING_PAYMENT/
  …). Wire later; manual `enroll` covers the first clients.
- **Multi-bot BYOD** (BYOD caps `max_bots = 1` today).
- **Self-service plan purchase/checkout** for BYOD (admin-assigned for now).

---

## 8. Suggested build order (smallest hectic-free steps)

1. Phase 1 (read-only view) — ship, see the fleet in-app.
2. Phase 2 (admin action buttons) — ship, full lifecycle without curl.
3. Phase 3 (DB on/off switch) — ship, kill the Render-edit step.
4. Phase 4 (client self-onboard) — ship, clients bring their own DB in-app.
5. Phase 5 (client status + reconnect).
6. Phase 6 (metering/usage + polish).

Phases 1–2 are pure additive frontend over existing endpoints (very low risk);
Phase 3 is the only hot-path change and is gated behind a dark-by-default column +
a backwards-compat fallback + a full test matrix.
