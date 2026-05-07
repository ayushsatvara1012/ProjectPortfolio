# Frontend Component Map — What Needs to Be Built

## Current State

```
Admin Dashboard
├── User List
│   ├── Search
│   ├── Tier Filter
│   ├── Stats (total_users, total_companies, etc.)
│   └── User Rows (click to open modal)
│       └── User Edit Modal ← BROKEN
│           ├── Tier Selector
│           ├── Account Status Toggle
│           └── Custom Plan Config Form
│               ├── Plan Name
│               ├── Monthly Price ← VALIDATION BUG
│               ├── Trial Days
│               ├── Model Dropdown
│               ├── Limits (Bots, Messages, Chunks)
│               ├── Feature Toggles
│               ├── Notes
│               └── [Save Changes] ← CALLS WRONG ENDPOINT
```

---

## Needed State

```
Admin Dashboard
├── Navigation Tabs
│   ├── All Users
│   │   └── [EXISTING, FIX ENDPOINT BUG]
│   │
│   ├── Custom Plans ⭐ NEW
│   │   └── Custom Plan Dashboard
│   │       ├── Search/Filter
│   │       ├── Stats Box
│   │       │   ├── Total Custom Plan Users
│   │       │   ├── Status Distribution (pie chart)
│   │       │   ├── AWAITING_PAYMENT >7d Alert
│   │       │   └── PAYMENT_FAILED 24h Alert
│   │       │
│   │       ├── Custom Plans Table
│   │       │   ├── Columns:
│   │       │   │   ├── Email
│   │       │   │   ├── Status (🟢 ACTIVE / 🟡 AWAITING_PAYMENT / 🔴 PAYMENT_FAILED)
│   │       │   │   ├── Billing Period End
│   │       │   │   ├── Last Polar Event
│   │       │   │   ├── Quick Actions
│   │       │   │   └── Expand Row
│   │       │   │
│   │       │   └── Row Expand Detail
│   │       │       ├── Plan Config (read-only)
│   │       │       ├── Polar Link
│   │       │       ├── Last Event Timestamp
│   │       │       ├── Polar Subscription Link
│   │       │       └── Action Buttons:
│   │       │           ├── [Suspend]
│   │       │           ├── [Reactivate]
│   │       │           ├── [Extend]
│   │       │           ├── [Activate]
│   │       │           ├── [Cancel]
│   │       │           └── [Edit Config]
│   │       │
│   │       └── Reconciliation Box
│   │           ├── Last Reconciliation Time
│   │           ├── Status: ✓ No mismatches / ⚠ N mismatches
│   │           ├── [Manual Reconcile] Button
│   │           └── Report Display (if mismatches)
│   │
│   └── Metrics ⭐ NEW
│       ├── Status Distribution Chart (pie/bar)
│       ├── Alerts
│       │   ├── AWAITING_PAYMENT >7d
│       │   │   ├── User list
│       │   │   ├── [Re-send Link]
│       │   │   └── [Send Reminder Email]
│       │   └── PAYMENT_FAILED Spike
│       │       ├── User list
│       │       ├── [Contact Customer]
│       │       └── [Force Activate]
│       ├── Payment Trend (if available)
│       └── Webhook Health
│           ├── Last webhook received
│           └── Failure rate
```

---

## Component Tree

### Phase 1 (Critical Fixes)

```
src/app/(app)/dashboard/settings/admin/page.tsx
├── UserEditModal [MODIFY]
│   ├── Tier Selector
│   ├── Account Status Toggle
│   ├── Custom Plan Config Form [MODIFY]
│   │   ├── Plan Name Input
│   │   ├── Price Input [FIX VALIDATION]
│   │   ├── Trial Days Input
│   │   ├── Model Dropdown
│   │   ├── Limits Form
│   │   └── Features Checkboxes
│   ├── Footer Buttons [MODIFY]
│   │   ├── [Cancel]
│   │   ├── [Save Config] [NEW BUTTON]
│   │   └── [Create in Polar & Generate Link] [NEW BUTTON - CONDITIONAL]
│   │
│   └── Checkout URL Modal [NEW] (shown after provision)
│       ├── Checkout URL Display
│       ├── [Copy to Clipboard]
│       ├── [Email Link]
│       └── [Done]
```

