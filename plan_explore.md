# Explore Plan — Full Product & Engineering Specification

**Status:** Proposed (planning only — no code written yet)
**Author:** Product planning session
**Date:** 2026-06-09
**Owner:** Ayush Satvara (Founder)
**Branch for implementation:** `claude/vaayu-marketing-strategies-TmqMM`

> **Guiding principle for everyone touching this plan:** Do not hallucinate behavior.
> Every limit, gate, and message exists for one of three reasons — it protects a
> real cost, it improves the customer experience, or it drives curiosity/conversion.
> If a rule serves none of those, question it. Edge cases are called out explicitly
> because some exceptions cause errors and some exceptions are actually *features*.

---

## ⭐ Decisions Locked — v2 Blueprint (2026-06-09, supersedes any conflicting text below)

> This section is **authoritative**. Where older prose below (esp. §1.5, §2.2, §3) conflicts with
> these decisions, **these win.** Four product decisions were locked with the founder and one
> external dependency (Polar) was verified against code + docs before this revision.

### D1 — Explore is a $0 Polar subscription (the "Hybrid")
Every user MUST have an **active subscription to enter the dashboard** — including a free **"Explore"
plan that is a real $0 Polar product.** There is no dashboard-without-a-plan path.
- **Why:** unifies all tiers on one source of truth (Polar) and one reset clock; reuses the existing
  Polar webhook → `users.tier / subscription_status / billing_period_end` pipeline
  (`main.py` ~6879) instead of building a parallel free-tier path.
- **Provisioning method (IMPORTANT):** Explore is granted by **creating the free subscription via the
  Polar API** (create/lookup customer → create subscription on the free product), **NOT** by sending
  the user through the hosted checkout. This (a) makes the business-email grant instant with no
  redirect, and (b) sidesteps any "does a $0 hosted checkout prompt for a card?" risk entirely. The
  hosted checkout stays for PAID tiers only.

### D2 — Monthly reset is a fixed 30-day rolling window (NOT the Polar billing period) ✅ IMPLEMENTED
Reset `messages_used` (and later `owner_emails_sent`) when the usage window elapses — i.e. when
`now() >= usage_tracking.period_end`. On reset, open a fresh 30-day window. **On-read self-heal** — mirror
the existing grace-period downgrade at `main.py:1590` ("No cron needed; self-healing on read").
- ⚠️ **CORRECTION (caught during implementation):** the earlier wording "anchor to Polar
  `billing_period_end`" is **WRONG for annual subscribers** — their `billing_period_end` is up to a year
  out, which would stretch the *monthly* message quota across the whole year (worse bug than the one we
  fix). The message quota is **per month regardless of billing cadence**, so the reset cadence is a fixed
  ~monthly (30-day) window, independent of monthly-vs-annual billing. For a monthly sub the two coincide.
- **Implementation (DONE):** pure decision logic in `sapybase_ai_engine/usage_period.py`
  (`should_reset_usage`, `fresh_period`); DB write `main._reset_elapsed_usage_periods(...)` wired into
  BOTH the chat quota gate (`main.py` ~2247, enforcement) and `/api/companies` (dashboard display).
  Idempotent (`period_end <= now` filter); non-fatal on error (never blocks chat). 12 unit tests +
  full-suite green (437 passed).
- **Side benefit:** zeroing the counter auto-clears the future "resting" state (§5.4 "month rollover →
  bot revives") for free.
- **Chunks do NOT reset** — stored-knowledge ceiling, counted from `company_knowledge` at ingest
  (`main.py:531`), untouched by the reset.
- **Accepted trade-off:** the reset day can drift a few days (a new window opens at the first read after
  expiry, traffic-dependent) instead of pinning to a calendar anniversary. Standard for usage quotas; a
  future refinement could pin it to the subscription start day.
- ⏳ **Deferred to Phase E:** `owner_emails_sent` joins the same reset once that column exists.

### D3 — New signups land in a distinct `PENDING` state (do NOT overload FREE)
A signed-up user with no active subscription = `subscription_status = PENDING`. The dashboard gate (D5)
redirects PENDING users to `/pricing`. The legacy `FREE` tier (`max_bots:0`) is retired from the signup
path.
- ⚠️ **Caution:** audit every `tier == "FREE" or tier is None` read (~15 in `main.py`) so PENDING is
  handled everywhere the old null/FREE state was — a missed branch = a gate bypass.

### D4 — Per-user Explore overrides live in the existing `custom_plan_config` JSONB
No new override columns. Reuse `custom_plan_config` JSONB for per-user message/chunk/owner-email limit
overrides and feature-flag overrides.
- ⚠️ **Caution:** the access gate + `has_entitlement` (`main.py:3059`, reads `PLAN_LIMITS[tier][flag]`)
  must be taught to read this JSONB for **EXPLORE** tier, not just CUSTOM.

### D6 — Explore is a RECURRING $0 subscription (not a one-time purchase)
Create the Explore plan in Polar as a **Subscription product priced Free ($0), monthly interval** —
NOT a one-time order.
- **Why:** the whole access model is subscription-based (`subscription_status`, `billing_period_end`,
  `subscription.created/updated` webhook → tier). A one-time $0 purchase emits an `order`, not a
  subscription — no status, no period, never flows through the webhook → would need bespoke plumbing.
  The existing recurring-product code (`main.py:5990`, `recurring_interval:"month"`) already fits.
- A recurring $0 sub stays `ACTIVE` forever; the lazy-downgrade only fires for `CANCELED` subs, so Explore
  never expires.
- **Interval is low-stakes** — the message quota resets on our own 30-day window (D2), NOT on Polar's
  billing period, so monthly-vs-yearly only changes $0-renewal event frequency. Monthly chosen to match
  existing code.
- **Grant via Polar API (create customer → create subscription), not hosted checkout** → card-free,
  instant. `POLAR_PRODUCT_ID_EXPLORE` env → already wired into `POLAR_PRODUCT_TIER_MAP`.

### D7 — Existing FREE users are PURGED + re-invited (NOT grandfathered/auto-migrated)
**Supersedes** all earlier "grandfather / auto-upgrade FREE → Explore" text (TL;DR, §3.1, §4.2). All FREE
users are personal emails (`@gmail.com`); none get an automatic Explore grant.
- **One-time operation:** delete all FREE users from **both the DB and Clerk** (tooling exists:
  `delete_from_clerk`, `scripts/production_purge.py`, `DELETE FROM users`), then email them to re-sign-up
  for Explore from scratch.
- On re-signup (personal email) they hit the **enquiry → super-admin approval** path (§3.4); on approval,
  API-provision the $0 Explore sub (D6).
- ⚠️ **Sequencing:** the purge + re-invite email must run **after** the enquiry + admin-approval flow
  (Phase B/C) ships — otherwise re-signups have no path to access.
- ⚠️ **Pre-purge safety check:** FREE is `max_bots:0` so data loss should be nil; before deleting, verify
  no FREE user has a `companies` / `usage_tracking` / `lead_capture` row. Log the deletion (data-deletion
  event).
- **Net:** removes the grandfather/migration code entirely; the go-live "migrate FREE users" step (D3/D5)
  becomes "purge FREE users".

### D3/D5 — Access gate ✅ BUILT (frontend gate dormant behind a flag)
- **Backend (LIVE, safe):** `access_gate.py::is_dashboard_access_allowed(role, tier)` is the single
  source of truth (denylist: block FREE/PENDING/null, allow Explore + paid + CUSTOM + SUPER_ADMIN).
  `require_premium_tier` refactored to use it — **behaviour-preserving** for today's tiers, additionally
  recognises EXPLORE as allowed and PENDING as blocked. 20 unit tests; full suite 457 green.
- **Frontend (DORMANT):** `src/lib/auth/accessGate.ts` mirrors the backend; the `dashboard/layout.tsx`
  redirect to `/pricing` is gated by env `EXPLORE_DASHBOARD_GATE` (default off).
- **A0 code (LIVE, safe):** `EXPLORE` added to `POLAR_PRODUCT_TIER_MAP` (no-op until
  `POLAR_PRODUCT_ID_EXPLORE` env is set — like ENTERPRISE today).
- ⚠️ **GO-LIVE SEQUENCE — do NOT set `EXPLORE_DASHBOARD_GATE=true` until ALL of:**
  1. A0 external: create the $0 Explore product in Polar + set `POLAR_PRODUCT_ID_EXPLORE`; sandbox-verify
     the `subscription.created` webhook maps it to EXPLORE.
  2. Phase B: signup routing provisions new users (business → $0 Explore; personal → enquiry/PENDING).
  3. Existing FREE users PURGED (DB + Clerk) + re-invited (D7) — NOT migrated/grandfathered.
  Enabling the gate before these locks out every existing FREE user and every new signup (they default
  to FREE/null → blocked → /pricing with no way to get a plan).
- ✅ **RESOLVED (B3a):** PENDING is a **`subscription_status`**, NOT a tier. New signups keep `tier='FREE'`
  (gate already blocks FREE/null; `PLAN_LIMITS` lookups stay valid) and get `subscription_status='PENDING'`
  (`BLOCKED` for disposable/invalid). Chosen because `subscription_status` is already a free-form string
  taking ~12 values and the only equality check is `==CANCELED`; making PENDING a tier would have risked
  the ~15 `tier=="FREE"/None` reads (all use `PLAN_LIMITS.get(... , FREE)`, so they'd silently mis-apply
  FREE limits — semantically wrong). Stamped in the JIT INSERT (`main.py` ~1577).

### D5 — Dashboard access gate (NEW — does not exist today)
Verified gaps: middleware (`src/proxy.ts`) only enforces login (`auth.protect()`); `dashboard/layout.tsx:13`
only redirects unauthenticated users; **no tier/subscription gate exists**; backend `require_premium_tier`
guards just 2 endpoints (`main.py:1948`, `:4403`). A logged-in PENDING/FREE user reaches the full dashboard
shell today. Build:
- **Frontend:** in the dashboard layout (and/or `proxy.ts`), after the auth check, redirect any user
  **without an active subscription** (PENDING / none) → `/pricing`.
- **Backend:** broaden the gate from "is tier paid?" to "**is there an active subscription (Explore $0 or
  paid)?**" — Explore is now a valid active state; PENDING is the only blocked state.
