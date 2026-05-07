# Custom Plan Flow — Architecture & Implementation Plan

**Status:** Proposed
**Author:** Architecture Discussion
**Date:** 2026-05-07
**Owners:** Backend (sapybase_ai_engine), Admin Panel, Polar Integration

---

## 1. Purpose

Define a production-grade, fully synchronized flow for **Custom Plans** so that:

- Custom plans are treated as first-class citizens alongside standard plans (BASIC/STARTER/PRO/BUSINESS).
- Polar (payment provider) is the **source of truth** for payment state.
- Database state and Polar state stay in sync via webhooks.
- Users without active payment cannot access paid features.
- Admins can override (activate/suspend/cancel) for testing or goodwill.
- All edge cases (failed payments, refunds, race conditions, webhook drops, manual overrides) are handled deterministically.

---

## 2. Current State (Problems)

| Area | Current Behavior | Problem |
|---|---|---|
| Plan creation | Admin saves `custom_plan_config`, tier auto-promotes to `CUSTOM` (main.py:4995–4999) | User has access **before** paying. |
| Polar product | Created **manually** in Polar dashboard, link copy-pasted to customer | No `product_id` stored in DB; webhook cannot map back. |
| Webhook mapping | `POLAR_PRODUCT_TIER_MAP` matches standard products only (main.py:5490) | Custom-product webhook events fall into `Unknown product_id` branch and are dropped. |
| Subscription status | Updated only for known products | Custom plans never receive trial start, payment success, payment failure, or renewal events. |
| Access gating | Based on `tier` only, not `subscription_status` for custom plans | A custom user keeps access whether they paid or not. |
| Trial handling | None for custom plans | No 14-day trial enforcement, no auto-charge linkage. |

**Net effect:** Custom plans are an open door — once admin saves the config, the user has features regardless of payment.

---

## 3. Goals & Non-Goals

### Goals
- Custom plan must follow the same **webhook-driven state machine** as standard plans.
- Polar product for a custom plan is **created programmatically** from the admin panel — not manually.
- Customer gets a 14-day free trial with card-on-file, then auto-charge monthly.
- Access is gated by **both** `tier == CUSTOM` **and** `subscription_status` being a permitting value.
- Admin override always logged in `admin_audit_log`.
- All state transitions are idempotent and tolerant of out-of-order webhook delivery.

### Non-Goals (this iteration)
- Add-on pricing as separate Polar SKUs (admin currently bundles them into the custom price).
- Multi-currency or tax handling (defer to Polar).
- Self-serve custom plan upgrades by end users (admin-driven only).

---

## 4. Database Schema Changes

### 4.1 `users` table — new column

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS custom_plan_polar_product_id VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_users_custom_plan_polar_product_id
  ON users (custom_plan_polar_product_id)
  WHERE custom_plan_polar_product_id IS NOT NULL;