### Phase 2 (Dashboard & Monitoring)

```
src/app/(app)/dashboard/settings/admin/
├── page.tsx [MODIFY - ADD TAB NAVIGATION]
├── custom-plans/ [NEW FOLDER]
│   ├── page.tsx [CUSTOM PLANS DASHBOARD]
│   │   ├── CustomPlanStats [NEW COMPONENT]
│   │   │   ├── Total Custom Users
│   │   │   ├── StatusDistribution Chart [NEW COMPONENT]
│   │   │   ├── StaleAwaitingAlert [NEW COMPONENT]
│   │   │   └── PaymentFailedAlert [NEW COMPONENT]
│   │   │
│   │   ├── CustomPlansTable [NEW COMPONENT]
│   │   │   ├── Search Input
│   │   │   ├── Filter Dropdowns
│   │   │   ├── Table Rows
│   │   │   │   ├── Email
│   │   │   │   ├── StatusBadge [MODIFY - ADD COLOR CODES]
│   │   │   │   ├── BillingEndDate
│   │   │   │   ├── LastPolarEvent
│   │   │   │   ├── [Expand]
│   │   │   │   └── [More Actions Menu]
│   │   │   │
│   │   │   └── Expand Detail
│   │   │       ├── PlanConfigDisplay [NEW COMPONENT]
│   │   │       ├── PolarLinks [NEW COMPONENT]
│   │   │       ├── QuickActionsButtons [NEW COMPONENT]
│   │   │       │   ├── SuspendModal [NEW COMPONENT]
│   │   │       │   ├── ReactivateModal [NEW COMPONENT]
│   │   │       │   ├── ExtendModal [NEW COMPONENT]
│   │   │       │   ├── ActivateModal [NEW COMPONENT]
│   │   │       │   └── CancelModal [NEW COMPONENT]
│   │   │       └── [Edit Config Link]
│   │   │
│   │   └── ReconciliationBox [NEW COMPONENT]
│   │       ├── Last Sync Time
│   │       ├── Status Indicator
│   │       ├── [Manual Reconcile] Button
│   │       └── Report Display [CONDITIONAL]
│   │
│   └── metrics/
│       └── page.tsx [METRICS DASHBOARD]
│           ├── StatusDistributionChart [NEW COMPONENT - REUSE FROM STATS]
│           ├── AlertSections [NEW COMPONENT]
│           │   ├── StaleAwaitingAlert [REUSE FROM STATS]
│           │   └── PaymentFailedAlert [REUSE FROM STATS]
│           ├── PaymentTrend [OPTIONAL NEW COMPONENT]
│           └── WebhookHealth [NEW COMPONENT]
```

---

## API Integration Points

### Current (Working)
```
Admin Page
├─ GET /api/admin/users ✅
├─ GET /api/admin/stats ✅
└─ PATCH /api/admin/users/{id}/limits ❌ (WRONG - NEEDS FIX)
```

### Needed (Phase 1)
```
UserEditModal
├─ PATCH /api/admin/users/{clerk_id} ✅ [NEW CALL]
│   Body: { tier: "CUSTOM", custom_plan_config: {...} }
│
└─ POST /api/admin/users/{clerk_id}/custom-plan/provision ✅ [NEW CALL]
    Body: { config: {...} }
    Response: { checkout_url, product_id, ... }
```

### Needed (Phase 2)
```
CustomPlansDashboard
├─ GET /api/admin/custom-plan/dashboard ✅ [NEW CALL]
│   Response: { custom_plan_users: [...] }
│
├─ PATCH /api/admin/users/{clerk_id}/custom-plan/override ✅ [NEW CALL]
│   Body: { action: "suspend|extend|...", reason, extend_days? }
│
├─ GET /api/admin/custom-plan/metrics ✅ [NEW CALL]
│   Response: { status_counts, awaiting_payment_stale, ... }
│
└─ POST /api/admin/custom-plan/reconcile ✅ [NEW CALL]
    Response: { db_custom_users, mismatches, ... }
```

