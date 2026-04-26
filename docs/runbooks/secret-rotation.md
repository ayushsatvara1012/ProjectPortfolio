# Secret Rotation Runbook

Last reviewed: 2026-04-26

This runbook covers **emergency** rotation of the secrets most likely to leak (Gemini, Clerk, Supabase) plus the **full order of operations** for a worst-case "laptop stolen / repo compromised" scenario.

---

## Inventory

| Secret | Where stored | Rotation difficulty | Customer impact |
|---|---|---|---|
| `GEMINI_API_KEY` | Render env | Easy | None |
| `CLERK_SECRET_KEY` | Render + Vercel env | Easy | None (Clerk supports overlap) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel env | Easy | None |
| `DATABASE_URL` (Supabase) | Render env | Medium | ~30s downtime on restart |
| `POLAR_ACCESS_TOKEN` | Render env | Medium | None if done before old token expires |
| `POLAR_WEBHOOK_SECRET` | Render env + Polar dashboard | Medium | Webhook drops between rotation steps — see §4 |
| `REDIS_URL` | Render env | Easy if Render-managed | Brief cache miss spike |
| **Customer bot API keys** | DB (SHA-256 hashed, **unsalted**) | **Per-customer, customer-initiated** | See §6 |

### Note on hashing

Customer API keys are stored as `sha256(api_key).hexdigest()` — **no salt**. There is no `API_KEY_HASH_SALT` env var to rotate. This is acceptable because keys are high-entropy random tokens (not rainbow-table-able), but it means: **if the DB leaks, attackers cannot recover keys, but if a key leaks, only that one customer is affected.** No platform-wide secret to rotate.

---

## §1. Emergency Rotation — Gemini

**When:** key committed to git, posted in screenshot, suspected leak.

