# Custom Plan Admin UI Flow — Step-by-Step

**Target User:** Super Admin in the Sapybase admin panel  
**Goal:** Create and provision a custom plan for an enterprise customer  
**Outcome:** Customer receives checkout link and can start a paid trial

---

## Overview

The custom plan creation is a **2-step process**:
1. **Step 1 — Configure (Draft)**: Admin fills in the plan details and clicks "Save Config"
2. **Step 2 — Provision (Commit)**: Admin clicks "Create in Polar & Generate Link" to lock in and get the checkout URL

---

## Screen 1: Admin Panel Navigation

### Location
```
Sapybase Admin Dashboard
  → Settings / Customers / Users (or similar)
    → Select a user / Search for user
      → Click on user profile
        → Tab: "Custom Plan" or "Subscription"
```

### What admin sees
- User's current tier (e.g., "FREE", "BASIC", "CUSTOM")
- If tier is already "CUSTOM": show the existing plan config and its status
- If tier is "FREE" or standard: show a button "Upgrade to Custom Plan"

---

## Screen 2: Custom Plan Configuration Form

### Admin clicks "Upgrade to Custom Plan" or "Edit Plan" button

The form appears with these fields:

```
┌─────────────────────────────────────────────────────────┐
│  Custom Plan Configuration for: john@company.com        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Plan Details                                            │
│  ─────────────────────────────────────────────────────  │
│                                                           │
│  Plan Name *                                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Acme Corp Custom Plan                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                           │
│  Monthly Price (USD) *                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 299                                              │  │
│  └──────────────────────────────────────────────────┘  │
│  ⓘ Must be > $0 for a paid plan                         │
│                                                           │
│  Trial Days (Free trial before first charge)            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 14                                               │  │
│  └──────────────────────────────────────────────────┘  │
│  ⓘ 0–30 days. Default: 14                              │
│                                                           │
│  AI Model *                                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ gpt-4o ▼                                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                           │
│  Limits & Features                                       │
│  ─────────────────────────────────────────────────────  │
│                                                           │
│  Max Bots                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 5                                                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                           │
│  Max Messages / Month                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 50000                                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                           │
│  Max Knowledge Base Chunks                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 10000                                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                           │
│  Features                                                │
│  ─────────────────────────────────────────────────────  │
│                                                           │
│  ☑ Lead Capture                                         │
│  ☑ White Label                                          │
│  ☑ Human Handoff                                        │
│  ☑ Webhooks                                             │
│  ☑ Custom Logo                                          │
│  ☑ Analytics Dashboard                                  │
│                                                           │
│  Notes (Internal only — not visible to customer)        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Enterprise deal, Q3 2026. Requested gpt-4o      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                           │
├─────────────────────────────────────────────────────────┤
│  [ Save Config ]              [ Cancel ]                 │
└─────────────────────────────────────────────────────────┘
```

### What each field does:

| Field | Type | Required | Notes |
|---|---|---|---|
| **Plan Name** | Text | Yes | Display name (shown to customer in invoice) |
| **Monthly Price** | Number | Yes | In USD; must be > 0; this is what Polar will charge |
| **Trial Days** | Number | No | 0–30; customer gets free access for this many days |
| **AI Model** | Dropdown | Yes | Options: gpt-4o, gpt-4-turbo, gemini-2.0-flash, etc. |
| **Max Bots** | Number | No | How many chatbots customer can create |
| **Max Messages** | Number | No | Monthly message quota |
| **Max Chunks** | Number | No | Knowledge base size limit |
| **Features** | Checkboxes | No | Which paid features are enabled |
| **Notes** | Text | No | Internal notes (for admin only) |

---

## Screen 3: Save Config (Step 1)

### Admin clicks "Save Config"

**What happens:**
1. Frontend validates all required fields (Plan Name, Price > 0, Model)
2. Sends `PATCH /api/admin/users/{clerk_id}` with `custom_plan_config`
3. Backend updates `users.tier = 'CUSTOM'` and `custom_plan_config` (but does **not** create Polar product yet)

