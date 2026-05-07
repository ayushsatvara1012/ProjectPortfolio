# Frontend Implementation Analysis — Custom Plan Flow

**Status:** Analysis Only (No Code Changes Yet)  
**Date:** 2026-05-07  
**Scope:** Frontend gaps vs. backend API implementation

---

## Executive Summary

The **backend is 100% complete** with all 6 phases implemented. The **frontend admin panel exists but is incomplete** — it can save custom plan configs but cannot provision them in Polar or manage ongoing custom plan users.

**Critical gaps:**
1. ❌ No "Create in Polar & Generate Link" button / flow
2. ❌ No checkout URL display after provisioning
3. ❌ No custom plan dashboard (list of users with status, quick actions)
4. ❌ No metrics view (status distribution, alerts)
5. ❌ No quick-action buttons (suspend, extend, reactivate, cancel)
6. ❌ Existing admin modal calls wrong endpoint (`/limits` instead of user update)
7. ❌ No trial period confirmation or billing cycle display
8. ❌ No reconciliation interface
9. ❌ No error states for Polar API failures

---

## Current Frontend State

### Where the Admin Panel Exists
- **Path:** `src/app/(app)/dashboard/settings/admin/page.tsx` (657 lines)
- **Access:** Super Admin only
- **Components:**
  - User list with search + tier filter
  - Modal that opens on user selection
  - Custom Plan Config form (inside modal)
  - Stats overview (total users, companies, bots, messages, custom_plan_count)

### What Currently Works ✅

| Feature | Status | Details |
|---|---|---|
| Admin user list | ✅ Works | Fetches from `GET /api/admin/users` |
| Search users by email/clerk_id | ✅ Works | Client-side filtering |
| Filter by tier | ✅ Works | Includes CUSTOM tier |
| Custom plan config form | ✅ Partial | Form fields exist, but save is broken |
| Model dropdown | ✅ Works | Dropdown with gemini models |
| Feature toggles | ✅ Works | Checkboxes for features (human_handoff, lead_capture, etc.) |
| Form validation | ✅ Works | Pydantic schema on frontend: `customPlanConfigSchema` |
| Tier selector | ✅ Works | Dropdown to change tier |
| Account suspend/activate | ✅ Works | Button toggles status |

### What's Broken ❌

#### 1. Wrong Endpoint Called
```typescript
// Current code (WRONG):
const limitsMutation = useMutation({
  mutationFn: ({ clerkId, payload }: { clerkId: string; payload: any }) =>
    authFetch(`/api/admin/users/${clerkId}/limits`, {  // ← WRONG ENDPOINT
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
```

**Problem:** Code calls `/limits` endpoint but should call `/api/admin/users/{clerkId}` to save user tier + custom_plan_config.

**Backend endpoint that should be called:**
```
PATCH /api/admin/users/{clerk_id}
Body: {
  tier: "CUSTOM",
  custom_plan_config: { plan_name, monthly_price_usd, ... }
}
```

#### 2. No Two-Step Workflow
The design requires:
- **Step 1:** Admin fills form + clicks "Save Config" → saves `custom_plan_config` locally
- **Step 2:** Admin clicks "Create in Polar & Generate Link" → calls `/provision` endpoint

**Current:** Only one "Save Changes" button (and it calls the wrong endpoint).

#### 3. No `/provision` Endpoint Integration
Backend endpoint exists: `POST /api/admin/users/{clerk_id}/custom-plan/provision`

Frontend has: **Nothing**

Needs:
- Button to trigger provision
- Error handling for Polar API failures
- Display of returned `checkout_url`

#### 4. No Checkout URL Display
After provisioning, backend returns:
```json
{
  "status": "provisioned",
  "product_id": "prod_abc123",
  "checkout_url": "https://buy.polar.sh/prod_abc123",
  "polar_env": "production"
}
```

Frontend should show:
- A modal or section with the checkout URL
- Copy-to-clipboard button
- Optional: Email link button

**Current:** Nothing.

#### 5. No Custom Plan Dashboard
Backend endpoint: `GET /api/admin/custom-plan/dashboard`

Returns: Per-user custom plan data (status, billing_end, last_polar_event_at, quick_actions, etc.)

Frontend has: **Nothing** — no separate dashboard view.

Needed:
- Separate page/tab for "Custom Plans"
- Table of users: email, status, billing_end, last_webhook_at, etc.
- Status color coding (green/amber/red)
- Quick-action buttons for each user