1. Open <https://aistudio.google.com/apikey>
2. **Create new key** first (don't delete old one yet).
3. Copy new key.
4. Render dashboard → `sapyai` service → Environment → edit `GEMINI_API_KEY` → paste new value → **Save, Rebuild and Deploy**.
5. Wait for deploy to finish (~3 min). Tail logs, send a test chat message, confirm a response streams back.
6. Return to Google AI Studio → **delete old key**.
7. If key was committed to git: rotate, then `git filter-repo` or accept that it's in history forever (assume compromised — never un-leak).

**Verify:** chat endpoint returns a real response, not a 500.

---

## §2. Emergency Rotation — Clerk

**When:** Clerk secret key leaked.

1. <https://dashboard.clerk.com> → your app → API Keys.
2. **Create new secret key** (Clerk allows multiple active keys).
3. Update **both**:
   - Render env: `CLERK_SECRET_KEY`
   - Vercel env: `CLERK_SECRET_KEY` (and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` if that also leaked)
4. Trigger redeploy on **both** Render and Vercel.
5. Wait for both to finish. Test: log out, log back in via the dashboard.
6. Clerk dashboard → **revoke old secret key**.

**Verify:** login works; an in-flight session cookie is still valid (Clerk's JWTs survive key rotation as long as the JWKS endpoint is reachable).

**Gotcha:** If you only rotate on Render but not Vercel (or vice versa), one side will start rejecting tokens. Update both before revoking the old key.

---

## §3. Emergency Rotation — Supabase / DATABASE_URL

**When:** connection string leaked, suspected DB access.

1. Supabase dashboard → Project Settings → Database → **Reset database password**.
2. Copy the new connection string (use the **pooler** URL, not direct).
3. Render env → `DATABASE_URL` → paste → **Save, Rebuild and Deploy**.
4. Watch deploy logs for Alembic Pre-Deploy success and app startup.
5. Smoke test: load the dashboard, open a bot, send a chat message.

**Downtime:** ~30–60s during Render restart. There is no zero-downtime option on a single-instance Render plan.

**Also do:** rotate Supabase service role key if you use one anywhere (`SUPABASE_SERVICE_ROLE_KEY` if present in env).

---

## §4. Polar (token + webhook secret)

**Token rotation:**
1. Polar dashboard → Settings → API Keys → create new token.
2. Render env → `POLAR_ACCESS_TOKEN` → update → redeploy.
3. Verify a subscription lookup works (load billing page in dashboard).
4. Revoke old token in Polar.

**Webhook secret rotation (more delicate):**
1. Polar dashboard → Webhooks → your endpoint.
2. **You cannot rotate atomically** — there's a window where Polar signs with one secret and your server expects another.
3. Plan: rotate during low-traffic window. Update Polar first, immediately update Render env, redeploy. Webhook events that fire during the ~2-min gap will fail signature verification and be retried by Polar (Polar retries for 24h, so they recover).
4. Monitor Polar webhook delivery dashboard for 24h after rotation.

---

## §5. Redis / Cache

If Render-managed Redis: rotate via Render dashboard → Redis instance → "Reset connection string" → Render auto-injects the new URL on dependent services.

Impact: cache empties. Expect a brief latency spike as caches refill (FAQ endpoint, rate limit counters).

---

## §6. Customer Bot API Keys (NON-STANDARD)

> ⚠️ **This is not a platform secret you can rotate. Each customer owns their own bot API keys.**

If a *customer's* key leaks:
1. Customer regenerates from their dashboard (this should be a self-serve flow — verify it works).
2. Old hash is deleted, new hash inserted. Old key stops working immediately.
3. Customer must update their embed `data-api-key` (or `bot_id` for the loader) wherever deployed.

If you (operator) need to **force-revoke** a customer's key:
```sql
DELETE FROM api_keys WHERE company_id = '<uuid>';
-- or to revoke a specific key by its hash prefix shown in dashboard:
DELETE FROM api_keys WHERE key_hash = '<sha256_hex>';
```
Then notify the customer by email — their bot will be down until they regenerate.

---

## §7. Full Order of Operations — "Laptop Stolen / Repo Compromised"

Do these **in order**. Each step assumes the prior one is complete.

### Phase 1 — Stop the bleeding (first 15 min)

1. **GitHub** — <https://github.com/settings/security>
   - Revoke all personal access tokens.
   - Sign out of all sessions.
   - Change GitHub password.
   - If repo is private and you suspect clone: review repo collaborators, audit recent traffic.
2. **Vercel** — <https://vercel.com/account/tokens>
   - Delete all tokens.
   - Sign out of all sessions, change password.
3. **Render** — dashboard → Account Settings
   - Rotate password, sign out everywhere, delete API tokens.
4. **Cloudflare / domain registrar** (if applicable) — change password, revoke API tokens. *Domain hijack is the worst-case outcome — protect this even if not currently in use programmatically.*

### Phase 2 — Rotate platform secrets (next 30 min)

In this order (least-disruptive first, most-disruptive last):

5. `GEMINI_API_KEY` (§1) — fast, no downtime.
6. `CLERK_SECRET_KEY` + publishable (§2) — fast, no downtime.
7. `POLAR_ACCESS_TOKEN` (§4) — fast.
8. `REDIS_URL` (§5) — brief cache miss.
9. `DATABASE_URL` (§3) — **last**, because it causes a ~30s outage and you want everything else stable first.
10. `POLAR_WEBHOOK_SECRET` (§4) — last, because webhook gap requires monitoring.

### Phase 3 — Audit (within 24h)

11. Supabase → Logs → review last 48h of DB queries for anything anomalous.
12. Render → Logs → review API request patterns.
13. Polar → recent transactions — confirm no unauthorized refunds/cancellations.
14. Clerk → User activity — confirm no suspicious admin logins.
15. Email customers **only if** you have evidence of customer-data access. Don't pre-emptively alarm.

### Phase 4 — Hardening (within 1 week)

16. Enable 2FA on every service that supports it (GitHub, Vercel, Render, Supabase, Clerk, Polar, Google).
17. Move secrets out of `.env` files on disk — use a password manager or 1Password CLI for local dev.
18. Add a pre-commit hook (`gitleaks` or `git-secrets`) to block accidental secret commits.

---

## §8. Verification Checklist (post-rotation)

After any rotation, confirm:

- [ ] Dashboard loads and you can sign in
- [ ] Chat endpoint streams a response (proves Gemini + DB + Clerk all work)
- [ ] Billing page loads (proves Polar token works)
- [ ] At least one webhook event delivers successfully (proves webhook secret works)
- [ ] Render logs show no auth errors in the 5 min after deploy

---

## §9. What this runbook does NOT cover

- **Backup restoration** — separate runbook needed (currently deferred; Render auto-backups on $7 plan are untested).
- **Sentry / error monitoring** — not yet installed; you will not see post-rotation errors unless a user reports them.
- **Multi-region failover** — single-region on Render; no failover possible.