**Response:**
```json
{
  "status": "config_saved",
  "message": "Plan config saved. Click 'Create in Polar' to generate the checkout link.",
  "tier": "CUSTOM",
  "subscription_status": "AWAITING_PAYMENT"
}
```

**Admin sees confirmation:**
```
✓ Custom plan config saved!

Next step: Click "Create in Polar & Generate Link" to create the 
Polar product and send the checkout link to the customer.
```

The form now shows a new button: **"Create in Polar & Generate Link"** (in green/primary color).

---

## Screen 4: Provision in Polar (Step 2)

### Admin clicks "Create in Polar & Generate Link"

**What happens:**
1. Frontend calls `POST /api/admin/users/{clerk_id}/custom-plan/provision`
2. Backend:
   - Calls Polar API: `POST /v1/products` with the config
   - Receives `product_id` from Polar
   - Stores `custom_plan_polar_product_id` in DB
   - Generates checkout URL: `https://buy.polar.sh/{product_id}`
   - Sets `subscription_status = AWAITING_PAYMENT`
3. Returns the checkout URL

**Response:**
```json
{
  "status": "provisioned",
  "product_id": "prod_abc123xyz",
  "checkout_url": "https://buy.polar.sh/prod_abc123xyz",
  "polar_env": "production",
  "message": "Polar product created! Copy the checkout link below and send to customer."
}
```

---

## Screen 5: Checkout Link Display

### New UI appears:

```
┌─────────────────────────────────────────────────────────┐
│  ✓ Polar Product Created!                              │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Checkout Link                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ https://buy.polar.sh/prod_abc123xyz              │  │
│  │                            [ Copy to Clipboard ] │  │
│  └──────────────────────────────────────────────────┘  │
│                                                           │
│  Status: AWAITING_PAYMENT                              │
│  (Customer has not started checkout yet)                │
│                                                           │
├─────────────────────────────────────────────────────────┤
│  [ Email Link to Customer ]  [ Done ]                   │
└─────────────────────────────────────────────────────────┘
```

### Admin can now:

1. **Copy the link** — click "Copy to Clipboard"
2. **Email the link** — click "Email Link to Customer" (optional, if integrated with email service)
3. **Done** — save and return to user profile

---

## Screen 6: Admin Dashboard View (Ongoing)

### After provisioning, admin can monitor the plan

**Navigation:**
```
Sapybase Admin Dashboard
  → Customers / Custom Plans
    → View all active custom plans
```

### Dashboard shows:

```
┌──────────────────────────────────────────────────────────────────┐
│  Custom Plans Overview                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Filters: [ All ] [ AWAITING_PAYMENT ] [ TRIAL_ACTIVE ] [ACTIVE]│
│           [ PAYMENT_FAILED ] [ SUSPENDED ]                       │
│                                                                   │
│  Total: 3 custom plan users                                      │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ User              │ Email                  │ Status  │ ... │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ john@company.com  │ john@company.com        │ 🟢ACTIVE│     │ │
│  │                   │                        │         │     │ │
│  │ jane@corp.dev     │ jane@corp.dev           │ 🟡AWAIT │     │ │
│  │                   │ (Sent checkout: 3 days)│         │     │ │
│  │                   │                        │         │     │ │
│  │ bob@startup.com   │ bob@startup.com         │ 🔴PAYME │     │ │
│  │                   │ (Card declined)         │ FAILED  │     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Each row has a "..." menu with actions:                         │
│  • Re-send Checkout Link                                         │
│  • Suspend Plan                                                  │
│  • Extend Period                                                 │
│  • View Full Details                                             │
│  • Cancel Plan                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Color coding:
- 🟢 **Green** — TRIAL_ACTIVE, ACTIVE, PAUSED (customer has access)
- 🟡 **Amber** — AWAITING_PAYMENT, CANCELED (pending action or grace period)
- 🔴 **Red** — PAYMENT_FAILED, SUSPENDED, REVOKED, REFUNDED, EXPIRED (no access)

---

## Screen 7: Quick Actions (Override)

### Admin clicks "..." menu → "Suspend Plan"

```
┌────────────────────────────────────────────┐
│  Suspend Custom Plan                       │
├────────────────────────────────────────────┤
│                                             │
│  User: john@company.com                    │
│  Current Status: ACTIVE                    │
│                                             │
│  Reason (required) *                        │
│  ┌──────────────────────────────────────┐ │
│  │ Abusive chatbot detected; suspending│ │
│  │ pending investigation.               │ │
│  └──────────────────────────────────────┘ │
│  (1–500 characters)                        │
│                                             │
├────────────────────────────────────────────┤
│  [ Cancel ]  [ Suspend ]                   │
└────────────────────────────────────────────┘
```

### Admin clicks "Suspend"

**Backend does:**
- Sets `subscription_status = SUSPENDED` in DB
- Logs to `admin_audit_log`: action=CUSTOM_PLAN_OVERRIDE_SUSPEND, reason=..., admin_id=...

**User effect:**
- Next API call → HTTP 402: `code: "CUSTOM_PLAN_SUSPENDED"`, message: "Subscription suspended. Contact your account manager."
- User cannot access features

### Admin clicks "..." → "Reactivate Plan"

```
┌────────────────────────────────────────────┐
│  Reactivate Custom Plan                    │
├────────────────────────────────────────────┤
│                                             │
│  User: john@company.com                    │
│  Current Status: SUSPENDED                 │
│                                             │
│  Reason (required) *                        │
│  ┌──────────────────────────────────────┐ │
│  │ Investigation complete; access      │ │
│  │ restored.                            │ │
│  └──────────────────────────────────────┘ │
│                                             │
├────────────────────────────────────────────┤
│  [ Cancel ]  [ Reactivate ]                │
└────────────────────────────────────────────┘
```

### Admin clicks "..." → "Extend Period"

```
┌────────────────────────────────────────────┐
│  Extend Billing Period                     │
├────────────────────────────────────────────┤
│                                             │
│  User: john@company.com                    │
│  Current Billing End: 2026-06-15          │
│                                             │
│  Extend by (days) *                        │
│  ┌──────────────────────────────────────┐ │
│  │ 30                                   │ │
│  └──────────────────────────────────────┘ │
│  (1–365 days)                              │
│                                             │
│  Reason (required) *                        │
│  ┌──────────────────────────────────────┐ │
│  │ Onboarding delay; goodwill grace    │ │
│  └──────────────────────────────────────┘ │
│                                             │
├────────────────────────────────────────────┤
│  [ Cancel ]  [ Extend ]                    │
└────────────────────────────────────────────┘
```

**Result:**
- `billing_period_end` moves from 2026-06-15 to 2026-07-15 (30 days later)
- User continues to have access
- Logged to audit trail

---

## Screen 8: Metrics & Health

### Admin navigates to "Custom Plans → Metrics"

```
┌──────────────────────────────────────────────────────────────────┐
│  Custom Plan Metrics                                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Status Distribution                                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ACTIVE               6 users  ███████████                   │ │
│  │ TRIAL_ACTIVE         2 users  ████                          │ │
│  │ AWAITING_PAYMENT     1 user   ██                            │ │
│  │ PAYMENT_FAILED       1 user   ██                            │ │
│  │ SUSPENDED            0 users  —                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ⚠ Alerts                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ⚠ 1 user in AWAITING_PAYMENT for >7 days                   │ │
│  │   jane@corp.dev — sent checkout link 10 days ago            │ │
│  │   [ Re-send Link ] [ Resend Reminder Email ] [ Cancel ]     │ │
│  │                                                              │ │
│  │ ⚠ 1 user hit PAYMENT_FAILED in last 24 hours                │ │
│  │   bob@startup.com — card declined during trial conversion   │ │
│  │   [ Contact Customer ] [ Force Activate ]                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Reconciliation                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Last reconciliation: 2 hours ago                            │ │
│  │ Status: ✓ No mismatches                                     │ │
│  │ [ Run Manual Reconciliation ]                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Complete Flow Diagram

