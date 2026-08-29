# Frontend Analysis Summary — 1-Page Overview

## What Works ✅
- Admin user list with search & filter
- Custom plan config form (price, trial, features, etc.)
- Form validation using Pydantic schema
- Tier selector dropdown
- Account suspend/activate toggle

## What's Broken or Missing ❌

### Critical Issues (Must Fix Before Going Live)

| # | Issue | Impact | Effort |
|---|---|---|---|
| 1 | **Wrong endpoint** — code calls `/limits` instead of `/api/admin/users/{id}` | App crashes on save | 1 line fix |
| 2 | **Price validation** — allows $0 but backend rejects it | User gets 400 error after save | 1 line fix |
| 3 | **No provision workflow** — missing "Create in Polar" button and `/provision` call | Can't generate checkout links | Medium |
| 4 | **No checkout URL display** — after provisioning, URL not shown to admin | Can't send link to customer | Small |
| 5 | **No custom plan dashboard** — admins can't see/monitor active custom plans | Can't manage customers | Large |
| 6 | **No override actions** — no suspend/extend/reactivate buttons | Can't respond to issues | Medium |

### Missing Features (Secondary Priority)

| Feature | What's Needed | Effort |
|---|---|---|
| Metrics view | Pie chart of status distribution + alerts | Medium |
| Reconciliation UI | Button to manually reconcile + show report | Small |
| Error handling | User-friendly messages for Polar API failures | Small |
| Trial explanation | Text explaining what happens after trial ends | Small |

---

## The Flow (What Should Happen)

### Current (Broken)
```
Admin fills config → Click "Save Changes" → 500 error (wrong endpoint)
```

### What Should Happen (2-Step)

**Step 1: Save Config (Locally)**
```
Admin fills: Name, Price ($299), Trial (14 days), Features
     ↓
Click "Save Config"
     ↓
POST to: PATCH /api/admin/users/{clerk_id}
     Body: { tier: "CUSTOM", custom_plan_config: {...} }
     ↓
✓ Config saved
```

**Step 2: Provision in Polar**
```
Button appears: "Create in Polar & Generate Link"
     ↓
Admin clicks
     ↓
POST to: POST /api/admin/users/{clerk_id}/custom-plan/provision
     ↓
Backend: calls Polar API → gets checkout URL back
     ↓
Admin sees: 
     ┌─────────────────────────────────┐
     │ ✓ Polar Product Created!        │
     │                                 │
     │ Checkout Link:                  │
     │ https://buy.polar.sh/prod_123   │
     │          [Copy] [Email Link]    │
     └─────────────────────────────────┘
```

---

## File That Needs Changes

**`src/app/(app)/dashboard/settings/admin/page.tsx` (657 lines)**

### Key Changes Needed:

1. **Line 498** — Wrong endpoint
   ```typescript
   // WRONG:
   authFetch(`/api/admin/users/${clerkId}/limits`, {
   
   // CORRECT:
   authFetch(`/api/admin/users/${clerkId}`, {
   ```

2. **Lines 459–464** — Split into two buttons
   ```typescript
   // CHANGE FROM:
   <button onClick={handleSave}>Save Changes</button>
   
   // TO:
   <button onClick={handleSave}>Save Config</button>
   {user.custom_plan_enabled && custom_plan_polar_product_id ? (
     <button onClick={handleProvision}>Create in Polar & Generate Link</button>
   ) : null}
   ```

3. **Add provision handler**
   ```typescript
   const handleProvision = () => {
     // Call POST /api/admin/users/{clerk_id}/custom-plan/provision
     // On success: display checkout_url
     // On error: show error message
   }
   ```

4. **Update schema validation** — `src/lib/validation/schemas.ts`
   ```typescript
   // CHANGE FROM:
   monthly_price_usd: z.coerce.number().nonnegative(...)
   
   // TO:
   monthly_price_usd: z.coerce.number().positive(...)  // > 0, not ≥ 0
   ```

---

## New Pages/Sections Needed

1. **Custom Plan Dashboard** (New page)
   - URL: `/dashboard/settings/admin/custom-plans`
   - Shows: All CUSTOM-tier users in a table
   - Columns: Email, Status (color-coded), Billing End, Last Webhook, Actions

2. **Metrics View** (New section/page)
   - Pie chart of subscription status distribution
   - Alert: "X users in AWAITING_PAYMENT >7 days"
   - Alert: "X users hit PAYMENT_FAILED in last 24h"

3. **Quick Actions Modal** (New modal)
   - Trigger: Click "..." button on each custom plan user
   - Options: Suspend, Extend (+ days input), Activate, Reactivate, Cancel
   - Each requires reason field

---

## Endpoints That Need Integration

| Endpoint | Currently Called? | Frontend Status |
|---|---|---|
| `PATCH /api/admin/users/{id}` | ❌ Wrong endpoint used | Needs fix |
| `POST /api/admin/users/{id}/custom-plan/provision` | ❌ Not called | Needs new |
| `PATCH /api/admin/users/{id}/custom-plan/override` | ❌ Not called | Needs new |
| `GET /api/admin/custom-plan/dashboard` | ❌ Not called | Needs new |
| `GET /api/admin/custom-plan/metrics` | ❌ Not called | Needs new |
| `POST /api/admin/custom-plan/reconcile` | ❌ Not called | Needs new |

---

## Risk Assessment

### If Deployed As-Is
- ❌ Admins **cannot** create custom plans (endpoint broken)
- ❌ Admins **cannot** get checkout links (endpoint broken + no provision call)
- ❌ Admins **cannot** manage active custom plans (no dashboard)
- ❌ Bad UX on errors (no error handling)

**Verdict:** NOT PRODUCTION READY

### To Make Production Ready

**Minimum (Phase 1):**
- Fix endpoint bug (1 line)
- Fix price validation (1 line)
- Add "Create in Polar" button + `/provision` call (medium effort)
- Display checkout URL (small effort)

**Recommended (Phase 2):**
- Add custom plan dashboard
- Add quick-action buttons
- Add error handling
- Add metrics view

---

## Next Steps

1. **Approve this analysis** — confirm the gaps are correct
2. **Prioritize fixes** — Phase 1 (critical) vs Phase 2 (nice-to-have)
3. **Implement** — Fix endpoint bugs first, then add new features
4. **Test** — Verify each flow works end-to-end with real Polar sandbox
5. **Deploy** — Only Phase 1 features need to ship first; Phase 2 can follow