#### 6. No `/override` Endpoint Integration
Backend endpoint: `PATCH /api/admin/users/{clerk_id}/custom-plan/override`

Allows: suspend, reactivate, activate, extend, cancel

Frontend has: **Nothing** — no buttons to trigger these actions.

Needed:
- Modal per user to select action + provide reason
- extend_days input field for "extend" action
- Loading state while request is in-flight
- Error/success feedback

#### 7. No Metrics View
Backend endpoint: `GET /api/admin/custom-plan/metrics`

Returns:
- Status distribution (ACTIVE, TRIAL_ACTIVE, AWAITING_PAYMENT, PAYMENT_FAILED, etc.)
- AWAITING_PAYMENT >7 days (stale users)
- PAYMENT_FAILED spike count (last 24h, 7d)

Frontend has: **Nothing** — no metrics display.

Needed:
- Pie chart or bar chart of status distribution
- Alert boxes for stale users and payment failures
- Manual reconciliation button

#### 8. No Reconciliation Interface
Backend endpoint: `POST /api/admin/custom-plan/reconcile`

Returns: Full mismatch report (orphan DB rows, Polar/DB status mismatches, etc.)

Frontend has: **Nothing**

Needed:
- Button to manually trigger reconciliation
- Display of report results
- Indication of last auto-reconciliation time

---

## Detailed Gap Analysis

### Gap 1: Save Config vs. Provision Workflow

**Expected Flow:**
```
User Config Form
    ↓
[ Save Config ] Button clicked
    ↓
PATCH /api/admin/users/{clerk_id}
    (tier: CUSTOM, custom_plan_config: {...})
    ↓
✓ Config saved locally
    ↓
[ Create in Polar & Generate Link ] Button appears
    ↓
Admin clicks
    ↓
POST /api/admin/users/{clerk_id}/custom-plan/provision
    ↓
Returns checkout_url
    ↓
Display checkout_url with copy button
```

**Current Implementation:**
```
User Config Form
    ↓
[ Save Changes ] Button clicked
    ↓
PATCH /api/admin/users/{clerk_id}/limits  ← WRONG
    ↓
❌ Fails (wrong endpoint)
```

**What's missing:**
- Separate "Save Config" button
- Check if `custom_plan_polar_product_id` already exists (409 conflict handling)
- "Create in Polar" button (appears after first save)
- `/provision` endpoint call
- Checkout URL display modal
- Ability to edit config again before provisioning

---

### Gap 2: Price Validation Mismatch

**Frontend validation:**
```typescript
// src/lib/validation/schemas.ts
monthly_price_usd: z.coerce.number().nonnegative('Price must be ≥ 0.')
```
Allows $0.

**Backend validation:**
```python
# sapybase_ai_engine/main.py:5291
price = config.monthly_price_usd or 0
if price <= 0:
    raise HTTPException(status_code=400, detail="monthly_price_usd must be greater than 0...")
```
Rejects $0.

**Issue:** Frontend allows $0 (free custom plans), but backend rejects it. Frontend user experience is broken — they'll save a $0 plan, but get a 400 error when clicking "Create in Polar".

**Fix needed:** Frontend validation should require `price > 0`, with a message "Price must be greater than $0 for a paid custom plan."

---

### Gap 3: Trial Days Display

**What the admin sees:** A number field (0–30).

**What the admin should understand:**
- This is the **free trial period before first charge**
- On day N (trial_days), Polar will attempt the first charge
- If declined, Polar retries for 2 weeks
- The admin should confirm this behavior before provisioning

**Missing:**
- Explanation text: "After {trial_days} days, customer will be charged ${monthly_price_usd}/month"
- Warning if trial_days=0: "No trial period — customer charged immediately"
- Confirmation step before provisioning

---

### Gap 4: Custom Plan Dashboard Missing

**What exists:**
- Admin user list (all users, all tiers mixed together)

**What's missing:**
- A separate "Custom Plans" view/tab
- Shows only CUSTOM-tier users
- Columns:
  - Email
  - Status (with color: 🟢 ACTIVE / 🟡 AWAITING_PAYMENT / 🔴 PAYMENT_FAILED, etc.)
  - Billing Period End
  - Last Polar Event (webhook timestamp)
  - Quick Actions menu (buttons: Suspend, Extend, Activate, Reactivate, etc.)

**Data source:** `GET /api/admin/custom-plan/dashboard`