- **Pricing CTA branch:** business-email users → API-provision $0 Explore (no checkout). Personal-email →
  enquiry form (§3.4), NOT checkout. Paid tiers → existing Polar checkout (`dashboard/pricing/page.tsx:141`).

### Polar verification result (the load-bearing check — DONE)
- ✅ Polar supports a first-class **Free ($0) price type** (`ProductPriceFree`, `amount_type:"free"`),
  documented for "free tiers / gating benefits behind a sign-up" — our exact use case.
- ✅ Free subscriptions carry **`current_period_start` / `current_period_end`** → a real recurring period
  to anchor D2's reset on.
- ✅ Free subscriptions can be **created via API without a hosted checkout** → enables D1's instant,
  card-free grant.
- ⚠️ **One sandbox check before Phase B:** confirm in a Polar test org that an API-provisioned free
  subscription emits `subscription.created` (active status + period dates) into our existing webhook
  handler (`main.py:6879`). Hosted-$0-checkout card behavior is moot — we provision via API.

---

## 0. TL;DR — What We're Building

A **lifetime-free "Explore" plan** that is the new top of the funnel for Vaayu by Sapybase.

- **Full product experience** — every feature ON (analytics, lead capture, WhatsApp/human
  handoff, webhooks, custom logo/appearance, system prompt/advanced bot) **except**
  white-label. The **"Powered by Vaayu Intelligence"** badge is permanent on this plan.
- **Cost-bearing dimensions are capped:** 1 bot, **200 messages/month**, **75 knowledge
  chunks**, `lite` model (cheapest), and **50 owner-emails/month**.
- **Lifetime, not a trial** — removes "should I invest in this?" hesitation; every deployed
  bot becomes a permanent live "Powered by Vaayu Intelligence" ad.
- **Business email = instant self-serve grant.** **Personal email (gmail/yahoo/etc.) = enquiry
  form + one-click admin approval.** This filters intent and protects LLM cost.
- **Existing FREE users auto-upgrade to Explore** (with welcome email). Existing personal-email
  users are **grandfathered** — they keep Explore even though new personal-email signups must apply.
- **"Resting" state** when the 200-message limit is hit: the bot politely says it's resting,
  shows an inline lead-capture form, and emails the lead to the owner with an upgrade CTA —
  *"your plan limit reached, upgrade for higher limits, but we got you the lead anyway."*
- **Public launch is staged.** The pricing surfaces show **"Explore — Coming Soon"** first,
  while the backend, admin tooling, and abuse guards are validated.
- **Super admin gets full authority** to customize any limit/feature for any customer from one
  redesigned Manage panel — saving time and avoiding custom-plan complexity for one-off grants.

---

## 1. Current State (Verified Against Code — Not Assumed)

### 1.1 Plan definitions — backend source of truth
`sapybase_ai_engine/config.py` → `PLAN_LIMITS`:

| Tier | max_bots | messages | chunks | speed | lead_capture | analytics | white_label | webhook | human_handoff | custom_logo |
|---|---|---|---|---|---|---|---|---|---|---|
| FREE | 0 | 0 | 0 | none | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| STARTER | 1 | 1,500 | 300 | standard | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PRO | 3 | 5,000 | 1,500 | priority | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| BUSINESS | 5 | 15,000 | 5,000 | ultra | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ENTERPRISE | 999 | 999,999 | 99,999 | dedicated | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

- `MODEL_MAPPING`: FREE→`gemini-2.5-flash-lite`, STARTER→`gemini-2.5-flash`, PRO/BUSINESS/ENTERPRISE→`gemini-2.5-pro`.
- `TIER_RATE_LIMITS`: per-minute/hour/day anti-abuse caps. `CUSTOM` default = 100/3000/18000.
- `CUSTOM_PLAN_FEATURE_KEYS` = `advanced_bot, human_handoff, lead_capture, white_label, webhook, custom_logo, analytics`.
- `CUSTOM_PLAN_DEFAULTS` already includes `max_owner_emails`? **No — it does not.** This is a new dimension we add (§4.3).
- Re-exported in `main.py` line 479: `from config import PLAN_LIMITS, MODEL_MAPPING, VALID_MODELS, UNLIMITED_PLAN`.

### 1.2 Frontend entitlements mirror
`src/lib/auth/entitlements.ts` — the frontend source of truth that **must** mirror `config.py`.
Maps flags → `canUseCustomLogo`, `canWhiteLabel`, `canUseWebhooks`, `canUseHumanHandoff`,
`canUseLeadCapture`, `canUseAnalytics`, `canUseAdvancedBot`.

### 1.3 Pricing surfaces (ALL must be updated — verified)
1. **Marketing pricing page** `/pricing`:
   - `src/app/(app)/(site)/pricing/PricingClient.tsx` — renders cards + comparison + FAQ.
   - `src/app/(app)/(site)/pricing/components.tsx` — **canonical data**: `PRICE_MATRIX`, `PLANS`,
     `COMPARISON_FEATURES`, `FEATURE_DESCRIPTIONS`, `FAQS`. Hero stat says **"Plans: 4+"**.
   - ⚠️ **Bug to fix while here:** `FEATURE_DESCRIPTIONS` / `COMPARISON_FEATURES` / `FAQS` still say
     **"remove Sapybase"** and "Sapybase branding" — brand is now **Vaayu Intelligence**. Update copy.
