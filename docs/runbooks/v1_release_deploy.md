# v1 Release Deployment Runbook

Covers the deployment-gated steps for the "SaaS v1" work (commit `0ee83b6`):
Fixes-Needed, Lead Scoring, and the blog content engine. All code is committed
on `redesign-dashboard`; these steps activate it safely in the live env.

## 0. Pre-deploy gate (must pass)
```bash
# Backend — from sapybase_ai_engine/
./venv/bin/python -m pytest tests/ -q          # expect: 270 passed

# Frontend — from repo root
npx vitest run                                  # expect: 261 passed
npx next build                                   # expect: blog pages prerendered (SSG)
```

## 1. Database migrations (REQUIRED — feature will error without this)
New columns are needed by the new features:
- `0004_chat_logs_confidence` → `chat_logs.confidence`  (Fixes-Needed)
- `0005_lead_capture_score`   → `lead_capture.score`, `score_band`, `score_reasons` (Lead Scoring)

```bash
cd sapybase_ai_engine
./venv/bin/alembic current        # note current revision (for rollback)
./venv/bin/alembic upgrade head   # applies 0004 then 0005
./venv/bin/alembic current        # confirm: 0005 (head)
```
Rollback if needed: `./venv/bin/alembic downgrade 0003`
(Migrations use `IF NOT EXISTS` / `IF EXISTS`, so re-running is safe.)

## 2. Widget session hardening (security — currently SOFT mode)
Today `main.py` runs in soft mode: `WIDGET_SESSION_SECRET` unset → token
minting disabled, chat endpoint not enforcing signed sessions. To enforce:

1. Generate a secret and set it FIRST (so minting works before enforcement):
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   # set in env:  WIDGET_SESSION_SECRET=<that value>
   ```
2. Deploy with only the secret set. Verify the startup log no longer prints
   "WIDGET SESSION WARNING ... soft mode".
3. Then flip enforcement on:  `WIDGET_SESSION_ENFORCE=true`  and redeploy.
   (If `ENFORCE=true` while the secret is unset, the app raises on startup by design.)

Order matters: secret first, enforce second — never the reverse.

## 3. Post-deploy smoke tests (authenticated PRO/ENTERPRISE token)
```bash
# Fixes-Needed
curl -H "Authorization: Bearer <jwt>" \
  "https://<api>/api/fixes-needed/<company_id>?window_days=30&limit=50"

# Lead scoring sort/filter
curl -H "Authorization: Bearer <jwt>" \
  "https://<api>/api/leads/<company_id>?sort=score&band=HOT"
```
Then confirm the blog is live: `https://www.sapybase.com/blog` and one article URL.

## 4. Rollback summary
| Step | Rollback |
|------|----------|
| Migrations | `alembic downgrade 0003` |
| Widget enforce | set `WIDGET_SESSION_ENFORCE=false` (keeps soft mode) |
| App code | revert commit `0ee83b6` |
