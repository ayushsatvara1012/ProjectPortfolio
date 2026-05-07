# Custom Plan Support Runbook

**Audience:** Support agents and on-call engineers handling custom-plan customer issues.
**Last updated:** 2026-05-07

---

## How to look up a customer's current state

```
GET /api/admin/custom-plan/dashboard
```

Find the customer's row. Key fields:

| Field | What it tells you |
|---|---|
| `subscription_status` | Current billing/access state |
| `status_color` | red = blocked, amber = degraded/pending, green = OK |
| `billing_period_end` | When the current period ends |
| `last_polar_event_at` | Last webhook received — if this is very old and status is unexpected, a webhook may have been dropped |
| `polar_subscription_link` | Direct link to this product in the Polar dashboard |
| `quick_actions` | Which admin overrides are valid right now |

---

## Scenario: "I can't access my account" (custom plan user)

The API returns HTTP 402 with a `code` field. Use the code to identify the cause.

| Code | Status in DB | Meaning | Action |
|---|---|---|---|
| `CUSTOM_PLAN_PAYMENT_NOT_STARTED` | `AWAITING_PAYMENT` | Customer hasn't clicked the checkout link | Re-send checkout URL from dashboard |
| `CUSTOM_PLAN_TRIAL_EXPIRED_PENDING_CHARGE` | `TRIAL_ACTIVE` | Trial ended; payment is still processing | Wait up to 24h; if persists, check Polar dashboard for the subscription status |
| `CUSTOM_PLAN_PAYMENT_FAILED` | `PAYMENT_FAILED` | Card declined; Polar is retrying | Ask customer to update card at `https://portal.polar.sh`; Polar retries automatically |
| `CUSTOM_PLAN_PERIOD_EXPIRED` | `ACTIVE` (period_end passed + 48h) | Renewal likely delayed or failed | Check Polar dashboard; if renewal succeeded, run `/reconcile` to sync state |
| `CUSTOM_PLAN_SUSPENDED` | `SUSPENDED` | Admin manually suspended | Escalate to account manager |
| `CUSTOM_PLAN_REVOKED` | `REVOKED` | All Polar payment retries exhausted | Admin must decide: `activate` (goodwill) or ask customer to re-subscribe |
| `CUSTOM_PLAN_REFUNDED` | `REFUNDED` | Order was refunded | Access is permanently revoked; admin must re-provision if reinstating |
| `CUSTOM_PLAN_EXPIRED` | `EXPIRED` or `CANCELED` past period_end | Subscription period ended | Admin `activate` (goodwill) or ask customer to re-subscribe |
| `CUSTOM_PLAN_UNKNOWN_STATE` | Anything else | Unexpected state | Escalate to engineering |

---

## Scenario: "My payment failed"

1. Confirm in the Polar dashboard (`polar_subscription_link` from admin dashboard) that the subscription is `past_due`.
2. Ask the customer to update their card at `https://portal.polar.sh`. Polar will retry automatically.
3. Polar retries 3–4 times over ~2 weeks. During retries, the customer sees `CUSTOM_PLAN_PAYMENT_FAILED`.
4. If the customer updates their card and Polar retries succeed, `subscription.updated` (status=active) fires → DB flips to `ACTIVE` automatically. No manual steps needed.
5. If Polar exhausts all retries → `subscription.revoked` → status = `REVOKED`. At this point the admin must either:
   - Grant goodwill access: `PATCH /override { "action": "activate", "reason": "..." }`
   - Or wait for the customer to re-subscribe (admin must re-provision).

---

## Scenario: "My trial ended but I was charged early / I wasn't charged"

Check:
- `billing_period_end` in the admin dashboard — this is when Polar attempted the charge.
- `last_polar_event_at` — if this predates the expected charge date, the webhook was likely dropped.

If the webhook was dropped (status mismatch visible):
1. Run reconciliation: `POST /api/admin/custom-plan/reconcile`
2. The report will flag a `STATUS_MISMATCH`. This is informational — it does not auto-correct DB state.
3. If Polar shows the subscription as `active`, manually override: `PATCH /override { "action": "activate", "reason": "Manual sync after missed webhook" }`

---

## Scenario: "I canceled but I'm still being charged"

Cancellation via the Polar customer portal sets `cancel_at_period_end = true`. The customer keeps access until `billing_period_end` and is not charged again. Verify in Polar dashboard that the subscription shows as `will cancel on [date]`.

If the customer was charged after cancellation:
- This is a Polar billing issue. Direct them to Polar support or the invoice in the customer portal.
- On our side, the subscription will remain `CANCELED` (with access until `billing_period_end`), then `EXPIRED`.

---

## Scenario: "Customer was in AWAITING_PAYMENT for a long time"

The daily reconciliation job alerts on AWAITING_PAYMENT >7 days. Also visible in:
```
GET /api/admin/custom-plan/metrics
```
under `awaiting_payment_stale`.

Actions:
- Re-send the checkout URL (copy from `polar_checkout_url` in the dashboard).
- If the customer is no longer interested, cancel the orphan Polar product via the override endpoint: `PATCH /override { "action": "cancel", "reason": "Customer declined" }`

---

## Scenario: Polar dashboard shows "active" but our DB shows wrong status

A webhook was likely dropped. Steps:

1. Run `POST /api/admin/custom-plan/reconcile` — the report will include a `STATUS_MISMATCH` entry.
2. Confirm in Polar dashboard that the subscription is genuinely active.
3. Manually correct DB state:
   ```
   PATCH /api/admin/users/{clerk_id}/custom-plan/override
   { "action": "activate", "reason": "Manual correction after missed webhook — Polar shows active" }
   ```
4. Monitor `last_polar_event_at` over the next 24h to confirm future webhooks are arriving.

---

## Scenario: Admin accidentally suspended the wrong user

```
PATCH /api/admin/users/{clerk_id}/custom-plan/override
{
  "action": "reactivate",
  "reason": "Suspended in error — correcting"
}
```

`reactivate` is only valid from `SUSPENDED`. It sets status back to `ACTIVE`.

---

## Escalation path

| Situation | Escalate to |
|---|---|
| Polar API is unreachable | Engineering (check Polar status page) |
| STATUS_MISMATCH in reconciliation and manual override did not fix it | Engineering |
| Refund issued but customer disputes access loss | Account manager + Engineering |
| `CUSTOM_PLAN_UNKNOWN_STATE` error code | Engineering |
| `custom_plan_polar_product_id` needs to be cleared for re-provisioning | Engineering (requires DB access) |