2. **Homepage pricing preview** `src/components/marketing/PricingPreview.tsx` — imports `PLANS` +
   `PRICE_MATRIX`; filters to `PREVIEW_PLAN_IDS = ['STARTER','PRO','BUSINESS']`.
3. **In-app dashboard pricing** `src/app/(app)/dashboard/pricing/page.tsx` — **has its OWN duplicated**
   `PRICE_MATRIX` and `plans` array (NOT imported from `components.tsx`). Must be updated separately.
4. **Homepage** `src/app/(app)/(site)/page.tsx` and product page `src/app/(app)/(site)/vaayu/page.tsx` —
   reference pricing/plan language (verify and align messaging during implementation).
5. **Navbar** `src/app/components/Navbar.tsx` — has a Pricing link (no plan data, no change needed
   beyond confirming the link target).

### 1.4 Super admin panel (verified)
`src/app/(app)/dashboard/settings/admin/page.tsx` (1355 lines) + `layout.tsx` (SUPER_ADMIN gate).
- **3 tabs:** All Users · Custom Plans · Metrics.
- **5 header stat cards:** total users, total bots, active bots, total messages, custom plan count.
- **All Users tab:** search, tier filter buttons (`ALL FREE STARTER PRO BUSINESS ENTERPRISE CUSTOM`),
  table with email/clerk_id, tier badge, account status, single message-usage bar, Manage slide-over.
- **Manage slide-over:** tier dropdown, account status toggle, custom-plan builder with **7 feature
  toggles** (only meaningfully exposed for CUSTOM tier), model + token pickers, Polar provision.
- **Custom Plans tab + Metrics tab:** subscription status, Polar reconciliation, alerts.
- **Endpoints used:** `GET /api/admin/users`, `/api/admin/stats`, `/api/admin/custom-plan/dashboard`,
  `/api/admin/custom-plan/metrics`; `PATCH /api/admin/users/{clerk_id}`,
  `/api/admin/users/{clerk_id}/custom-plan/override`; `POST .../custom-plan/provision`,
  `/api/admin/custom-plan/reconcile`.
- **No Explore / freemium / enquiry controls exist today.**

### 1.5 Custom plan access-gate machinery (reuse, don't reinvent)
`docs/runbooks/custom_plan_flow.md` documents a webhook-driven state machine, access gate,
admin override, and audit logging via `admin_audit_log`. Explore reuses the **audit-log** and
**admin-override** patterns.
- **(v2 — see D1, supersedes earlier text):** Explore **IS** a $0 Polar product, **API-provisioned**
  (not via hosted checkout). It flows through the existing Polar webhook → `users` pipeline
  (`main.py:6879`), so tier/`subscription_status`/`billing_period_end` are set the same way as paid tiers.

---

## 2. The Explore Plan — Final Definition

### 2.1 Limits & features

| Dimension | Explore value | Category | Rationale |
|---|---|---|---|
| `max_bots` | **1** | Cost | Each bot = infra + index overhead |
| `messages` / month | **200** | Cost | Every message = a paid LLM call |
| `chunks` | **75** | Cost | Embeddings + vector storage cost money; ≈10–15 pages |
| `speed` / model | **`lite`** (`gemini-2.5-flash-lite`) | Cost | Cheapest model; upgrade = smarter/faster |
| `max_owner_emails` / month | **50** | Cost | Resend bills per email; abuse backstop (NEW dimension) |
| `advanced_bot` | ✅ ON | Free to us | System prompt, tone, quick questions = config only |
| `lead_capture` | ✅ ON | Free to us | Config only; core to the value story |
| `analytics` | ✅ ON | Free to us | Reads data we already store |
| `webhook` | ✅ ON | Free to us | Config only |
| `human_handoff` (WhatsApp) | ✅ ON | Free to us | Config only |
| `custom_logo` (custom UI/appearance) | ✅ ON | Free to us | Config only |
| `white_label` | ❌ **OFF — permanent** | Strategic | "Powered by Vaayu Intelligence" is the viral engine |

**The single hard rule:** On Explore, `white_label` is `False` and cannot be enabled through any
self-serve path. Only a super admin can override it, and only with a logged reason (§6, §7.4).

### 2.2 Lifetime, period-anchored reset  *(REVISED — see D2)*
- Explore never expires (the $0 Polar subscription renews indefinitely).
- **Reset trigger = Polar billing period rollover**, NOT a calendar 1st. Reset `messages_used` and
  `owner_emails_sent` when `now() > billing_period_end` (= Polar `current_period_end`). Implement as an
  **on-read self-heal** (mirror `main.py:1590`).
- ⚠️ **The reset action does not exist in the code today** — `messages_used` is a per-row rolling 30-day
  window that is never zeroed (`main.py:2314`). Build it in Phase A. Applies to ALL tiers (uniform fix).
- ⚠️ **Chunks are NOT a reset counter** — stored-knowledge ceiling, enforced at ingest (`main.py:531`,
  reads `max_chunks`). Only messages + owner-emails reset.

### 2.3 Model / rate limits
- `MODEL_MAPPING["EXPLORE"] = "gemini-2.5-flash-lite"`.
- `TIER_RATE_LIMITS["EXPLORE"] = { per_minute: 20, per_hour: 200, per_day: 1200 }` — generous for one
  real bot, tight enough to bound a single key-replay abuse burst.

---

## 3. Signup Routing — Business vs Personal Email

### 3.1 The decision at signup  *(REVISED — see D1, D3, D5)*
```
User signs up via Clerk (email captured; account auto-provisioned, main.py:1530)
      │  Initial state: subscription_status = PENDING  (NOT FREE — see D3)
      │  Dashboard gate (D5) holds PENDING users at /pricing until they have an active sub.
      │
      ├─ Normalize domain (lowercase, strip sub-domain, trim)
      │
      ├─ Domain in DISPOSABLE_EMAIL_DOMAINS?  ──► HARD BLOCK (abuse) — show "use a real email"
      │
      ├─ Domain in FREE_EMAIL_DOMAINS (personal)?
      │        YES ──► stay PENDING, route to ENQUIRY flow (§3.4). On approval →
      │                API-provision $0 Explore subscription (same path as below).
      │        NO  (business) ──► API-provision $0 Explore Polar subscription
      │                (create/lookup customer → create free subscription); the Polar
      │                webhook sets tier=EXPLORE + ACTIVE + billing_period_end; welcome
      │                email; dashboard gate now opens. NO hosted checkout, NO card.
```
- **PENDING** = account exists, no active subscription, blocked from the dashboard (redirected to
  `/pricing`). Replaces the vestigial `FREE` tier in the signup path.
- The "signup hook" is the **Clerk JIT auto-provisioning path** (`main.py:1514`/`:1530`), not a clean
  registration endpoint — classify domain and provision there.

### 3.2 `FREE_EMAIL_DOMAINS` (launch list — store as config array, not hardcoded in logic)
```
gmail.com, googlemail.com, yahoo.com, yahoo.co.in, yahoo.co.uk, ymail.com, rocketmail.com,
hotmail.com, hotmail.co.uk, outlook.com, live.com, msn.com, icloud.com, me.com, mac.com,
aol.com, protonmail.com, proton.me, gmx.com, gmx.net, mail.com, yandex.com, yandex.ru,
tutanota.com, hey.com, zoho.com, fastmail.com, pm.me
```

### 3.3 `DISPOSABLE_EMAIL_DOMAINS` (launch list — extend over time)
```
mailinator.com, 10minutemail.com, guerrillamail.com, temp-mail.org, tempmail.com, trashmail.com,
getnada.com, throwawaymail.com, yopmail.com, sharklasers.com, dispostable.com, maildrop.cc
```
- Static list covers ~95%. **Do not add an external disposable-check API at launch** (new dependency,
  new failure mode, new latency). Revisit only if abuse data shows it's needed.