**Current:** Admins have to find the user in the general admin list, open their profile, and check... wait, they can't even see custom plan status in the current UI.

---

### Gap 5: Trial-to-Active Transition Display

**Current:** Modal shows config form, but no indication of:
- Whether provisioning is complete
- Whether customer has started checkout
- Trial status (if in trial, when does it end?)
- Billing period (when is next charge?)
- Subscription status

**Missing:**
- Status badge: "AWAITING_PAYMENT", "TRIAL_ACTIVE", "ACTIVE", etc.
- Billing dates displayed
- "Last webhook received" timestamp
- Link to Polar dashboard for this product

---

### Gap 6: Quick-Action Buttons Missing

**Backend supports:** suspend, reactivate, activate, extend, cancel

**Frontend has:** Nothing

**Needed:** For each user in the custom plans dashboard:
- A "..." (more actions) button that opens a menu or modal
- Each action requires:
  - Admin confirmation
  - Reason field (required, 1-500 chars)
  - For "extend": extend_days field (1-365)
  - Loading state while request in-flight
  - Error/success toast

---

### Gap 7: Metrics & Health Dashboard Missing

**Backend provides:** `GET /api/admin/custom-plan/metrics`

**Returns:**
```json
{
  "status_counts": {
    "ACTIVE": 6,
    "TRIAL_ACTIVE": 2,
    "AWAITING_PAYMENT": 1,
    "PAYMENT_FAILED": 1,
    "SUSPENDED": 0
  },
  "awaiting_payment_stale": [
    { "clerk_id": "...", "email": "...", "created_at": "..." }
  ],
  "awaiting_payment_stale_count": 1,
  "payment_failed_24h": 1,
  "payment_failed_7d": 3
}
```

**Frontend has:** Nothing

**Needed:**
- Pie chart: status distribution
- Alert box: "1 user in AWAITING_PAYMENT for >7 days" with re-send link button
- Alert box: "1 user hit PAYMENT_FAILED in last 24h" with contact customer button
- Last reconciliation time
- Manual reconciliation button

---

### Gap 8: Reconciliation Interface Missing

**Backend endpoint:** `POST /api/admin/custom-plan/reconcile`

**Returns:** Report with mismatches (orphans, status divergence, stale awaiting_payment, etc.)

**Frontend has:** Nothing

**Needed:**
- Button to trigger manual reconciliation
- Display of report (or at least summary: "✓ No mismatches" or "⚠ 3 mismatches found")
- Last auto-reconciliation timestamp

---

### Gap 9: Trial Period → Charge Transition UX

**What happens:**
1. Customer completes checkout → `subscription.created` → status = TRIAL_ACTIVE
2. After trial_days → Polar charges card
   - Success → `order.paid` + `subscription.updated` → status = ACTIVE
   - Failure → `subscription.past_due` → status = PAYMENT_FAILED

**Admin visibility:**
- Backend logs webhook, updates DB
- Daily reconciliation job flags mismatches

**Frontend shows:** **Nothing**

**What's missing:**
- Real-time or refresh-on-demand webhook status
- Indication that charge succeeded/failed
- (This is a "nice-to-have" for ongoing monitoring)

---

### Gap 10: Error States & Failure Modes

**Not handled on frontend:**

| Scenario | Error | How should frontend respond? |
|---|---|---|
| POLAR_ACCESS_TOKEN not set | 500 from `/provision` | Show message: "Polar API token not configured. Contact support." |
| Polar API timeout | 503 from `/provision` | Show message: "Polar API timeout. Please try again." |
| Already provisioned (409) | 409 from `/provision` | Show message: "This plan is already provisioned. To reconfigure: (1) Cancel the subscription (2) Clear product ID (3) Create a new plan." + link to contact support |
| Invalid config | 400 from any endpoint | Show backend error message |
| User not found | 404 | Show message: "User not found." |
| Unauthorized | 401 | Redirect to login or show session expired |
| Non-SUPER_ADMIN access | 403 | Show "Unauthorized" message |

---

## Implementation Priority

### Phase 1 (Blocking — Required for any custom plan provisioning)
1. ✅ Fix endpoint from `/limits` → `/api/admin/users/{clerk_id}`
2. ✅ Add "Save Config" → "Create in Polar" two-step workflow
3. ✅ Add `/provision` endpoint integration
4. ✅ Display checkout URL with copy button
5. ✅ Fix price validation (require > 0)
6. ✅ Add error handling for Polar API failures

