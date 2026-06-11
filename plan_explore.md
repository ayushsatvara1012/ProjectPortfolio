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
**admin-override** patterns. Explore does **not** touch Polar (it's free — no payment object).

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

### 2.2 Lifetime, calendar-month reset
- Explore never expires.
- Counters (`messages`, `chunks` are cumulative not monthly — see note — `owner_emails`) reset on the
  **1st of each calendar month, 00:00 UTC**.
- ⚠️ **Chunks are NOT a monthly-reset counter** — chunks represent stored knowledge. A 75-chunk cap is a
  *ceiling on stored knowledge*, not a monthly budget. Messages and owner-emails reset monthly; chunks
  do not. (Confirm against how the existing message/chunk counters behave in `main.py` before coding —
  do not assume both reset the same way.)

### 2.3 Model / rate limits
- `MODEL_MAPPING["EXPLORE"] = "gemini-2.5-flash-lite"`.
- `TIER_RATE_LIMITS["EXPLORE"] = { per_minute: 20, per_hour: 200, per_day: 1200 }` — generous for one
  real bot, tight enough to bound a single key-replay abuse burst.

---

## 3. Signup Routing — Business vs Personal Email

### 3.1 The decision at signup
```
User signs up (email captured)
      │
      ├─ Normalize domain (lowercase, strip sub-domain, trim)
      │
      ├─ Domain in DISPOSABLE_EMAIL_DOMAINS?  ──► HARD BLOCK signup (abuse) — show "use a real email"
      │
      ├─ Domain in FREE_EMAIL_DOMAINS?
      │        YES ──► Create account, tier = FREE-PENDING*, route to ENQUIRY flow (§3.4)
      │        NO  ──► Create account, GRANT tier = EXPLORE (lifetime), welcome email, bot ready
```
\* "FREE-PENDING" = account exists but is not yet on Explore. They can still see the dashboard shell,
but cannot deploy a live bot until approved. (Decide exact gating in §3.5 open question.)

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
| **A** | `config.py` EXPLORE tier + `max_owner_emails` across all tiers + domain lists + entitlements mirror + FREE→EXPLORE migration (grandfather) + tests | Low (additive, but audit all `PLAN_LIMITS` key reads) |
| **B** | Signup routing (business vs personal) + `explore_enquiries` table + enquiry endpoint + enquiry form UI + confirmation | Medium |
| **C** | Enquiry admin tab + one-click email approve (signed token) + 3 transactional emails | Medium |
| **D** | Manage slide-over redesign (Sections A–F) + feature flags for all tiers + explore overrides + reset + temp-unlimited + audit logging | Medium |
| **E** | Resting-state response + widget UI + `resting-lead` endpoint + owner email + 50/mo cap + dashboard nudges | Medium |
| **F** | Pricing surfaces "Coming Soon" everywhere (components.tsx, PricingClient, PricingPreview, dashboard/pricing, homepage/vaayu) + Vaayu-branding copy fixes | Low |
| **G** | Header stat cards + Metrics Explore section | Low |
| **H** | Flip "Coming Soon" → live "Free Forever"; open public signup | Gated on A–G validated |

**Suggested first PR:** Phase A + Phase F (Coming Soon). This makes Explore *visible* and the backend
tier *exist*, with zero risk to existing users, while B–E are built behind the scenes.

---

## 11. Open Questions (Confirm Before Coding the Affected Phase)

1. **FREE-PENDING capability (§3.5):** draft-config allowed pre-approval, or full lock? *(Rec: draft allowed.)*
2. **`max_owner_emails` for paid tiers:** unlimited sentinel (e.g. `999999`) for STARTER+? *(Rec: yes.)*
3. **Override storage:** per-user Explore overrides in dedicated columns or inside `custom_plan_config`
   JSONB? *(Rec: reuse `custom_plan_config` JSONB to avoid schema churn; confirm gate logic reads it for
   EXPLORE tier too.)*
4. **Chunk reset semantics (§2.2):** confirm chunks are a stored-knowledge ceiling (no monthly reset),
   while messages/owner-emails reset monthly. Verify against current counter code before building.
5. **Coming-Soon waitlist:** during Phase F, should the "Coming Soon" CTA capture emails (build a launch
   list) or just display? *(Rec: capture — free top-of-funnel + launch-day audience.)*
6. **Annual toggle interaction:** Explore is free, so the monthly/annual toggle and currency formatting
   must show "Free" regardless. Confirm `formatPrice(0)` already returns "Free" (it does in
   `PricingClient.tsx`; verify the duplicated dashboard pricing handles 0 too).

---

## 12. Definition of Done

- EXPLORE tier exists in `config.py` + `entitlements.ts`, all key-reads audited, tests green.
- Existing FREE users (incl. personal-email) migrated to EXPLORE + welcomed; grandfather flag set.
- Business-email signups auto-grant EXPLORE; personal-email signups route to enquiry + one-click approve.
- Resting state works end-to-end: amber status → canned reply → inline form → lead saved → owner email
  (capped at 50/mo) → upgrade CTA.
- Super admin can change any limit/feature for any user, with min/max guards + full audit trail.
- Every pricing surface shows Explore (Coming Soon in Phase 1, Free Forever in Phase 2); Vaayu-branding
  copy fixes applied.
- No regression for STARTER/PRO/BUSINESS/ENTERPRISE/CUSTOM users.
