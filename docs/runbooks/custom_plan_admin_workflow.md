# Custom Plan Admin Workflow

**Audience:** Sapybase admins creating and managing custom plans for enterprise customers.
**Last updated:** 2026-05-07

---

## Overview

A custom plan is a per-customer pricing arrangement managed entirely by admins. The flow is:

1. Admin creates the plan config and provisions it in Polar (generates a Polar product + checkout link).
2. Admin sends the checkout link to the customer.
3. Customer enters card details — Polar handles the 14-day trial and recurring billing.
4. Webhooks keep the DB in sync automatically.
5. Admin uses the override endpoint for exceptions (suspend, extend, goodwill activate, cancel).

> **Key rule:** The customer must never have access before paying. The system enforces this via `subscription_status`. Do not manually set `tier=CUSTOM` without going through `/provision`.

---

## Step 1 — Create the plan config

Use the admin panel to fill in the plan config for the target user (`clerk_id`):

| Field | Description | Constraints |
|---|---|---|
| `monthly_price_usd` | Monthly charge in USD | Must be > 0 |
| `trial_days` | Free trial length | 0–30 |
| `max_bots` | Number of chatbots | Integer |
| `max_messages` | Monthly message quota | Integer |
| `max_chunks` | Knowledge base chunk limit | Integer |
| `model` | AI model override | Must be a `VALID_MODEL` |
| `notes` | Internal deal notes | Optional |

At this point, **do not** provision in Polar yet. The user can be in a draft state.

---

## Step 2 — Provision in Polar (`/provision`)

Once config is finalized, call:

```
POST /api/admin/users/{clerk_id}/custom-plan/provision
```

Body:
```json
{
  "config": {
    "monthly_price_usd": 299,
    "trial_days": 14,
    "max_bots": 5,
    "max_messages": 50000,
    "max_chunks": 10000,
    "model": "gpt-4o"
  }
}
```

**Requires:** step-up auth (token must be <10 minutes old).

What this does:
- Creates a recurring monthly Polar product via Polar API (idempotent — uses `Idempotency-Key: custom-plan-{clerk_id}`).
- Sets `users.custom_plan_polar_product_id` to the new Polar product ID.
- Sets `subscription_status = AWAITING_PAYMENT`.
- Stores the checkout URL in `custom_plan_config.polar_checkout_url`.
- Audit-logs the action.

Response:
```json
{
  "status": "provisioned",
  "product_id": "prod_xxx",
  "checkout_url": "https://buy.polar.sh/prod_xxx",
  "polar_env": "production"
}
```

**409 Conflict:** If `custom_plan_polar_product_id` is already set, the endpoint rejects. To re-provision (e.g., price change), you must first cancel the old subscription and clear the product ID — see [Re-provisioning a Custom Plan](#re-provisioning-a-custom-plan) below.

---

## Step 3 — Send the checkout link

Copy `checkout_url` from the API response (or from the admin dashboard) and send it to the customer via email, Slack, or the admin panel's copy-to-clipboard button.

The link is also retrievable at any time from `GET /api/admin/custom-plan/dashboard` under `polar_checkout_url` for the relevant user.

---

## Step 4 — Customer completes checkout

The customer clicks the link, enters card details on Polar's hosted page, and confirms.

Polar emits `subscription.created` → our webhook handler sets `subscription_status = TRIAL_ACTIVE` (14-day free trial starts).

At trial end (day 14), Polar charges the card:
- **Success** → `order.paid` + `subscription.updated` → status = `ACTIVE`.
- **Failure** → `subscription.past_due` → status = `PAYMENT_FAILED`. Polar retries over ~2 weeks.
- **All retries fail** → `subscription.revoked` → status = `REVOKED`.

No manual steps needed during this phase.

---

## Step 5 — Monitor via the dashboard

Check status at any time:

```
GET /api/admin/custom-plan/dashboard
```

Returns all CUSTOM users sorted by urgency (PAYMENT_FAILED → SUSPENDED → AWAITING_PAYMENT → rest).

Each record includes:
- `subscription_status` + `status_color` (green / amber / red)
- `billing_period_end`
- `last_polar_event_at` — last webhook received; use this to spot dropped webhooks
- `polar_subscription_link` — direct link to Polar dashboard for this product
- `quick_actions` — valid override actions from the current status

Metrics summary:
```
GET /api/admin/custom-plan/metrics
```

Returns status distribution, users stuck in AWAITING_PAYMENT >7 days, and PAYMENT_FAILED spike counts.

---

## Override actions

Use `PATCH /api/admin/users/{clerk_id}/custom-plan/override` for all manual interventions.

Always supply a `reason` (required, 1–500 chars). All actions are audit-logged.

| Action | When to use | Effect |
|---|---|---|
| `activate` | Goodwill access, testing, unblock a stuck user | `ACTIVE`, `billing_period_end = now + 30d` |
| `suspend` | Abuse, chargeback dispute in progress | `SUSPENDED` — webhooks update billing fields but cannot flip away from SUSPENDED |
| `reactivate` | Lift a suspension | `ACTIVE` (only valid from SUSPENDED) |
| `extend` | Add grace days (goodwill) | Bumps `billing_period_end` by N days (1–365) |
| `cancel` | Terminate cleanly | Calls Polar API to cancel gracefully; webhook sets `CANCELED` + retains `billing_period_end` |

Example — extend by 7 days:
```json
PATCH /api/admin/users/{clerk_id}/custom-plan/override
{
  "action": "extend",
  "reason": "Customer requested extension due to onboarding delay",
  "extend_days": 7
}
```

> **SUSPENDED is sticky.** Webhooks from Polar will update billing fields but will NOT flip the status away from SUSPENDED. Only `reactivate` can lift it.

---

## Re-provisioning a custom plan

Use when a price change, trial length change, or plan restructure requires a new Polar product.

1. Cancel the existing Polar subscription:
   ```
   PATCH /api/admin/users/{clerk_id}/custom-plan/override
   { "action": "cancel", "reason": "Re-provisioning with updated price" }
   ```
   Wait for the `subscription.canceled` webhook to arrive (sets `CANCELED` in DB).

2. Clear `custom_plan_polar_product_id` directly in DB (admin SQL access required):
   ```sql
   UPDATE users
      SET custom_plan_polar_product_id = NULL,
          subscription_status = 'AWAITING_PAYMENT'
    WHERE clerk_id = '{clerk_id}';
   ```

3. Call `/provision` again with the new config.

4. Send the new checkout link to the customer.

> **Never reuse an old Polar product.** Create a new product each time to avoid stale webhook mapping.

---

## Self-serve cancellation (customer-initiated)

Customers manage their own subscription (card updates, cancellation, invoice downloads) at:
```
https://portal.polar.sh
```

When a customer cancels there, Polar emits `subscription.canceled` → our DB sets `CANCELED`. The customer retains access until `billing_period_end`. No backend action required.

---

## Reconciliation

The system runs a daily reconciliation job automatically. To run it on-demand:

```
POST /api/admin/custom-plan/reconcile
```

The job compares all Polar subscriptions against the DB and flags:
- **STATUS_MISMATCH** — Polar says `active` but DB says `PAYMENT_FAILED` (dropped webhook).
- **ORPHAN_DB_NO_PRODUCT_ID** — `tier=CUSTOM` with no linked Polar product and a non-terminal status.
- **POLAR_SUBSCRIPTION_MISSING** — DB references a product_id that has no subscription on Polar side.
- **AWAITING_PAYMENT >7 days** — customer never started checkout; follow up.

All mismatches are printed to server logs and recorded in `admin_audit_log`.