### 3.4 Enquiry flow (personal email)
Screen copy (positioning, not rejection):
> **"Explore is built for businesses and agencies."**
> *Tell us about yours and we'll set you up with lifetime free access — analytics, lead capture,
> WhatsApp handoff, and the full Vaayu Intelligence platform.*

Form fields → `POST /api/explore/enquiry`:

| Field | Required | Purpose |
|---|---|---|
| Name | ✅ | Personalization |
| Email | ✅ (pre-filled, read-only) | Contact |
| Company / Agency name | ✅ | Qualify |
| Website or social link | ✅ | The real filter — proves a real business |
| What will you use Vaayu for? | ✅ | Intent + you learn use cases |
| Expected monthly visitors | optional | Lead sizing |
| Honeypot field (hidden) | n/a | Bot-spam trap — if filled, silently drop |

On submit:
1. Persist to new `explore_enquiries` table (status `PENDING`).
2. Email **you** via Resend with the details + **one-click Approve / Decline buttons** (§6).
3. Show applicant a confirmation: *"Thanks! We review applications within 24 hours. Watch your inbox."*

### 3.5 Open question (needs your call before coding)
- **FREE-PENDING capabilities:** While a personal-email applicant waits for approval, can they
  configure a bot in draft (but not embed it live), or is the whole dashboard locked behind approval?
  *Recommendation:* allow draft configuration (builds investment + reduces approval-to-value time),
  block only the live embed + message-serving until approved.

---

## 4. Backend Changes (Specification — no code yet)

### 4.1 `config.py`
- Add `EXPLORE` to `PLAN_LIMITS` per §2.1 (all flags true except `white_label`; `messages:200`,
  `chunks:75`, `speed:"lite"`, **new** `max_owner_emails:50`).
- Add `MODEL_MAPPING["EXPLORE"] = "gemini-2.5-flash-lite"`.
- Add `TIER_RATE_LIMITS["EXPLORE"] = {per_minute:20, per_hour:200, per_day:1200}`.
- Add `FREE_EMAIL_DOMAINS` and `DISPOSABLE_EMAIL_DOMAINS` arrays.
- Add `max_owner_emails` to `CUSTOM_PLAN_DEFAULTS` (so custom plans can set it too; default e.g. unlimited).
- ⚠️ **Schema-shape consistency:** every tier dict in `PLAN_LIMITS` must have the **same keys** or the
  test suite (`test_plan_limits.py`) and any `dict[...]` access in `main.py` may break. Adding
  `max_owner_emails` to EXPLORE means deciding its value for **every** other tier (e.g. paid tiers =
  a large/unlimited sentinel). Audit all `PLAN_LIMITS[...]["..."]` reads first.

### 4.2 `main.py`
- **Signup hook:** classify domain → grant EXPLORE or create enquiry (§3.1).
- **Message-limit path:** when `messages_used >= limit` for EXPLORE, return the **resting** response
  (`{type:"resting", show_lead_form:true, reset_date, company_name, bot_name}`) instead of the generic
  402 `MESSAGE_LIMIT_EXCEEDED`. Other tiers keep existing behavior.
- **New endpoints:**
  - `POST /api/explore/enquiry` — save + notify (rate-limited, honeypot-checked).
  - `POST /api/admin/explore/enquiries/{id}/approve` (authed) and a **token variant** for the email
    button (signed, single-use, 72h JWT).
  - `POST /api/admin/explore/enquiries/{id}/decline` — reason + decline email.
  - `POST /api/widget/resting-lead` — save lead + email owner (respects 50/mo cap), returns confirmation.
  - `PATCH /api/admin/users/{clerk_id}/explore-override` — per-user limit overrides.
  - `POST /api/admin/users/{clerk_id}/reset-counters` — force monthly counter reset.
  - `PATCH /api/admin/users/{clerk_id}/feature-flags` — override any flag for any tier.
  - `POST /api/admin/users/{clerk_id}/temp-unlimited` — time-boxed unlimited grant.
  - `GET /api/admin/explore/enquiries` and `GET /api/admin/explore/metrics`.
- **FREE → EXPLORE migration** (one-time, idempotent): every `tier="FREE"` user → `tier="EXPLORE"`,
  send welcome email. Personal-email FREE users are **grandfathered** (migrated to Explore regardless
  of domain) — flag them `signup_source="grandfathered"` for the audit trail.

### 4.3 Database
- **New table `explore_enquiries`:** `id, clerk_id (nullable until account exists), name, email,
  company, website, use_case, expected_visitors, status (PENDING|APPROVED|DECLINED), decline_reason,
  honeypot_tripped (bool), created_at, reviewed_at, reviewed_by`.
- **New column(s) on users (or usage table):** `owner_emails_sent` counter + its reset bookkeeping;
  `signup_source` (`business_auto | enquiry_approved | grandfathered`); optional per-user override
  columns OR store overrides inside existing `custom_plan_config` JSONB (decide §11 Q3).
- **Resting-lead storage:** leads are saved even when the 50/mo email cap is hit (storage is free) —
  reuse existing lead-capture storage if present; confirm schema in `main.py` before adding new tables.
- **Migration safety:** additive, nullable columns; new table; no destructive changes. FREE→EXPLORE
  update must be idempotent (safe to re-run) and run inside a transaction.

### 4.4 Email (Resend) — 4 templates
1. **Welcome** (auto-grant + approved enquiry + grandfathered migration) — *"Your Vaayu Intelligence
   platform is live, free forever. Here are your first 3 steps."*
2. **Enquiry received (to you)** — details + Approve/Decline buttons (signed tokens).
3. **Enquiry approved (to applicant)** — *"You're in! Lifetime Explore access is ready."*
4. **Resting-state lead (to bot owner)** — the trust email (§5.3).
- ⚠️ **Cost note:** templates 1 and 4 are the volume drivers. Template 4 is capped at 50/mo/owner.
  Template 1 fires once per user lifetime. Keep Resend "from" domain verified to avoid spam folder.

---

## 5. The "Resting" State (Confirmed Behavior)

Triggered when an Explore bot reaches **200 messages** in the current month.

