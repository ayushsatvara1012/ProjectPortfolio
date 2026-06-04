# Operationalizing the Conversion Engine (alerts, Slack, weekly digest)

The code for instant hot-lead alerts, Slack handoff, and the weekly results
email is **already deployed** — it just stays dormant until you give it
credentials. This runbook turns it on in production. ~15 minutes, one time.

There are three steps: **(1) Gmail App Password → (2) Render env vars →
(3) Render Cron Job** for the weekly digest.

---

## 1. Generate a Gmail App Password

Gmail rejects your normal password over SMTP. You need a 16-character
app-specific password.

1. The sending Google account must have **2-Step Verification ON**
   (https://myaccount.google.com/security).
2. Go to **https://myaccount.google.com/apppasswords**.
3. App name: `Sapybase`. Click **Create**.
4. Copy the 16-character password (shown like `abcd efgh ijkl mnop`).
   **Remove the spaces** when you paste it → `abcdefghijklmnop`.

> Use a dedicated address (e.g. `alerts@yourdomain` via Google Workspace, or a
> `…@gmail.com` you own) — this is the "From" on every alert your customers see.

---

## 2. Set the environment variables in Render

Render dashboard → your **backend web service** → **Environment** → add:

| Key | Value | Notes |
|-----|-------|-------|
| `SMTP_USER` | the Gmail address | e.g. `alerts@yourco.com` |
| `SMTP_PASS` | the 16-char app password | no spaces |
| `EMAIL_FROM_NAME` | `Sapybase` | optional; display name on the email |
| `CRON_SECRET` | a long random string | run `openssl rand -hex 32` to generate |

Click **Save Changes** — Render redeploys automatically. As soon as
`SMTP_USER` + `SMTP_PASS` are live, **hot-lead alerts and Slack handoff start
firing on the next captured lead**. No further action needed for those two.

### Quick smoke test (alerts)
Capture a HOT lead on any live bot (a message with buying intent + a
business email). Within seconds the owner address should receive the
"🔥 Hot lead" email. If nothing arrives, check the Render logs for
`HOT LEAD EMAIL` lines — `…not configured` means the env vars didn't take.

---

## 3. Schedule the weekly digest (Render Cron Job)

The digest is a **pull** endpoint — an external scheduler hits it weekly.
It's idempotent per ISO-week (safe to run more than once) and skips companies
with no leads that week.

Render dashboard → **New +** → **Cron Job**:

| Field | Value |
|-------|-------|
| **Name** | `sapybase-weekly-digest` |
| **Schedule** | `0 9 * * 1` (every Monday 09:00 UTC) |
| **Command** | see below |

**Command** (replace the host with your real backend URL, and reuse the same
`CRON_SECRET` you set in step 2):

```bash
curl -fsS -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  https://<your-app>.onrender.com/api/internal/run-weekly-digest
```

Add `CRON_SECRET` to the Cron Job's own **Environment** too (Cron Jobs don't
inherit the web service's env), so `$CRON_SECRET` resolves inside the command.

### Verify it works now (don't wait for Monday)
From your machine, with the real secret:

```bash
curl -i -X POST \
  -H "x-cron-secret: REPLACE_WITH_CRON_SECRET" \
  https://<your-app>.onrender.com/api/internal/run-weekly-digest
```

- `200 {"status":"ok","week":"2026-W23","processed":N,"sent":M,"skipped":K}` → working.
- `403` → `CRON_SECRET` missing on the service or the header doesn't match.

---

## Alternative scheduler: GitHub Actions (free, less reliable)

If you'd rather not pay for a Render Cron Job, a scheduled GitHub Action works.
Trade-offs: scheduled runs can be delayed 15–30+ min under load, and the
workflow auto-disables after 60 days of no repo activity. The endpoint's
idempotency makes late/double runs harmless.

1. Repo → **Settings → Secrets and variables → Actions** → add `CRON_SECRET`
   (same value) and `BACKEND_URL` (`https://<your-app>.onrender.com`).
2. Add `.github/workflows/weekly-digest.yml`:

```yaml
name: Weekly digest
on:
  schedule:
    - cron: "0 9 * * 1"   # Mondays 09:00 UTC
  workflow_dispatch: {}    # manual "Run workflow" button for testing
jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger weekly digest
        run: |
          curl -fsS -X POST \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            "${{ secrets.BACKEND_URL }}/api/internal/run-weekly-digest"
```

---

## What each piece does (reference)

| Feature | Trigger | Recipient | Toggle |
|---------|---------|-----------|--------|
| Hot-lead alert | A HOT-scored lead is captured | `alert_email` or account email | `hot_lead_alerts_enabled` |
| Slack handoff | Any lead captured (if webhook set) | Slack channel | `slack_webhook_url` set |
| Weekly digest | Cron, once per ISO-week | `alert_email` or account email | `weekly_digest_enabled` |

All three are owner-configurable on **Settings → Customize → "Lead alerts &
notifications"**. Sending requires the SMTP/cron env vars above to be set.