```

**Why a top-level column (not inside `custom_plan_config` JSONB):**
- Webhook lookup uses `WHERE custom_plan_polar_product_id = %s` — must be indexed.
- JSONB containment lookups are slower and harder to constrain unique.
- Keeps `custom_plan_config` purely about *features/limits*; payment-link metadata stays separate.

### 4.2 `custom_plan_config` JSONB additions

Existing keys retained. Add:
```jsonc
{
  "monthly_price_usd": 299,
  "trial_days": 14,            // configurable per deal, default 14
  "polar_checkout_url": "...", // generated link, stored for admin re-send
  "polar_created_at": "...",   // when admin pressed "Create in Polar"
  "notes": "..."
}
```

### 4.3 `subscription_status` — expanded enum (stored as VARCHAR)

| Status | Meaning | Access? |
|---|---|---|
| `AWAITING_PAYMENT` | Custom plan created in DB + Polar; customer has not started checkout | ❌ |
| `TRIAL_ACTIVE` | Customer entered card; in 14-day free trial | ✅ |
| `ACTIVE` | Trial converted; recurring charges succeeding | ✅ |
| `PAYMENT_FAILED` | Last renewal attempt failed (after Polar's retries) | ❌ |
| `CANCELED` | User canceled; access until `billing_period_end` | ✅ until period end |
| `EXPIRED` | `billing_period_end` passed, no renewal | ❌ |
| `SUSPENDED` | Admin manually suspended | ❌ |
| `REVOKED` | Polar revoked (fraud/chargeback/manual) | ❌ |
| `REFUNDED` | Order refunded | ❌ |
| `PAUSED` | Polar pause (rare, billing paused, access preserved) | ✅ |

### 4.4 New table — `custom_plan_audit` (optional but recommended)

Already covered by `admin_audit_log` for admin actions. For **system-driven** state changes (webhook events), add lightweight entries to a new table or extend `admin_audit_log` with a `source = 'polar_webhook'` field. Recommended: extend existing table — fewer moving parts.

---

## 5. State Machine

```
                    [ AWAITING_PAYMENT ]
                            │
          customer enters card on Polar checkout
                            ▼
                    [ TRIAL_ACTIVE ]
                       │        │
       trial ends:     │        │ admin/user cancels
       Polar charges   │        ▼
                       │   [ CANCELED ]
                       │        │
              ┌────────┤        ▼ (period end)
              │        │   [ EXPIRED ]
              ▼        ▼
       [ ACTIVE ] ◄─── (renewal succeeds)
           │
   ┌───────┼────────┬──────────────┬──────────────┐
   │       │        │              │              │
   │ payment fails  │ admin suspend│ refund issued│
   │       │        │              │              │
   ▼       ▼        ▼              ▼              ▼
[PAYMENT_FAILED] [SUSPENDED]  [REFUNDED]     [REVOKED]

Note: PAUSED is a side-state during ACTIVE; not shown for clarity.
```

**Rules:**
- All transitions are webhook-driven *or* admin-driven (audit-logged).
- `AWAITING_PAYMENT` only ever transitions to `TRIAL_ACTIVE` (or stays — admin can cancel).
- Once `ACTIVE`, the plan never returns to `TRIAL_ACTIVE`.
- `EXPIRED` is a terminal state until admin re-activates or user re-subscribes.

---

## 6. Phase-by-Phase Flow

### Phase 1 — Admin creates the custom plan

**Admin Panel UI:**
- Form fields: plan name, price, trial days, max_bots, max_messages, max_chunks, model, feature toggles.
- Two-step: (1) **Save Draft** writes config but does NOT create Polar product. (2) **Create in Polar & Generate Link** is the commit action.

**Backend (new endpoint):**
`POST /api/admin/users/{clerk_id}/custom-plan/provision`

Steps (transactional):
1. Validate `custom_plan_config` (price > 0, trial_days in 0..30, model in `VALID_MODELS`, etc.).
2. Call Polar API: `POST /v1/products` with name, recurring monthly price, trial_period_days, metadata = `{ clerk_id, internal_plan_id }`.
3. Receive `product_id` from Polar.
4. In a single DB transaction:
   - Update `users.tier = 'CUSTOM'`
   - Update `users.subscription_status = 'AWAITING_PAYMENT'`
   - Update `users.custom_plan_config` with full config + `polar_created_at`
   - Update `users.custom_plan_polar_product_id = <product_id>`
   - Insert into `admin_audit_log`: action `CUSTOM_PLAN_PROVISION`, target=clerk_id, changes={ product_id, config }
5. Generate Polar checkout URL using product_id. Store in `custom_plan_config.polar_checkout_url`.
6. Return `{ product_id, checkout_url }` to admin UI.

**Failure modes & rollback:**
- Polar API fails → DB transaction is never opened; UI shows error, admin retries.
- Polar succeeds, DB write fails → background reconciliation job (Phase 9) detects orphan Polar product and either (a) flags for manual cleanup, or (b) retries the DB write. Recommend (a) with alert.
- Idempotency key on the Polar API call (use `clerk_id + version`) prevents duplicate products on retry.

### Phase 2 — Admin sends checkout link

- Admin Panel displays the `polar_checkout_url` with copy-to-clipboard.
- Optional: button to email the link (use existing transactional email service).
- No DB state change.

### Phase 3 — Customer completes checkout

Customer clicks link, enters card details on Polar's hosted checkout, confirms.

**Polar emits:** `subscription.created` (and possibly `subscription.active` together)

**Webhook handler (existing `/api/webhooks/polar`) — modified:**

```python
# After existing tier lookup
tier = POLAR_PRODUCT_TIER_MAP.get(product_id)

