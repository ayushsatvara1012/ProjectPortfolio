# Custom Plan Rollback Plan

**Audience:** Engineers performing a rollback of the custom_plan_flow implementation.
**Last updated:** 2026-05-07

---

## What was deployed

The custom plan flow spans four layers:

| Layer | Change |
|---|---|
| DB schema | Alembic revision `0003` — adds `custom_plan_polar_product_id` column + partial index |
| Access control | `get_current_user` + `verify_api_key_and_origin` now check `subscription_status` for `tier=CUSTOM` |
| Webhook handler | Added custom-plan lookup branch + `subscription.past_due` handler + SUSPENDED guard |
| New endpoints | `/provision`, `/override`, `/reconcile`, `/metrics`, `/dashboard` |
| Startup | Daily reconciliation loop via `asyncio.create_task` |

---

## Rollback decision tree

```
Issue reported after deploy
         │
         ├─ Is it isolated to custom-plan users only?
         │       Yes → targeted fix (see §3); full rollback not required
         │       No  → full rollback (see §2)
         │
         └─ Is the bug in access control (existing standard users affected)?
                 Yes → immediate full rollback
                 No  → assess; targeted fix preferred
```

---

## Full rollback procedure

### Step 1 — Revert the code deploy

Roll back the Render (or equivalent) service to the previous deployment. The previous build has none of the custom_plan_flow code.

> The previous code does not read `custom_plan_polar_product_id` — the column is simply ignored. No data loss on rollback.

### Step 2 — Verify access for standard users

After rollback, confirm that existing standard-plan users (BASIC/STARTER/PRO/BUSINESS) and FREE users have normal access. The access-control change in Phase A was additive (only affects `tier=CUSTOM`) so a code rollback is sufficient.

### Step 3 — Handle CUSTOM-tier users post-rollback

After code rollback, the access-control guard for CUSTOM users is gone. Users with `tier=CUSTOM` will have access based on `tier` only (the pre-Phase-A behaviour).

Decision:
- **Acceptable short-term:** Leave CUSTOM users as-is — they regain access regardless of payment status. Acceptable only if rollback is brief (<24h).
- **Not acceptable:** Manually set `tier=FREE` for any CUSTOM users who should not have access. Reverse when re-deploying.

### Step 4 — DB schema (optional)

The `custom_plan_polar_product_id` column is **nullable** and the old code never reads it. You do **not** need to run `alembic downgrade` for the app to function. Only run downgrade if you need to fully clean up (e.g., schema review tooling is flagging it):

```bash
alembic downgrade 0002
```

This drops the column and index. All `custom_plan_polar_product_id` values stored are lost. Only do this if you are certain you are not re-deploying soon, because you will lose all provisioned product IDs.

### Step 5 — Polar orphan products

Any Polar products created via `/provision` before rollback remain in Polar's system. They are harmless (no one is checking out against them post-rollback), but they should be archived in the Polar dashboard to avoid confusion. Do this manually after the rollback is stable.

---

## Targeted fixes (no full rollback needed)

### Fix: CUSTOM users incorrectly blocked (access gate too aggressive)

Quickest fix without a deploy: admin override `activate` for affected users:
```
PATCH /api/admin/users/{clerk_id}/custom-plan/override
{ "action": "activate", "reason": "Emergency access restore pending fix" }
```

Then investigate the bug and deploy a corrected build.

### Fix: Webhook handler dropping events

The custom-plan lookup branch is additive. The existing standard-plan branches are unchanged. If custom-plan webhooks are being dropped but standard-plan webhooks are fine:
1. Check server logs for `RECONCILE CRITICAL` or `RECONCILE WARNING` entries.
2. Run `POST /api/admin/custom-plan/reconcile` for a full diff.
3. Manually correct state via override endpoint for affected users.
4. Deploy the fix.

### Fix: `/provision` endpoint failing

`/provision` failing does not affect any existing users. It only blocks new custom plan creation. Safe to investigate and fix without rollback.

### Fix: Reconciliation loop crashing on startup

The loop runs as a background `asyncio.create_task`. A crash in the loop is caught and logged (`RECONCILE LOOP ERROR`) — it does not crash the app. The loop will retry on the next cycle (24h). Safe to investigate without rollback.

---

## Re-deploy after rollback

When re-deploying after a rollback:

1. Run `alembic upgrade head` in the pre-deploy step (standard procedure). If the column was not downgraded, this is a no-op.
2. Verify `alembic_version` is `0003` in the logs.
3. Check `GET /api/admin/custom-plan/dashboard` is reachable.
4. Run `POST /api/admin/custom-plan/reconcile` and confirm report shows `polar_reachable=true` and expected users are present.
5. For any CUSTOM users who were manually demoted to FREE during rollback, re-provision or override `activate` as appropriate.

---

## Contacts

| Area | Owner |
|---|---|
| Backend / DB | Engineering on-call |
| Polar billing issues | Polar support (`https://polar.sh/support`) |
| Customer escalations | Account manager |