### Phase 2 (Important — Admin can manage ongoing plans)
7. ✅ Custom plan dashboard (list view with status colors)
8. ✅ Quick-action buttons (suspend, extend, reactivate, cancel)
9. ✅ Metrics view (status distribution + alerts)
10. ✅ Reconciliation interface (manual trigger + report)

### Phase 3 (Nice-to-have — UX improvements)
11. ⚠️ Trial period explanation text
12. ⚠️ Billing period display in dashboard
13. ⚠️ Last webhook timestamp in dashboard
14. ⚠️ Real-time or periodic refresh of plan statuses

---

## Endpoint Mapping

### Current Frontend Calls

| Frontend Action | Endpoint | Status |
|---|---|---|
| Load admin users | `GET /api/admin/users` | ✅ Works |
| Load stats | `GET /api/admin/stats` | ✅ Works |
| Save user changes | `PATCH /api/admin/users/{id}/limits` | ❌ **Wrong endpoint** |

### Backend Endpoints Available But Not Wired

| Backend Endpoint | Method | Purpose | Frontend Status |
|---|---|---|---|
| `/api/admin/users/{clerk_id}` | `PATCH` | Update user tier + config | ❌ Not called (wrong endpoint used instead) |
| `/api/admin/users/{clerk_id}/custom-plan/provision` | `POST` | Create Polar product | ❌ Not called |
| `/api/admin/users/{clerk_id}/custom-plan/override` | `PATCH` | Admin actions (suspend, extend, etc.) | ❌ Not called |
| `/api/admin/custom-plan/dashboard` | `GET` | List all custom plans | ❌ Not called |
| `/api/admin/custom-plan/metrics` | `GET` | Status distribution + alerts | ❌ Not called |
| `/api/admin/custom-plan/reconcile` | `POST` | Manual reconciliation | ❌ Not called |

---

## Code Locations to Update

### Current Admin Modal
- **File:** `src/app/(app)/dashboard/settings/admin/page.tsx`
- **Lines:** 140–468 (UserEditModal component)
- **Changes needed:**
  - Fix endpoint call (line 498)
  - Split into two-step workflow (Save Config / Create in Polar)
  - Add `/provision` call
  - Display checkout URL result
  - Handle errors

### Validation Schema
- **File:** `src/lib/validation/schemas.ts`
- **Change:** `monthly_price_usd` validator should require > 0 for custom plans

### New Components Needed
- Custom plan dashboard page
- Metrics dashboard
- Quick-action modal (suspend, extend, etc.)
- Reconciliation trigger + result display

---

## Summary Table

| Gap | Severity | Impact | Effort | Status |
|---|---|---|---|---|
| Wrong endpoint | Critical | App crashes | 1 line | Needs fix |
| No provision flow | Critical | Can't create plans | Medium | Needs build |
| No checkout display | Critical | Admin can't send link | Small | Needs build |
| Price validation mismatch | High | 400 error after save | 1 line | Needs fix |
| No custom plan dashboard | High | Admin can't monitor | Large | Needs build |
| No quick actions | High | Admin can't manage | Medium | Needs build |
| No metrics | Medium | Admin can't see health | Medium | Needs build |
| No reconciliation UI | Medium | Ops can't debug | Small | Needs build |
| No error handling | Medium | Bad UX on failures | Small | Needs build |

---

## Validation Checklist

Before marking frontend "complete," verify:

- [ ] Endpoint fixed: `/limits` → `/api/admin/users/{clerk_id}`
- [ ] Price validation: `> 0` (not `≥ 0`)
- [ ] Save Config button: calls `PATCH /api/admin/users/{clerk_id}`
- [ ] Create in Polar button: calls `POST /api/admin/users/{clerk_id}/custom-plan/provision`
- [ ] Checkout URL display: copy-to-clipboard works
- [ ] Custom plan dashboard: lists all CUSTOM users with status/billing info
- [ ] Quick actions: suspend, extend, reactivate, cancel, activate all work
- [ ] Metrics view: status pie chart + alerts display
- [ ] Reconciliation: manual trigger works + report displays
- [ ] Error handling: Polar API failures show user-friendly messages
- [ ] Trial period: explanation text on config form
- [ ] 409 handling: instructions for re-provisioning shown
- [ ] All API responses handled: 401, 403, 404, 400, 500, 503