if tier is None:
    # Try custom plan lookup
    cursor.execute(
        "SELECT clerk_id, custom_plan_config FROM users "
        "WHERE custom_plan_polar_product_id = %s",
        (product_id,)
    )
    row = cursor.fetchone()
    if row:
        tier = "CUSTOM"
        clerk_id_from_lookup = row[0]
        # If clerk_id from event differs (placeholder vs real), reconcile
    else:
        # Truly unknown product — log CRITICAL and return 200 to stop retries
        log_critical_unknown_product(product_id)
        return {"status": "error", "message": "Unknown product"}
```

**State update on `subscription.created`:**
- `subscription_status` = `TRIAL_ACTIVE` (if `trial_end` in future) else `ACTIVE`
- `billing_period_end` = `current_period_end` from Polar payload
- `polar_customer_id` = from payload
- `last_polar_event_at` = event timestamp (existing high-water mark)

### Phase 4 — Trial period (14 days)

- User has access via `tier=CUSTOM` + `subscription_status=TRIAL_ACTIVE`.
- Access check (in `get_current_user` and `verify_api_key_and_origin`) must include status check (see §7).
- No webhook events expected mid-trial unless customer cancels.

### Phase 5 — Trial converts to paid

Day 14: Polar attempts first charge.

**Success path:**
- Polar emits `order.paid` (and `subscription.updated` with `status=active`).
- Handler updates `subscription_status = ACTIVE`, `billing_period_end = next_period_end`.

**Failure path:**
- Polar retries internally per its dunning policy (typically 3 attempts over ~2 weeks).
- During retries, Polar's subscription status is "past_due" — Polar does NOT immediately emit `revoked`.
- Recommendation: treat `subscription.updated` with `status=past_due` (or equivalent) by setting our `subscription_status = PAYMENT_FAILED`. **Verify exact Polar event names against their docs before implementation** — placeholders here.
- After all Polar retries exhaust → `subscription.revoked` → our status = `REVOKED`.

### Phase 6 — Recurring renewal (monthly)

Each renewal: `order.paid` + `subscription.updated`.
- Update `billing_period_end` to new `current_period_end`.
- No tier change. No status change (stays `ACTIVE`).

### Phase 7 — Cancellation

- Customer cancels in Polar portal (or admin cancels via Polar API).
- Polar emits `subscription.canceled` (graceful) → `subscription_status = CANCELED`, `billing_period_end` retained.
- On read (existing logic at main.py:1559–1579), when `today > billing_period_end` and status is `CANCELED` → flip tier to `FREE`, status to `EXPIRED`.

### Phase 8 — Refund

- Polar emits `order.refunded`.
- Handler sets `tier = FREE`, `subscription_status = REFUNDED`. Immediate access loss (existing policy A at main.py:5561).

---

## 7. Access Control Logic (the access gate)

Insert at the top of `get_current_user` and `verify_api_key_and_origin` (and any other access-decision point), **before** computing feature flags from `_plan`.

```python
# Pseudocode
def evaluate_access(user) -> AccessDecision:
    # Super admins bypass all gates
    if user.role == "SUPER_ADMIN":
        return AccessDecision.allow()

    # Free tier: always allow (free features only)
    if user.tier == "FREE":
        return AccessDecision.allow()

    # Standard paid tiers: existing logic
    if user.tier in ("BASIC", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"):
        return existing_standard_check(user)

    # Custom tier: explicit status gate
    if user.tier == "CUSTOM":
        s = user.subscription_status
        now = utcnow()

        if s == "AWAITING_PAYMENT":
            return AccessDecision.deny(
                code="CUSTOM_PLAN_PAYMENT_NOT_STARTED",
                message="Your custom plan is awaiting payment. "
                        "Use the checkout link sent by your account manager.",
                checkout_url=user.custom_plan_config.get("polar_checkout_url"),
            )

        if s == "TRIAL_ACTIVE":
            if user.billing_period_end and now > user.billing_period_end:
                # Trial ended but no conversion event yet — likely race
                return AccessDecision.deny(
                    code="CUSTOM_PLAN_TRIAL_EXPIRED_PENDING_CHARGE",
                    message="Trial ended; awaiting payment confirmation. "
                            "If this persists >24h, contact support.",
                )
            return AccessDecision.allow()

        if s == "ACTIVE":
            if user.billing_period_end and now > user.billing_period_end + GRACE_PERIOD:
                return AccessDecision.deny(
                    code="CUSTOM_PLAN_PERIOD_EXPIRED",
                    message="Subscription period has expired. "
                            "Renewal may have failed — please update your payment method.",
                )
            return AccessDecision.allow()

        if s == "CANCELED":
            if now > user.billing_period_end:
                # Background job or on-read should have flipped to EXPIRED
                return AccessDecision.deny(code="CUSTOM_PLAN_EXPIRED", ...)
            return AccessDecision.allow()  # grace until period end

        if s == "PAUSED":
            return AccessDecision.allow()  # Polar pause = access preserved

        # All terminal/blocked states
        if s in ("PAYMENT_FAILED", "SUSPENDED", "REVOKED", "REFUNDED", "EXPIRED"):
            return AccessDecision.deny(
                code=f"CUSTOM_PLAN_{s}",
                message=USER_FACING_MESSAGES[s],
                checkout_url=user.custom_plan_config.get("polar_checkout_url")
                             if s in ("PAYMENT_FAILED", "EXPIRED") else None,
            )

        # Unknown status — fail closed
        return AccessDecision.deny(code="CUSTOM_PLAN_UNKNOWN_STATE")
```

**Grace period:** `GRACE_PERIOD = 48 hours`. Absorbs Polar webhook delays so a renewal that's processing on Polar's side doesn't lock out the user.

---

## 8. User-Facing Error Messages

| Code | Message |
|---|---|
| `CUSTOM_PLAN_PAYMENT_NOT_STARTED` | "Your custom plan is ready. Complete checkout: [link]" |
| `CUSTOM_PLAN_TRIAL_EXPIRED_PENDING_CHARGE` | "Trial ended; payment is processing. Refresh in a few minutes." |
| `CUSTOM_PLAN_PERIOD_EXPIRED` | "Subscription expired. Update your payment method to restore access." |
| `CUSTOM_PLAN_PAYMENT_FAILED` | "Last charge failed. Update card on file: [link]" |
| `CUSTOM_PLAN_SUSPENDED` | "Subscription suspended. Contact your account manager." |
| `CUSTOM_PLAN_REVOKED` | "Subscription revoked. Contact support." |
| `CUSTOM_PLAN_REFUNDED` | "Subscription refunded. Subscribe again to restore access." |
| `CUSTOM_PLAN_EXPIRED` | "Subscription expired. Re-subscribe to continue." |
| `CUSTOM_PLAN_UNKNOWN_STATE` | "Account state is unclear. Please contact support." |

All responses include a stable `code` for frontend logic, plus a human-readable `message`. Frontend can render its own copy keyed off the `code`.

---

## 9. Admin Override

### 9.1 Endpoint
`PATCH /api/admin/users/{clerk_id}/custom-plan/override`

Body:
```json
{
  "action": "activate" | "suspend" | "reactivate" | "cancel" | "extend",
  "reason": "Q4 testing",
  "extend_days": 30  // only for "extend"
}
```

### 9.2 Behaviors

| Action | Effect | Polar Side |
|---|---|---|
| `activate` | Set `subscription_status = ACTIVE`, `billing_period_end = now + 30d`. For testing/goodwill where no payment is collected. | None — DB-only. Will desync if Polar later sends events. |
| `suspend` | Set `subscription_status = SUSPENDED`. | None. Customer keeps the Polar subscription but loses access here. |
| `reactivate` | From `SUSPENDED` → previous status (look up via audit log) or `ACTIVE`. | None. |
| `cancel` | Call Polar API to cancel subscription gracefully → webhook will set `CANCELED`. | Yes — calls Polar. |
| `extend` | Bump `billing_period_end` by N days. Goodwill grace. | None. |

### 9.3 Constraints
- Always audit-log to `admin_audit_log` with full diff + reason + admin clerk_id.
- `activate` requires `_fresh` (step-up auth, mirrors existing pattern at main.py:4956).
- Admin override sets `subscription_status_source = 'admin'` (new column or audit metadata) so future webhooks know this is a manual state and may need conflict resolution.

### 9.4 Conflict resolution (admin override vs webhook)
- Webhook with newer `last_polar_event_at` always wins, **except**:
  - If admin set `SUSPENDED`, webhook updates other fields but does not flip status away from `SUSPENDED` until admin reactivates.
- Document this rule clearly to avoid surprise.

---

## 10. Edge Cases & Exceptional Scenarios

### 10.1 Webhook arrives before user record exists
*Current handling exists* (main.py:5447 — pending placeholder). For custom plans, the user MUST exist (admin creates them first). If not found → log CRITICAL, return 200. This indicates either:
- Race: admin deleted user mid-checkout. (Very rare.)
- Bug: product_id was reassigned. (Investigate.)

### 10.2 Webhook signature mismatch
Existing handler returns 400. Polar will retry. ✓

### 10.3 Out-of-order webhook delivery
Existing `last_polar_event_at` high-water mark handles this. ✓

### 10.4 Duplicate webhook delivery
Existing `processed_webhooks` idempotency table handles this. ✓

### 10.5 Polar API down when admin tries to provision custom plan
- `/provision` endpoint returns 503.
- DB state remains untouched (no partial commit).
- Admin retries.

### 10.6 Polar product created but DB write fails
- Orphan Polar product exists.
- Reconciliation job (§11) detects: Polar has product with `metadata.clerk_id=X` but no DB row has that `custom_plan_polar_product_id`.
- Alert ops; manual decision: archive the Polar product or backfill DB.

### 10.7 Customer pays for an old (stale) checkout link after admin reconfigured the plan
- Admin should NEVER reuse the same product for a reconfigured plan.
- Implementation: `provision` endpoint requires the existing `custom_plan_polar_product_id` to be NULL or explicitly cleared; otherwise reject with 409.
- To reconfigure: admin must (a) cancel old subscription via Polar, (b) clear the product_id field, (c) create a new plan. Document this in admin UI.

### 10.8 Customer's card declines during trial conversion
- Polar retries automatically (3–4 times over ~2 weeks).
- During retries: `subscription_status = PAYMENT_FAILED`. User sees error on next API call.
- If retries succeed: `subscription_status = ACTIVE`. Access restored.
- If retries exhaust: `subscription.revoked` → status = `REVOKED`. Admin must intervene.

### 10.9 Two webhook events arrive concurrently
DB transaction with `SELECT ... FOR UPDATE` on the user row. Existing handler may need a small change to add row-level locking before update. Verify against current code path.

### 10.10 User downgrades from CUSTOM → standard plan
- Admin must (a) cancel the custom subscription in Polar, (b) clear `custom_plan_polar_product_id` and `custom_plan_config`, (c) set tier to the new standard tier.
- Or user purchases a standard plan: `subscription.created` for a standard product fires; webhook handler sees user already has CUSTOM tier with active subscription. Decide: reject? Allow? Archive the custom one?
- **Recommendation:** Webhook updates only honor product-tier mappings if the user's current `custom_plan_polar_product_id` is NULL or the new product is the *same* one. Otherwise log conflict, alert ops, no automatic state change.

### 10.11 Manual Polar dashboard edits
Admin should never edit a custom product price/features in Polar dashboard directly. Document this. Future improvement: a reconciliation job that diffs Polar product config vs DB `custom_plan_config` and alerts on mismatch.

### 10.12 Trial extended manually in Polar
Polar emits `subscription.updated` with new `current_period_end`. Webhook handler picks it up. ✓

### 10.13 Customer never starts checkout
- Status stays `AWAITING_PAYMENT` indefinitely.
- Background job: warn admin if status has been `AWAITING_PAYMENT` for >7 days. Optional auto-cleanup after 30 days (cancel the orphan Polar product, clear DB fields, alert admin).

### 10.14 Network partition between Polar webhook and our server
- Polar retries with exponential backoff for ~3 days.
- Reconciliation job (§11) catches anything missed.

### 10.15 Clock skew
Existing 60-second leeway in stale-event check (main.py:5470–5472) handles this. ✓

### 10.16 Refund partial vs full
Current handler treats any `order.refunded` as full access loss (Policy A). Document this. If partial refunds need different behavior, extend later.

### 10.17 User has both tier and custom_plan_config but `custom_plan_polar_product_id` is NULL
This means the plan was created via the old (current) flow and never linked to Polar. Treatment:
- One-time migration script: identify these users, mark `subscription_status = AWAITING_PAYMENT`, alert admin to re-provision via the new endpoint.
- Or grandfather them: leave as-is until next renewal cycle, then migrate.
- Decide before rollout.

---

## 11. Reconciliation & Monitoring

### 11.1 Daily reconciliation job
Cron job (or scheduled agent) that:
1. Lists all Polar subscriptions via API.
2. For each: confirm DB state matches (`tier`, `subscription_status`, `billing_period_end`).
3. Lists all DB users with `tier=CUSTOM`.
4. For each: confirm a Polar subscription exists (or status is `AWAITING_PAYMENT`/`EXPIRED`/`REVOKED`/`REFUNDED`).
5. Emit a report; alert on mismatches >0.

### 11.2 Metrics to track
- Count of users in each `subscription_status`.
- Time spent in `AWAITING_PAYMENT` (alert if >7 days).
- Count of `PAYMENT_FAILED` per day (alert on spike).
- Webhook failure rate.
- Reconciliation mismatch count.

### 11.3 Admin dashboard surface
Show per-custom-plan-user:
- Current status with color (green/amber/red).
- Last webhook event timestamp.
- Polar subscription link.
- Quick actions: re-send checkout link, suspend, reactivate, cancel, extend.

---

## 12. Implementation Plan (Phased)

### Phase A — Schema & access gate (low risk, deploy first)
1. Migration: add `custom_plan_polar_product_id` column + index.
2. Add new `subscription_status` values to documentation; no schema change (VARCHAR).
3. Update access-control code paths to check `subscription_status` for CUSTOM tier.
4. Default any existing CUSTOM users to `subscription_status = ACTIVE` (grandfather) OR `AWAITING_PAYMENT` (force re-provision) — **decide in §10.17**.
5. Deploy, verify no regressions for existing users.

### Phase B — Polar product creation API
1. Implement `POST /api/admin/users/{clerk_id}/custom-plan/provision`.
2. Wire admin panel UI: "Create Polar Product" button.
3. Test in Polar sandbox.

### Phase C — Webhook handler extension
1. Add custom-plan lookup branch when `product_id` not in `POLAR_PRODUCT_TIER_MAP`.
2. Handle all events for custom plans the same way as standard.
3. Add row-level locking if not already present.
4. Test end-to-end in sandbox: provision → checkout → trial → conversion → renewal → cancel → refund.

### Phase D — Admin override endpoint
1. Implement `PATCH /api/admin/users/{clerk_id}/custom-plan/override`.
2. Enforce step-up auth.
3. Audit-log all actions.
4. Wire admin UI.

### Phase E — Reconciliation & monitoring
1. Build daily reconciliation cron.
2. Add metrics + alerts.
3. Surface status in admin dashboard.

### Phase F — Documentation & runbooks
1. Document admin workflow ("How to create a custom plan").
2. Document support runbook ("Customer says payment failed").
3. Document rollback plan.

---

## 13. Testing Strategy

### Unit tests
- Access-control function: every status × every edge (period_end past/future, role variations).
- Webhook handler branches: known product, custom product, unknown product, missing user.
- State machine transitions: every legal and illegal pair.

### Integration tests (Polar sandbox)
- Provision → checkout (mocked card) → trial start → trial end success → renewal → cancel.
- Same flow with card decline at trial end.
- Webhook out-of-order delivery.
- Duplicate webhook delivery.
- Admin override mid-flow.

### Manual QA
- Admin UI happy path.
- Customer error message rendering for each blocked-status code.

---

## 14. Rollback Plan

If post-deploy issues:
1. Feature-flag the new `provision` endpoint — can disable without deploy.
2. Webhook handler change is additive (new branch); old branch unchanged. Revert is safe.
3. New column is nullable; reverting code does not corrupt data.
4. Access-gate code: keep old behavior behind a feature flag for first week.

---

## 15. Open Questions

1. **Add-on pricing:** currently rolled into one custom price. If add-ons need separate Polar SKUs (for itemized invoicing), revisit later. — *Deferred.*
2. **Existing CUSTOM users (§10.17):** ~~grandfather as ACTIVE or force AWAITING_PAYMENT~~ — **Decided: force AWAITING_PAYMENT.** Run a one-time migration to set all users with `tier=CUSTOM` and no linked `custom_plan_polar_product_id` to `subscription_status='AWAITING_PAYMENT'`. Admin must re-provision each via the new endpoint. Ensures no null records and all state is explicit.
3. **Polar event names for past_due / payment_failed:** ~~Verify exact class names.~~ — **Resolved (2026-05-07, verified against installed polar_sdk).** See §16.1 below.
4. **Self-serve cancellation:** ~~Confirm with product.~~ — **Decided: route through Polar customer portal.** No custom cancellation UI built in-app. The user dashboard will link to the Polar customer portal URL (`https://portal.polar.sh`) where the customer manages their own subscription, card, and cancellation. This is Polar's hosted self-service interface. No backend endpoint needed from our side for cancellation.

---

## 16. Verified Polar SDK Event Reference

> Verified against installed `polar_sdk` at `venv/lib/python3.12/site-packages/polar_sdk/models/`.

### 16.1 Subscription status values (`SubscriptionStatus` enum)

| Polar Status | Meaning |
|---|---|
| `incomplete` | Initial state; payment not yet confirmed |
| `incomplete_expired` | Initial payment failed (checkout abandoned) |
| `trialing` | In free trial period |
| `active` | Subscription live and paid |
| `past_due` | Payment failed; Polar is retrying |
| `canceled` | Gracefully canceled |
| `unpaid` | All Polar retries exhausted; not yet revoked |

### 16.2 Webhook event classes and our mapping

| Polar Event | Class name pattern | Our `subscription_status` |
|---|---|---|
| `subscription.created` (trialing) | `"SubscriptionCreated"` in class | `TRIAL_ACTIVE` |
| `subscription.created` (no trial) | `"SubscriptionCreated"` in class | `ACTIVE` |
| `subscription.active` | `"SubscriptionActive"` in class | `ACTIVE` |
| `subscription.updated` (active) | `"SubscriptionUpdated"` + `status=active` | `ACTIVE`, update `billing_period_end` |
| `subscription.updated` (canceled at period end) | `"SubscriptionUpdated"` + `cancel_at_period_end=True` | `CANCELED` |
| **`subscription.past_due`** | **`"PastDue"` in class** | **`PAYMENT_FAILED`** ← new handler needed |
| `subscription.revoked` | `"SubscriptionRevoked"` in class | `REVOKED`, tier→FREE |
| `subscription.canceled` | `"SubscriptionCanceled"` in class | `CANCELED`, keep tier until period_end |
| `subscription.paused` | `"SubscriptionPaused"` in class | `PAUSED` (access preserved) |
| `subscription.resumed` | `"SubscriptionResumed"` in class | `ACTIVE` |
| `subscription.uncanceled` | `"SubscriptionUncanceled"` in class | `ACTIVE` |
| `order.paid` | `"OrderPaid"` in class | `ACTIVE`, update `billing_period_end` |
| `order.refunded` | `"OrderRefunded"` in class | `REFUNDED`, tier→FREE |

**The only gap in the current handler is `subscription.past_due`** — no branch exists for it in `main.py`. It will fall into the `else` branch, get logged as unhandled, and no status change will occur. This must be added in Phase C.

### 16.3 Trial lifecycle on Polar side

```
Checkout complete (card entered) 
  → Polar: subscription.created (status=trialing)
  → Our DB: subscription_status = TRIAL_ACTIVE
  
Day 14 — Polar charges card:
  Success → Polar: order.paid + subscription.updated (status=active)
           → Our DB: subscription_status = ACTIVE, billing_period_end updated

  Failure → Polar: subscription.past_due (status=past_due), retries begin
           → Our DB: subscription_status = PAYMENT_FAILED
  
  All retries fail → Polar: subscription.revoked
                   → Our DB: tier=FREE, subscription_status=REVOKED
```

### 16.4 Self-serve cancellation (Polar Customer Portal)

Polar provides a hosted customer portal at `https://portal.polar.sh`. When the customer authenticates there, they can:
- View subscription details
- Update payment method
- Cancel subscription
- Download invoices

**Our responsibility:** Expose a "Manage Subscription" link in the user dashboard that points to the Polar customer portal. When the customer cancels there, Polar emits `subscription.canceled` → our webhook handler sets `CANCELED` + retains `billing_period_end`. No custom cancellation UI or backend endpoint needed from our side.

---

## 17. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-07 | Polar product creation = programmatic (Option A) | Eliminates manual sync errors; everything tracked. |
| 2026-05-07 | `custom_plan_polar_product_id` as top-level column | Indexable, fast webhook lookup. |
| 2026-05-07 | Grace period 48h on ACTIVE expiration | Absorbs webhook delivery delays. |
| 2026-05-07 | Admin override does not call Polar (except `cancel`) | Keeps testing/goodwill flows independent of payment provider. |
| 2026-05-07 | Refund = immediate access loss | Aligns with existing Policy A. |
| 2026-05-07 | Existing CUSTOM users → force `AWAITING_PAYMENT` | No null records; all state is explicit; admin must re-provision. |
| 2026-05-07 | `subscription.past_due` → `PAYMENT_FAILED` | Verified against polar_sdk; recoverable state, customer can update card. |
| 2026-05-07 | Self-serve cancellation → Polar customer portal | No custom UI to build or maintain; Polar handles card updates, invoices, and cancellation. |
