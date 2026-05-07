# Custom Plan Deployment Checklist

**Before deploying to production, verify:**

---

## 1. Environment Configuration

### Required Environment Variables
```bash
# Set these in your deployment environment (Render, .env, etc.)
POLAR_ACCESS_TOKEN=<your-polar-api-token>
ENV=production  # or "development" for sandbox
```

**How to get POLAR_ACCESS_TOKEN:**
1. Log into your Polar dashboard (`https://dashboard.polar.sh`)
2. Navigate to Settings → API Tokens
3. Create a new token (or use an existing one)
4. Copy the full token value
5. Add to your deployment environment

**Sandbox vs Production:**
- `ENV=development` → uses `https://sandbox-api.polar.sh` (Polar's test environment)
- `ENV=production` → uses `https://api.polar.sh` (live billing)

Test in development first before switching to production.

---

## 2. Database Migration

### Run Alembic
```bash
alembic upgrade head
```

This applies migration `0003` which:
- Adds `custom_plan_polar_product_id` column to `users` table
- Creates partial index on the column
- Grandfathers existing CUSTOM users to `AWAITING_PAYMENT` status

**Verify migration applied:**
```bash
psql $DATABASE_URL -c "SELECT version_num FROM alembic_version ORDER BY installed_on DESC LIMIT 1;"
```

Should show `0003`.

---

## 3. Code Deployment

### Pre-deploy
- Run full test suite: `pytest tests/`
- Verify no regressions: `pytest tests/test_custom_plan_flow.py` (99 tests must pass)

### Deploy
- Standard deployment to Render (or your CI/CD pipeline)
- Alembic migration must run **before** the new code starts
  - If using Render: add `alembic upgrade head` to the pre-deploy command

### Post-deploy
- Tail logs for any startup errors
- Verify `/api/admin/custom-plan/metrics` returns `200` (confirms endpoints are live)
- Run one manual reconciliation: `curl -X POST http://localhost:3000/api/admin/custom-plan/reconcile -H "Authorization: Bearer $ADMIN_TOKEN"` (should return reconciliation report)

---

## 4. Admin Panel UI (Implementation Required)

The backend is complete. The admin panel needs these features wired:

### Screens to build/update

#### Custom Plan Creation Form
- Input fields:
  - `plan_name` (text)
  - `monthly_price_usd` (number, >0)
  - `trial_days` (number, 0–30)
  - `max_bots`, `max_messages`, `max_chunks` (integers)
  - `model` (dropdown with VALID_MODELS)
  - Feature toggles: `human_handoff`, `lead_capture`, `white_label`, `webhook`, `custom_logo`, `analytics`
  - `notes` (optional text)
- Two-step flow:
  1. **Save Draft** button → `PATCH /api/admin/users/{clerk_id}` with `custom_plan_config`
  2. **Create Polar Product** button → `POST /api/admin/users/{clerk_id}/custom-plan/provision`
- On success, display `checkout_url` with copy-to-clipboard

#### Custom Plan Dashboard
- Table with columns:
  - Clerk ID / Email
  - Status (show color: green/amber/red)
  - Billing period end
  - Last webhook (last_polar_event_at)
  - Quick actions buttons (activate, suspend, reactivate, cancel, extend based on status)
- Fetch from: `GET /api/admin/custom-plan/dashboard`
- Actions POST to: `PATCH /api/admin/users/{clerk_id}/custom-plan/override`

#### Metrics Dashboard
- Pie/bar chart of subscription_status distribution
- Alert box: count of users in AWAITING_PAYMENT >7 days
- Alert box: count of users who hit PAYMENT_FAILED in last 24h / 7d
- Manual refresh button: calls `POST /api/admin/custom-plan/reconcile`
- Fetch from: `GET /api/admin/custom-plan/metrics`

---

## 5. Polar Product Configuration

### What admins need to know

**Important:** Polar products are created **programmatically** by the backend. Admins do NOT manually create products in Polar dashboard.

When the admin calls `/provision`:
- Backend calls Polar API: `POST /v1/products` with:
  - `name`: from `custom_plan_config.plan_name`
  - `recurring_price`: `monthly_price_usd` in cents, monthly interval
  - `trial_period_days`: from `custom_plan_config.trial_days`
  - `metadata`: `{ "clerk_id": "...", "internal_plan_id": "..." }`
- Backend receives `product_id` and stores it
- Checkout URL is: `https://buy.polar.sh/{product_id}`

**Admins should:**
- Verify the product appears in Polar dashboard after provisioning
- Never edit product price/features directly in Polar — always go through the admin panel
- If they need to change price/trial, they must cancel the old subscription and re-provision

### Testing flow (Sandbox)
1. Set `ENV=development` to use Polar sandbox
2. Create a test custom plan via admin panel
3. Copy checkout URL
4. In Polar sandbox checkout, use test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. Complete checkout — webhook should fire, status should flip to `TRIAL_ACTIVE`
6. Wait for trial end or manually advance time in Polar dashboard to test charge

---

## 6. Webhook Ingestion

### Polar Webhook Secret

Verify `POLAR_WEBHOOK_SECRET` is set:
```bash
echo $POLAR_WEBHOOK_SECRET
```

This is used to verify webhook signature on `POST /api/webhooks/polar`.

**To obtain:**
1. Log into Polar dashboard
2. Settings → Webhooks
3. Find or create an endpoint for your server: `https://yourdomain.com/api/webhooks/polar`
4. Copy the webhook secret
5. Add to environment as `POLAR_WEBHOOK_SECRET`

### Test webhook delivery (Sandbox)
1. In Polar dashboard, Webhooks section, find a past event (e.g., `subscription.created`)
2. Click "Redeliver" to test
3. Check server logs for `WEBHOOK HANDLER:` entries — should show the event was processed

---

## 7. Access Control Verification

### Test the access gate
1. Create a custom plan user in test (use `/provision` endpoint)
2. As that user, call a protected endpoint (e.g., `GET /api/chats`)
3. Verify HTTP 402 response with `code: "CUSTOM_PLAN_PAYMENT_NOT_STARTED"` and `checkout_url`
4. After customer completes checkout (or admin calls `/override activate`), same request should return 200

### Test each status code
Use `/override` to flip user status and verify access gate behavior:
```bash
PATCH /api/admin/users/{clerk_id}/custom-plan/override
{
  "action": "activate",
  "reason": "Testing access after activation"
}
```

Then call the same protected endpoint — should now succeed.

---

## 8. Reconciliation & Monitoring

### Daily reconciliation loop
- Starts automatically on app boot
- Runs once per 24 hours
- Logs mismatches to server logs (`RECONCILE WARNING`, `RECONCILE CRITICAL`)
- Saves report to `admin_audit_log` table

### Manual trigger
```bash
POST /api/admin/custom-plan/reconcile
```

Returns full report. Use this if you suspect webhooks were missed.

### Alerts to set up (optional)
Monitor server logs for:
- `RECONCILE CRITICAL` — Polar product has no matching DB row
- `RECONCILE WARNING` — Status mismatch, orphan DB row
- `AWAITING_PAYMENT >7d` — Customer never started checkout

---

## 9. Documentation Rollout

### Share with team

1. **Admins** → `docs/runbooks/custom_plan_admin_workflow.md`
   - How to create a plan
   - How to send checkout link
   - How to use override actions

2. **Support** → `docs/runbooks/custom_plan_support_runbook.md`
   - Customer escalation playbook
   - Every HTTP 402 code explained
   - When to escalate to engineering

3. **On-call** → `docs/runbooks/custom_plan_rollback.md`
   - Rollback procedure
   - Targeted fixes
   - Re-deploy checklist

4. **Product/Sales** → Communicate to customers:
   - Custom plans are now available
   - Explain trial period + auto-charge
   - Point to customer portal for self-serve management

---

## 10. Post-Deployment Validation

### Day 1
- [ ] All 155 unit tests pass
- [ ] `/api/admin/custom-plan/metrics` returns `200`
- [ ] `/api/admin/custom-plan/dashboard` returns `200` (empty list initially)
- [ ] Create a test custom plan via API
- [ ] Verify it appears in dashboard
- [ ] Verify `custom_plan_polar_product_id` was set
- [ ] Verify status is `AWAITING_PAYMENT`

### Day 1–3 (sandbox testing)
- [ ] Complete a checkout (test card)
- [ ] Verify status flips to `TRIAL_ACTIVE` after webhook
- [ ] Wait for trial end → observe transition to `ACTIVE` (or manual force with `/override activate`)
- [ ] Test `/override suspend` and `/override reactivate`
- [ ] Test `/override extend` with 7 days
- [ ] Test access gate: verify HTTP 402 for each blocked status
- [ ] Run reconciliation: `POST /api/admin/custom-plan/reconcile` → should show 0 mismatches

### Week 1
- [ ] Create a real customer's custom plan (if ready)
- [ ] Monitor webhook logs for any failures
- [ ] Check reconciliation report daily for mismatches
- [ ] Get feedback from admins on the workflow

---

## Contacts & Support

| Question | Answer location |
|---|---|
| "How do I create a custom plan?" | `docs/runbooks/custom_plan_admin_workflow.md` |
| "Customer says they can't access..." | `docs/runbooks/custom_plan_support_runbook.md` |
| "What do I do if a webhook is dropped?" | `docs/runbooks/custom_plan_support_runbook.md` § Reconciliation |
| "How do I roll back?" | `docs/runbooks/custom_plan_rollback.md` |
| "API reference for custom plan endpoints" | See Phase B, C, D, E in `docs/runbooks/custom_plan_flow.md` |