```
                          Admin Panel
                               │
                   ┌───────────┴───────────┐
                   │                       │
            Select User              View Dashboard
                   │                       │
                   ▼                       ├→ Metrics
         Edit / Upgrade Plan              ├→ All Custom Plans
                   │                       ├→ Reconciliation Status
                   ▼
        Fill in Plan Config
     (Price, Trial, Features)
                   │
                   ▼
           [ Save Config ]
                   │
        (Tier = CUSTOM, Status = AWAITING_PAYMENT)
                   │
                   ▼
      [ Create in Polar & Generate Link ]
                   │
          (Calls /provision endpoint)
                   │
                   ▼
        ✓ Checkout URL Generated
                   │
         ┌────────┴────────┐
         │                 │
    Copy Link         Email Link to Customer
         │                 │
         └────────┬────────┘
                  │
                  ▼
         Customer Receives Link
                  │
                  ▼
        Customer Clicks & Checkout
                  │
                  ▼
       Polar Webhook Fires: subscription.created
                  │
                  ▼
      DB Updated: Status = TRIAL_ACTIVE
                  │
    ┌─────────────┴─────────────┐
    │                           │
 Admin monitors              Customer has access
 via Dashboard               (14-day trial)
    │                           │
    │                           ▼
    │                    (Day 14: Polar charges)
    │                           │
    │              ┌────────────┴────────────┐
    │              │                        │
    │          Success              Card Declined
    │              │                        │
    │              ▼                        ▼
    │         Status = ACTIVE      Status = PAYMENT_FAILED
    │              │                        │
    │              ▼                        ▼
    └→ May suspend, extend,      Admin alerted / can
       or cancel                 contact customer

```

---

## Error Scenarios

### Scenario 1: Invalid Price
```
Admin enters Price: $-50

Frontend validation error:
❌ Monthly price must be greater than 0
```

### Scenario 2: Polar API Down
```
Admin clicks "Create in Polar & Generate Link"

Backend tries to call Polar API → timeout/500

Frontend shows:
❌ Could not reach Polar API. Please try again.
   (Admin can retry)
```

### Scenario 3: Trying to re-provision an already-provisioned plan
```
Admin clicks "Create in Polar & Generate Link" again

Backend checks if custom_plan_polar_product_id already set
→ 409 Conflict error

Frontend shows:
❌ This plan is already provisioned.
   To change the price/features, you must:
   1. Cancel the old subscription
   2. Clear the product link
   3. Create a new plan

   [ Help ] [ Contact Support ]
```

---

## Summary Table

| Step | Screen | Admin Action | Backend Endpoint | Result |
|---|---|---|---|---|
| 1 | Config Form | Fill in plan details | `PATCH /users/{id}` | Config saved, tier=CUSTOM |
| 2 | Config Form | Click "Save Config" | (form validation) | Confirmation message |
| 3 | Config Form | Click "Create in Polar" | `POST /provision` | Checkout URL generated |
| 4 | Link Display | Copy checkout URL | (frontend only) | URL in clipboard |
| 5 | Link Display | Email to customer | (frontend email service) | Email sent |
| 6 | Dashboard | View all plans | `GET /dashboard` | Table of users + status |
| 7 | Dashboard | Click "Suspend" | `PATCH /override` | Status=SUSPENDED, user blocked |
| 8 | Dashboard | Click "Extend" | `PATCH /override` | billing_period_end bumped |
| 9 | Metrics | View status distribution | `GET /metrics` | Pie chart + alerts |
| 10 | Metrics | Manual reconciliation | `POST /reconcile` | Report of any mismatches |