### 5.1 Widget changes (3 simultaneous)
1. **Header status:** `🟢 Active` → `🟡 Resting` (amber, not red — temporary, not broken).
2. **Bot reply** to the next visitor message (no LLM call — it's a canned response):
   > *"I've reached my monthly conversation limit and I'm taking a quick rest ☕. Leave your name,
   > email, and question below and [Company Name] will get back to you personally."*
3. **Inline lead form** appears in-chat: **Name · Email · Question** (question pre-filled with what
   they typed). Submit button: **"Send to [Company Name]"**.

### 5.2 Submit path
`POST /api/widget/resting-lead` → save lead (always) → if `owner_emails_sent < 50` send owner email and
increment; else skip email but keep the lead and surface it in the owner dashboard.
Widget then shows: *"Sent! [Company Name] will be in touch."*

### 5.3 Owner email (the trust moment)
Subject: `🎉 New lead from your Vaayu bot — [Visitor Name] has a question for you`
Body includes visitor name/email/question, the monthly reset date, and a single CTA:
**Upgrade to Starter ($19, 1,500 messages)** with a direct dashboard link. Framing: *"Your plan limit
was reached — but we captured this lead for you anyway. Upgrade so your bot never rests."*

### 5.4 Edge cases (the exceptions that matter)
- **Visitor submits multiple times / spams the form:** dedupe by (bot_id, email) within a short window;
  count toward the 50/mo email cap; honeypot + per-IP rate limit on `/api/widget/resting-lead`.
- **Email cap (50) hit mid-month:** leads still saved (free); owner sees an in-dashboard note —
  *"Monthly lead-email limit reached. Leads are still saved here. Upgrade for unlimited lead emails."*
  This is a **second, independent upgrade trigger** — an exception that benefits the product.
- **Bot has no owner email on file:** fall back to the account email; if none, save lead only + alert
  in dashboard. Never silently drop a lead.
- **Resting reply must not cost an LLM call** — it's a static template, gated *before* the model call.
- **Month rollover while resting:** on reset, status flips back to `🟢 Active` automatically; no manual
  action. Confirm the reset job re-evaluates resting bots.
- **Owner upgrades mid-rest:** upgrading to a paid tier must immediately clear the resting state and
  restore normal replies (re-evaluate tier on next message).

---

## 6. Admin Enquiry Approval — One-Click

- The "Enquiry received" email to you contains **[✅ Approve & Send Welcome]** and **[❌ Decline]**
  buttons. Each carries a **signed, single-use, 72h-expiry token** → hits the token endpoint, no login
  required (approve from your phone in 2 seconds).
- Approve → create/flip account to EXPLORE, send welcome email, mark enquiry `APPROVED`, audit-log.
- Decline → require a short reason, send decline email, mark `DECLINED` (kept for audit, never deleted).
- Mirror both actions in the **Explore Enquiries** admin tab (§7.2) for when you're at the desk.
- **Edge cases:** token reuse (reject, already-actioned), token expiry (link to dashboard tab instead),
  enquiry actioned in dashboard before email click (show "already approved"), duplicate enquiries from
  same email (collapse to one pending row).

---

## 7. Super Admin Panel — Full Authority Redesign

Goal: the super admin can change **anything** for **any** customer from one place — to save time and
avoid building a whole custom plan for one-off grants. Every change is audit-logged.

### 7.1 Header stat cards: 5 → 7
Add **Explore Users** and **Pending Enquiries** (the latter shows an amber pulsing dot when > 0).

### 7.2 Tabs: 3 → 4 (add **Explore Enquiries**)
- Filters: All · Pending · Approved · Declined; search by email/company.
- Columns: Applied (relative time) · Name+Email · Company/Website (link) · Use case · Expected traffic ·
  Status · **[Approve] [Decline]**.
- Approve/Decline here call the same endpoints as the email buttons (optimistic UI).

### 7.3 All Users tab updates
- Add `EXPLORE` to the tier filter row (distinct color, e.g. teal).
- Replace the single message bar with a **triple usage bar** (Messages / Chunks / Owner-emails),
  showing only dimensions relevant to that user's tier.
- Add inline status pills: `🟡 Resting`, `📋 Enquiry`, `🆙 Grandfathered`.

### 7.4 Manage slide-over — redesigned into 6 sections
- **A. Account Identity** (read-only): email, clerk_id, created date, `signup_source`, status toggle.
- **B. Plan & Tier Control:** tier dropdown now includes `EXPLORE`; changing to EXPLORE auto-expands
  Section D; changing to CUSTOM shows the existing custom builder.
- **C. Feature Flags for ANY tier:** the 7 toggles, now available for every tier (not just CUSTOM),
  each labeled `TIER DEFAULT` (grey) or `OVERRIDDEN` (amber) so it's never ambiguous.
  **White-label guard:** enabling `white_label` on an EXPLORE user requires a typed reason and a
  confirmation warning ("removes the Vaayu Intelligence badge / viral loop"). Audit-logged.
- **D. Explore Overrides** (only when tier=EXPLORE): editable **message / chunk / owner-email** limits
  with min/max guards (`messages 50–2000`, `chunks 10–500`, `emails 0–999`); **[Force Reset Counters
  Now]**; shows next auto-reset date.
- **E. Usage & Activity** (read-only): live triple usage bars, bot status (`🟡 RESTING since …`),
  last activity, leads captured this month, and a **Tier History** log (each change + trigger).
- **F. Quick Actions:** Force Reset Counters · Resend Welcome Email · Copy Dashboard Link ·
  **Grant Temporary Unlimited** (duration + reason, auto-reverts) · Suspend · Reactivate · Approve Enquiry.

### 7.5 Metrics tab — add Explore section
Explore users (split: business-auto / enquiry-approved / grandfathered), bots currently resting (and
how many hit the limit today), conversions to paid this month (→Starter/→Pro/→Business), pending
enquiries (with jump link), avg messages used/month.

### 7.6 Authority & safety rails
- All override/reset/temp-unlimited/flag/approve actions write to `admin_audit_log` with admin
  clerk_id, before→after diff, and reason (reason required for overrides + white-label + temp-unlimited).
- Limit inputs are server-validated against the min/max guards — never trust the client.
- Temp-unlimited must auto-revert (store `expires_at`; a scheduled job or on-read check reverts).
- **Edge case (beneficial exception):** super admin can intentionally raise an agency's Explore message
  cap (e.g., 200 → 500) for a key partner without upgrading them — a deliberate goodwill lever, fully logged.

---

## 8. Frontend Changes (Specification — no code yet)

### 8.1 Pricing surfaces — "Explore — Coming Soon" first, then live
Phase 1 ships **Coming Soon** everywhere pricing shows; Phase 2 flips it to a live, signup-able plan.

1. **`components.tsx` (canonical):**
   - Add `EXPLORE` to `PRICE_MATRIX` as `{USD:0, INR:0}` (renders "Free").
   - Add an `EXPLORE` entry to `PLANS` (id `EXPLORE`, name "Explore", badge `"Coming Soon"` in Phase 1
     → `"Free Forever"` in Phase 2, accent e.g. teal, feature list per §2.1).
   - Add an `explore` column to every `COMPARISON_FEATURES` row (values per §2.1; `white_label:false`).
   - Update `FEATURE_DESCRIPTIONS` + `FAQS`: fix **"Sapybase" → "Vaayu Intelligence"** branding, add an
     FAQ: *"Is Explore really free forever?"* and *"Why do I need a business email for Explore?"*.
   - Update hero stat in `PricingClient.tsx` (`Plans: 4+` stays accurate; comparison auto-renders the
     new column).
2. **`PricingClient.tsx`:** when a plan's badge is `"Coming Soon"`, render the CTA as a disabled
   **"Coming Soon"** button (no checkout). Default-select Explore in the comparison so visitors see it.
3. **`PricingPreview.tsx` (homepage):** add `EXPLORE` to `PREVIEW_PLAN_IDS` (becomes 4 cards) OR keep 3
   paid + a slim "Explore — Coming Soon, free forever" banner above. *Recommendation:* slim banner in
   Phase 1, full card in Phase 2.
4. **`dashboard/pricing/page.tsx`:** has its **own duplicated** `PRICE_MATRIX` + `plans` — add Explore
   there too (Coming Soon → live). Long-term cleanup: import from `components.tsx` to kill the
   duplication (note as tech-debt, not required for launch).
5. **Homepage `(site)/page.tsx` + `vaayu/page.tsx`:** add a "Coming Soon: Explore — the full platform,
   free forever" teaser to build curiosity pre-launch.

### 8.2 Signup / enquiry UI
- Email-based branch on signup; personal-email → enquiry form (§3.4) → confirmation screen.
- Business-email → straight into onboarding with EXPLORE active.

### 8.3 Widget
- Handle the `resting` response: amber status, canned reply, inline lead form, confirmation (§5).

### 8.4 Dashboard (owner)
- Triple usage bars (messages 200 / chunks 75 / lead-emails 50).
- 80% nudge ("Upgrade to Starter to avoid resting mode") and 100% banner ("Your bot is resting").
- Lead-email-cap note when 50 reached (§5.4).

### 8.5 Entitlements mirror
- `src/lib/auth/entitlements.ts` — add EXPLORE tier mapping; must exactly match `config.py`.

---

## 9. Cost, Customer, Curiosity — The Product-Owner Ledger

| Lever | Cost control | Customer experience | Curiosity / conversion |
|---|---|---|---|
| 200 msgs + lite model | Caps LLM spend (~$0.01–0.04/user/mo) | Enough to feel real value | Hitting the cap = upgrade moment |
| 75 chunks | Caps embedding/storage | 10–15 pages = a real bot | "Need more knowledge?" → upgrade |
| 50 owner-emails | Caps Resend spend / abuse | Leads still saved (never lost) | Email cap = 2nd upgrade trigger |
| Business-email gate | Filters low-intent/cost drains | Frictionless for real buyers | "For businesses" = exclusivity |
| Personal-email enquiry | Manual cost gate | Feels like an application, not a no | Scarcity → desire |
| Permanent Vaayu badge | — | — | Every bot = a live ad (viral loop) |
| Lifetime (not trial) | Negligible extra cost | No expiry anxiety → full investment | Switching cost = retention moat |
| Coming-Soon staging | Validate before scale spend | No broken first impression | Builds a waitlist of anticipation |

**Worst-case cost at 2,000 lifetime free users:** ~$20–80/mo LLM + bounded Resend. Cheapest acquisition
channel you will ever run.

---

## 10. Implementation Phases

| Phase | Scope | Risk |
|---|---|---|
| **A** | `config.py` EXPLORE tier + `max_owner_emails` across all tiers + domain lists + entitlements mirror + **period-anchored counter RESET (D2 — new, applies to all tiers)** + **`PENDING` status + dashboard access gate (D3/D5)** + FREE→EXPLORE migration (grandfather, via $0 sub) + tests | **Medium** (reset + gate are new core mechanisms, not additive — audit all `PLAN_LIMITS` + `tier=="FREE"` reads) |
| **A0** | **Polar setup:** create the $0 "Explore" free product; sandbox-verify `subscription.created` + period dates land in the existing webhook handler (`main.py:6879`); build the **API-provision** helper (create customer → free subscription) | Low–Medium (external dependency gate for B) |
| **A0 ✅ product created** | `POLAR_PRODUCT_ID_EXPLORE` set in `.env.local` → `POLAR_PRODUCT_TIER_MAP` now maps it to `EXPLORE` (verified: map shows EXPLORE). **Still to do:** API-provision helper (create customer → free sub) + sandbox-verify the webhook flow end-to-end. | — |
| **🔻 DECISION (A0 mechanism)** | **Chosen: hosted Polar $0 checkout, NOT an API provision helper.** Business email → click Explore → Polar checkout (email only, no card) → `subscription.created` webhook grants EXPLORE. **Key finding:** the existing `/api/webhooks/polar` handler ALREADY grants any standard tier (incl. EXPLORE) on `subscription.created` — UPSERTs `tier, status=ACTIVE, billing_period_end=current_period_end`, resolving the user via `customer.external_id`=clerk_id. So no provision-helper code was needed; just CTA wiring. **Monthly reset to be Polar-driven** (next sub-step). | — |
| **A0-1 ✅ DONE (route endpoint)** | `email_routing.explore_cta_route(tier, email)` → active/checkout/enquiry/blocked + `GET /api/explore/route` (auth) returns the route for the signed-in user (keeps domain classification server-side). 9 tests; suite **564 green**. | Low |
| **A0-2 ✅ DONE (CTA wiring)** | `src/lib/billing/explore.ts` (`fetchExploreRoute` + `exploreDestination`); EXPLORE added to `checkout.ts` `POLAR_URLS`; `ExploreComingSoon` flips to a live **"Get Explore — Free"** CTA when `onGetExplore` passed (else stays "Coming Soon"); `PricingClient` wires it (signed-out → sign-up → `/subscribe?plan=EXPLORE` continuation; signed-in → route → Polar checkout / enquiry / dashboard / blocked-msg); `/subscribe` continuation handles EXPLORE via the same route. tsc clean. **⚠️ Manual:** set `NEXT_PUBLIC_POLAR_EXPLORE_URL` (checkout link). **Business self-serve checkout path complete** (pending that env + reset sub-step). | Low |
| **A0-3 ✅ DONE (Polar-anchored reset)** | `usage_period.next_period_for_subscription(now, billing_period_end)` — anchors the reset window to Polar's `billing_period_end` when it's within ~31 days (a monthly sub like Explore), so the monthly counter rolls on Polar's real renewal date. **Defensive/safe** ("for the safer side"): falls back to the rolling 30-day window when billing_period_end is missing, **already past** (renewal webhook lagging / $0 sub emits no renewal event → counter never gets stuck), or **>31 days out** (ANNUAL plan → preserves D2's no-stretch guarantee). On-read (no cron); the Polar webhook keeps `billing_period_end` current. Wired into the chat-gate + `/api/companies` resets (now pass `billing_period_end`). 7 tests; suite **571 green**. This is "monthly reset calculated through Polar," without depending on Polar emitting $0 renewal events. | Low |
| **B** | Signup routing (business→API-provision $0 Explore; personal→enquiry) + `explore_enquiries` table + enquiry endpoint + enquiry form UI + confirmation | Medium |
| **B1 ✅ DONE** | `email_routing.py` — pure domain-classification brain: `classify_email_domain` (business/personal/disposable/invalid, subdomain-aware) + `signup_route_for` (grant_explore/enquiry/block). 40 unit tests; full suite 497 green. Foundation for the signup hook + enquiry gating (B2/B3). | Low |
| **B2 ✅ DONE** | `explore_enquiries` table (`migrations/v24_explore_enquiries.sql` — pending/approved/rejected, partial-unique on `lower(email) WHERE status='pending'`); `ExploreEnquiryRequest` model (honeypot `website` field + email/length validation); `POST /api/explore/enquiry` (per-IP rate limits 3/min+10/hr, honeypot silent-drop, disposable/invalid → 422 no-persist, idempotent on existing pending/approved). 9 model tests; full suite **506 green**. **⚠️ Manual:** `v24` migration must be run on prod DB (see Manual Work checklist). | Low |
| **B3a ✅ DONE (signup-hook wiring)** | `email_routing.initial_signup_status(email)` → `PENDING` (real email) / `BLOCKED` (disposable+invalid); wired into the JIT provisioning INSERT in `get_current_user` (`main.py` ~1577) so brand-new signups are stamped. **Resolved the PENDING tier-vs-status fork: PENDING is a `subscription_status`, NOT a tier** — tier stays `FREE` (valid `PLAN_LIMITS` key, already gate-blocked), avoiding the ~15-read audit risk (D3). Behavior-preserving: only genuinely-new rows are touched (paid Polar accounts reconcile earlier & short-circuit); no existing `subscription_status` equality check (only `==CANCELED`) is affected. 8 new tests; full suite **514 green**. | Low |
| **B3b ✅ DONE (enquiry form UI)** | `/(site)/explore/enquiry` page (`noindex`) + `EnquiryForm.tsx` client component — theme-matched card, prefills name/email from Clerk when signed in, honeypot `website` field (off-screen, `tabIndex=-1`, `aria-hidden`), posts to `POST /api/explore/enquiry`. Handles `pending`→confirmation, `approved`→sign-in CTA, `422`→disposable/invalid error, `429`→rate-limit message, network errors. tsc clean (0 errors). **Phase B (signup routing + enquiry capture) complete end-to-end.** **Deferred to live phase (D5):** wire the `/pricing` personal-email CTA → this form (today the Explore card is "Coming Soon"/disabled). | Low |
| **C** | Enquiry admin tab + one-click email approve (signed token) + 3 transactional emails | Medium |
| **C1 ✅ DONE (approval brain)** | `enquiry_approval.py` — pure helpers: `mint_action_token`/`verify_action_token` (HMAC `raw.sig`, action+enquiry-bound, 72h expiry, constant-time compare; reasons: malformed/bad_sig/bad_payload/bad_action/expired/secret_unset) + `resolve_action(status, action)` state machine (pending→apply, approved/rejected→terminal no-op, single-use enforced by status not a nonce store) + `target_status_for`. 26 unit tests; full suite **540 green**. **Interim grant decision:** approve will flip the user directly in-DB (`tier=EXPLORE`, `subscription_status=ACTIVE`) with a seam to swap in the A0 Polar $0-sub provision call later. **⚠️ Manual:** set `ENQUIRY_TOKEN_SECRET` env (see checklist). | Low |
| **C2 ✅ DONE (approval endpoints)** | Admin (auth): `GET /api/admin/explore/enquiries` (filter status + search, pending-first), `POST …/{id}/approve`, `POST …/{id}/decline` (reason required via `EnquiryDeclineRequest`). Email one-click (no login): `GET /api/explore/enquiry/action` renders a **read-only prefetch-safe confirm page**, `POST …/action` applies it. Shared core `_apply_enquiry_action` (atomic `status='pending'`-guarded transition, concurrency-safe, audit-logged) + `_grant_explore_to_email` (interim direct flip, tier-guarded so paid users are never downgraded). Added `review_note` to v24. 6 model tests; routes registered; suite **540 green**, `main` imports clean. **Common flow works E2E:** signup→PENDING→enquire→admin approve→existing row flips to active EXPLORE. **Deferred → C2b:** grant-on-future-signup for emails approved *before* they register (needs savepoint-guarded check in the hot JIT path so a missing v24 table can't break auth). | Medium |
| **🔻 DECISION (approval surface)** | **Panel-only approval chosen** over email one-click. Simpler: endpoints already built, no email-deliverability/token-link surface. The C2 **email-action path (`GET/POST /api/explore/enquiry/action`) + the C1 token brain are now PARKED/dormant** (kept, not deleted — remove later if desired). Approval happens in the admin panel; a plain notification email tells the admin to check it. | — |
| **C3-lite ✅ DONE (notification pipeline)** | `_send_enquiry_notification` (best-effort, escapes user input, no-ops without admin email/provider, never raises) + `_super_admin_emails`; fired as a `BackgroundTask` from `POST /api/explore/enquiry` **only on a genuinely-new enquiry** (duplicate re-submits return early → no spam). Plain HTML email → "Review in dashboard" link to `/admin`. 5 tests; suite **551 green**. **⚠️ Manual:** set `APP_BASE_URL` (email link base) + `ADMIN_EMAILS` recipient (see checklist). | Low |
| **C4 ✅ DONE (admin Enquiries tab)** | New **Enquiries** tab in `dashboard/settings/admin` (`ExploreEnquiriesTab.tsx`) — filter All/Pending/Approved/Declined + search, per-row Approve / inline-reason Decline, status + business/personal class badges, relative times, decline-reason display. **Live amber pending-count badge** on the tab (parent `enquiriesQuery`, `refetchInterval 60s`, shared cache key). Approve/decline invalidate users+stats+enquiries. tsc clean. **Phase C approval loop complete (panel path).** | Low |
| **C2b ✅ DONE (grant-on-future-signup)** | `email_routing.signup_provisioning(email, pre_approved)` → `(EXPLORE, ACTIVE)` if pre-approved else `(FREE, PENDING/BLOCKED)`. Wired into the JIT INSERT (`main.py` ~1601): a **SAVEPOINT-guarded** lookup checks for an `approved` enquiry on this email and grants EXPLORE immediately on first sign-in. **Safety:** the savepoint means a missing `explore_enquiries` table (v24 not applied) or any transient error rolls back *only* the lookup and falls through to a normal signup — the hot auth path can never break. Now both cases are covered: approve-before-signup (C2b grant on signup) and approve-after-signup (C2's `_grant_explore_to_email` flips the existing row). 4 tests; suite **555 green**, `main` compiles. **Approval logic fully closed.** | Medium |
| **D** | Manage slide-over redesign (Sections A–F) + feature flags for all tiers + explore overrides + reset + temp-unlimited + audit logging | Medium |
| **E** | Resting-state response + widget UI + `resting-lead` endpoint + owner email + 50/mo cap + dashboard nudges | Medium |
| **F** | Pricing surfaces "Coming Soon" everywhere (components.tsx, PricingClient, PricingPreview, dashboard/pricing, homepage/vaayu) + Vaayu-branding copy fixes | Low |
| **F ✅ DONE** | `ExploreComingSoon` full-width banner on `/pricing` (theme-matched, pill-shaped); slim teaser on homepage `PricingPreview`; in-app teaser on `dashboard/pricing`; "remove Sapybase"→"remove Vaayu badge" branding fix in `FEATURE_DESCRIPTIONS`+`COMPARISON_FEATURES`; 2 Explore FAQs added. **Also fixed:** Lenis smooth-scroll was dead on `/pricing` — `SmoothScrollProvider` `prevent()` heuristic now requires `scrollHeight > clientHeight` (a layout div computing `overflow-y:auto` via `overflow-x-hidden` was falsely treated as a scroll container). Verified via wheel-event test. **Deferred/optional:** EXPLORE column in the comparison table (chose banner over 4th card); `vaayu/page.tsx` hero teaser; `layout.tsx` SEO title still says "Sapybase". | Low |
| **G** | Header stat cards + Metrics Explore section | Low |
| **H** | Flip "Coming Soon" → live "Free Forever"; open public signup | Gated on A–G validated |

**Suggested first PR:** Phase A + Phase F (Coming Soon). This makes Explore *visible* and the backend
tier *exist*, with zero risk to existing users, while B–E are built behind the scenes.

---

## 11. Open Questions (Confirm Before Coding the Affected Phase)

1. ✅ **RESOLVED (D1/D3/D5):** No "draft-config pre-approval" ambiguity. PENDING users are held at
   `/pricing` (no dashboard). Business email → instant $0 Explore via API. Personal → enquiry → on
   approve, API-provision. Subscription is mandatory to enter the dashboard.
2. **`max_owner_emails` for paid tiers:** unlimited sentinel (e.g. `999999`) for STARTER+? *(Rec: yes.)*
   *(Still open — confirm during Phase A.)*
3. ✅ **RESOLVED (D4):** Per-user Explore overrides stored in `custom_plan_config` JSONB. Gate +
   `has_entitlement` must read it for EXPLORE tier (caution noted in D4).
4. ✅ **RESOLVED (D2):** Chunks = stored-knowledge ceiling, no reset (`main.py:531`). Messages +
   owner-emails reset on Polar `billing_period_end` rollover. Reset action must be **built** (Phase A) —
   it does not exist today (`main.py:2314`).
5. **Coming-Soon waitlist:** during Phase F, should the "Coming Soon" CTA capture emails? *(Rec: capture —
   free top-of-funnel + launch-day audience. Founder to confirm.)*
6. **Annual toggle interaction:** Explore is free → monthly/annual toggle + currency must show "Free".
   Confirm `formatPrice(0)` returns "Free" in BOTH `PricingClient.tsx` and the duplicated
   `dashboard/pricing/page.tsx`.

---

## 12. Definition of Done

- EXPLORE tier exists in `config.py` + `entitlements.ts`, all key-reads audited, tests green.
- **$0 "Explore" Polar product exists**; API-provision helper works; sandbox-verified webhook flow (A0).
- **Period-anchored counter reset works** (`messages_used`/`owner_emails_sent` zero on `billing_period_end`
  rollover, on-read) — verified for Explore AND paid tiers (D2).
- **Dashboard access gate works** (D5): PENDING/no-sub users redirected to `/pricing` (frontend + backend);
  no path reaches the dashboard shell without an active subscription.
- Existing FREE users (incl. personal-email) migrated to EXPLORE via $0 sub + welcomed; grandfather flag set.
- Business-email signups auto-provision $0 EXPLORE; personal-email signups route to enquiry + one-click approve.
- Resting state works end-to-end: amber status → canned reply → inline form → lead saved → owner email
  (capped at 50/mo) → upgrade CTA.
- Super admin can change any limit/feature for any user, with min/max guards + full audit trail.
- Every pricing surface shows Explore (Coming Soon in Phase 1, Free Forever in Phase 2); Vaayu-branding
  copy fixes applied.
- No regression for STARTER/PRO/BUSINESS/ENTERPRISE/CUSTOM users.

---

## 13. 🛠️ Manual Work / External Setup Checklist (do at the END, before go-live)

> Running list of everything **you** must do by hand — Polar dashboard actions, DB migrations,
> env vars, links to grab. Updated as each phase lands. Nothing here is auto-applied by code.

> **Snapshot — 2026-06-09.** Engine is built up to a working business self-serve path + Polar-anchored
> reset. 571 backend tests green; frontend tsc clean. The items below are the ONLY things that need to be
> done by hand for Explore to go live. Do A → B → C, then the data op (D); E is for the polish phase.

### A. Polar (billing dashboard)
- [x] **Create the $0 recurring (monthly) "Explore" product.** ✅ Done — `POLAR_PRODUCT_ID_EXPLORE` set in
      `.env.local`, resolves to `EXPLORE` in the webhook map.
- [ ] **Get the Explore hosted checkout link** (Polar → Explore product → Checkout Link).
- [ ] **Confirm the $0 Explore checkout collects email only — no card** (it's a $0 product, so Polar should
      skip payment; just verify).
- [ ] **Sandbox-verify the flow:** a $0 checkout completes card-free AND emits `subscription.created`
      (status active + `current_period_start/end`) → the webhook grants `EXPLORE`. *(Also note whether Polar
      emits a monthly renewal event for the $0 sub — informational only; the reset is safe either way.)*

### B. Database migration (run once on the prod DB)
- [ ] **Run `migrations/v24_explore_enquiries.sql`** — creates `explore_enquiries` (incl. `review_note`) +
      indexes. Required for the enquiry form, the admin Enquiries tab, and approval. *(This is the only
      migration Explore needs — everything else reuses existing columns.)*

### C. Environment variables (set in prod host)
- [ ] **`POLAR_PRODUCT_ID_EXPLORE`** — copy from `.env.local` into **production** env.
- [ ] **`NEXT_PUBLIC_POLAR_EXPLORE_URL`** — the hosted checkout link from A. Drives the live "Get Explore —
      Free" CTA. *(If unset, the CTA safely falls back to the enquiry form.)*
- [ ] **`ADMIN_EMAILS`** (or `ADMIN_EMAIL` / `SUPER_ADMIN_EMAIL`) — recipient for the new-enquiry
      notification email (also already used for super-admin promotion).
- [ ] **`APP_BASE_URL`** (e.g. `https://www.sapybase.com`) — base for the "Review in dashboard" link in that
      email. Defaults to `https://www.sapybase.com` if unset.
- [ ] **`EXPLORE_DASHBOARD_GATE=true`** — ⚠️ **flip this LAST.** Makes a subscription mandatory (redirects
      FREE/PENDING users to `/pricing`). Only enable AFTER the Explore checkout is live (A+C) **and** the
      FREE-user purge (D) is done — otherwise it locks out every existing FREE user and new signup.
- [ ] *(parked)* **`ENQUIRY_TOKEN_SECRET`** — only needed if you ever re-enable the email one-click
      approve/decline links. Not used by the current panel-only flow.

### D. One-time data operation
- [ ] **Purge existing FREE users (DB + Clerk) + email them to re-sign-up for Explore** (D7). Do this after
      A–C are live (so re-signups have a working path). Tooling exists: `delete_from_clerk`,
      `scripts/production_purge.py`, `DELETE FROM users`. Then enable the gate (C).

### E. Resend (emails) — only for the remaining polish phase
- [ ] **Applicant emails:** welcome-on-approve + decline (sent to the *applicant*). Code + wiring is still
      TODO (see §14). The **admin new-enquiry notification is already built** (plain HTML, no template needed).

---

## 14. ✅ Status & What's Left (resume here — 2026-06-09)

### DONE (shipped + tested — 571 backend tests green, frontend tsc clean)
- **Config foundation** — EXPLORE in `PLAN_LIMITS` / `MODEL_MAPPING` / rate limits / entitlements; domain lists.
- **Access gate (D3/D5)** — backend live & behaviour-preserving; frontend redirect **dormant** behind
  `EXPLORE_DASHBOARD_GATE` (off).
- **Signup routing (B3a/C2b)** — new signups stamped `subscription_status` PENDING/BLOCKED (tier stays FREE);
  approved-before-signup emails granted EXPLORE on first sign-in (savepoint-guarded — can't break auth).
- **Enquiry capture (B2/B3b)** — `explore_enquiries` table, `POST /api/explore/enquiry` (honeypot + rate
  limit + dedupe), `/explore/enquiry` form + confirmation.
- **Admin approval (C2/C4)** — `GET/POST /api/admin/explore/enquiries[...]`, **Enquiries tab + live pending
  badge**, approve (grants EXPLORE) / decline (reason required), audit-logged. *(Email one-click `/action`
  endpoints + token brain exist but are PARKED/dormant — panel-only is the chosen flow.)*
- **New-enquiry notification email (C3-lite)** — fires to the super-admin on each new enquiry.
- **Business self-serve checkout (A0)** — `GET /api/explore/route` + CTA wiring → Polar $0 hosted checkout
  (email only, no card) → existing webhook grants EXPLORE. Personal emails route to the enquiry form.
- **Polar-anchored monthly reset (A0-3)** — counter resets on Polar's `billing_period_end`; safe fallbacks
  for missing/past/annual dates.
- **Pricing UI (F)** — Explore card (live "Get Explore — Free" when wired), homepage teaser, Lenis fix,
  Vaayu branding copy.

### LEFT TO BUILD (engineering — for tomorrow)
1. **Applicant emails (finish Phase C):** welcome-on-approve + decline, sent to the applicant. Wire into the
   approve/decline endpoints (`_apply_enquiry_action`) as background tasks. *(Needs Resend templates — §13.E.)*
2. **Phase E — resting-state UX:** when an Explore bot hits its 200/mo cap, show the "resting" widget message
   + owner nudge email + dashboard nudge. *(The 200/mo cap is already ENFORCED; this is the polished UX, the
   `resting-lead` endpoint, and the 50/mo owner-email cap.)*
3. **Enable the gate:** flip `EXPLORE_DASHBOARD_GATE=true` after the FREE purge (§13.C/D) — makes a
   subscription mandatory. Frontend redirect already built + dormant.
4. **Phase D (optional, not launch-blocking):** super-admin Manage slide-over → per-user Explore overrides
   (limits/feature flags via `custom_plan_config`) + force-reset + temp-unlimited.
5. **Optional cleanup:** wire the in-app `dashboard/pricing` Explore teaser to the live CTA (still "Coming
   Soon"); and/or remove the parked email one-click `/action` endpoints + token brain if not wanted.

### MINIMUM PATH TO "EXPLORE IS LIVE"
Manual: **§13 A → B → C** (Polar checkout link + `v24` migration + env vars) → test one business signup
end-to-end → **§13.D** (purge FREE users) → set `EXPLORE_DASHBOARD_GATE=true`. Items 1–2 above are polish and
can follow launch. *(Reminder: approval currently grants via a direct DB flip to `EXPLORE/ACTIVE`; the
business checkout path is the real Polar sub. Both give working Explore access.)*