---

## Modal Flows

### UserEditModal → Custom Plan Creation

```
┌─────────────────────────────┐
│ User Edit Modal             │
├─────────────────────────────┤
│ Tier: [CUSTOM] ↓            │
│ Status: [Active]            │
│                              │
│ [Custom Plan Builder]        │
│ ☑ Enable Custom Plan         │
│                              │
│ ├ Plan Name: ________        │
│ ├ Price: $ ________          │
│ ├ Trial Days: ________       │
│ ├ Model: [gpt-4o] ↓          │
│ ├ Max Bots: ________         │
│ ├ Max Messages: ________     │
│ ├ Max Chunks: ________       │
│ ├ ☐ Lead Capture            │
│ └ ...                        │
│                              │
│ [Cancel] [Save Config]      │  ← Step 1
└─────────────────────────────┘
           ↓
     (config saved)
           ↓
┌─────────────────────────────┐
│ User Edit Modal             │
│ (same form, updated)         │
│ ...                          │
│ [Cancel] [Create in Polar]  │  ← Step 2 (NEW BUTTON)
└─────────────────────────────┘
           ↓
  (calling /provision)
           ↓
┌─────────────────────────────┐
│ ✓ Polar Product Created!    │
├─────────────────────────────┤
│ Checkout Link:              │
│ https://buy.polar.sh/...    │
│           [Copy] [Email]    │
│                              │
│ [Done]                       │
└─────────────────────────────┘
```

### Quick Actions Modal

```
┌─────────────────────────────┐
│ Extend Billing Period        │
├─────────────────────────────┤
│ User: john@example.com       │
│ Current End: 2026-06-15      │
│                              │
│ Extend by: [____] days       │
│ (1-365)                      │
│                              │
│ Reason: ________________     │
│ (required, max 500 chars)    │
│                              │
│ [Cancel] [Extend]           │
└─────────────────────────────┘
```

---

## Data Flow for Provision

```
Admin fills config
        ↓
[Save Config] clicked
        ↓
PATCH /api/admin/users/{id}
        ↓
Backend: saves config, tier=CUSTOM
        ↓
Response: { status: "saved", ... }
        ↓
Frontend: disable form, show [Create in Polar] button
        ↓
[Create in Polar] clicked
        ↓
POST /api/admin/users/{id}/custom-plan/provision
        ↓
Backend: Calls Polar API, creates product
        ↓
Response: { status: "provisioned", checkout_url, product_id }
        ↓
Frontend: Show Checkout URL Modal
        ↓
Admin: Copy or Email link
```

---

## Error Handling Points

Each of these needs a try-catch + toast/modal error display:

1. **Save Config fails** (400, 404, 500)
   - Show: error message from backend
   - Action: stay in form, allow retry

2. **Create in Polar fails** (400, 409, 503, 500)
   - 400: Invalid config (e.g., price=0) → show error
   - 409: Already provisioned → show "already provisioned" message
   - 503: Polar API down → show "Polar API unavailable, try again later"
   - 500: Server error → generic error

3. **Override actions fail** (400, 401, 403, 404, 500)
   - Show error message
   - Explain impact (e.g., "User still has access" vs "User now blocked")

4. **Fetch dashboard/metrics fails**
   - Show: "Failed to load data"
   - Offer: Retry button

---

## Component Reusability

Components that can be shared across multiple views:

1. **StatusBadge** [UPDATE]
   - Current: only "Active" vs "Suspended"
   - Needed: ACTIVE, TRIAL_ACTIVE, AWAITING_PAYMENT, PAYMENT_FAILED, SUSPENDED, REVOKED, REFUNDED, EXPIRED, PAUSED, CANCELED
   - Colors: green (active), amber (pending), red (blocked)

2. **AlertBox** [NEW]
   - Icon + title + message
   - Used in: Metrics, Dashboard stats

3. **ConfirmationModal** [NEW]
   - Used by: All quick action buttons

4. **LoadingSpinner** [EXISTING?]
   - Use for: Async operations

5. **ToastNotification** [EXISTING?]
   - Use for: Success/error feedback

