# Manual Configuration — Conversion / Business-Intelligence Engine

Everything you (the platform owner) must do **by hand** to fully activate the
features built in this effort. Code is complete and deployed; these are the
config/infra steps that bring dormant features to life.

> All features **fail safe**: with nothing configured, the product runs exactly
> as before — emails just skip, the booking CTA just doesn't show, etc. So you
> can do these in any order, and partially.

Legend: **[Platform]** = you do it once · **[Per-customer]** = your end users do
it in the dashboard (no action from you, listed for awareness).

---

## 0. Database migrations  **[Platform]** — ✅ already applied

Six additive migrations back these features (`0006`→`0011`): hot-lead alerts,
weekly digest, Slack webhook, lead outcome/ROI tracking, booking URL, and lead
source attribution.

- Status: **already applied to your Supabase database** during development
  (`alembic current` → `0010 (head)`). All are `ADD COLUMN IF NOT EXISTS` /
  `CREATE INDEX IF NOT EXISTS` — additive and idempotent.
- **Only needed again** for a brand-new/fresh environment:
  ```bash
  cd sapybase_ai_engine
  ./venv/bin/python -m alembic upgrade head
  ```
- [ ] Confirm your **production** `DATABASE_URL` points at the same Supabase
      instance (it does today). If you ever split prod onto a different DB, run
      the command above against it.

---

## 1. Email delivery  **[Platform]** — required for ALL email features

Powers: **hot-lead alerts**, **human-handoff emails**, and the **weekly digest**.
Without an email provider configured, these three silently skip (everything else
still works). Pick **one** option and set the env vars in your Render backend
service → **Environment**.

### Option A — Resend (recommended, best deliverability)
- [ ] Sign up at <https://resend.com>.
- [ ] **Verify your sending domain** (add the SPF/DKIM DNS records Resend shows
      you). This is what keeps mail out of spam at scale.
- [ ] Create an API key.
- [ ] Set env vars:
  | Key | Value |
  |-----|-------|
  | `RESEND_API_KEY` | `re_…` |
  | `EMAIL_FROM` | an address **on your verified domain**, e.g. `alerts@yourdomain.com` |
  | `EMAIL_FROM_NAME` | *(optional)* display name, default `Sapybase` |

### Option B — Gmail SMTP (fallback / quick start)
- [ ] Turn on **2-Step Verification** for the Google account.
- [ ] Create a 16-char **App Password** at <https://myaccount.google.com/apppasswords>
      (a normal password will NOT work over SMTP).
- [ ] Set env vars:
  | Key | Value |
  |-----|-------|
  | `SMTP_USER` | the Gmail address |
  | `SMTP_PASS` | the 16-char app password (no spaces) |
  | `EMAIL_FROM_NAME` | *(optional)* default `Sapybase` |

> Selection is automatic at send time: **Resend wins if `RESEND_API_KEY` is set**,
> otherwise Gmail SMTP if both SMTP vars are set, otherwise no-op.

**Smoke test:** capture a HOT lead on a live bot (a message with buying intent +
a business email) → the owner address should receive the "🔥 Hot lead" email
within seconds. If not, check Render logs for `EMAIL …` lines.

---

## 2. Weekly digest scheduler  **[Platform]** — required for the weekly email

The digest endpoint exists (`POST /api/internal/run-weekly-digest`) but is
**pull-based** — an external scheduler must trigger it weekly. It is locked
(returns `403`) until you set a secret, and is idempotent per ISO-week.

- [ ] Generate a secret: `openssl rand -hex 32`
- [ ] In the Render **backend web service** → Environment, add:
  | Key | Value |
  |-----|-------|
  | `CRON_SECRET` | the generated string |
- [ ] Create a Render **Cron Job** (New + → Cron Job):
  - **Schedule:** `0 9 * * 1` (Mondays 09:00 UTC)
  - **Command:**
    ```bash
    curl -fsS -X POST \
      -H "x-cron-secret: $CRON_SECRET" \
      https://<your-app>.onrender.com/api/internal/run-weekly-digest
    ```
  - [ ] Add `CRON_SECRET` to the **Cron Job's own** Environment too (cron jobs
        don't inherit the web service's env).
- [ ] Verify now (don't wait for Monday):
  ```bash
  curl -i -X POST -H "x-cron-secret: YOUR_SECRET" \
    https://<your-app>.onrender.com/api/internal/run-weekly-digest
  ```
  Expect `200 {"status":"ok","week":"…","processed":N,"sent":M,"skipped":K}`.

> Full step-by-step (incl. the free GitHub Actions alternative) is in
> `sapybase_ai_engine/DEPLOY_ALERTS.md`.

---

## 3. Rebuild the embeddable widget  **[Platform]** — required for the booking CTA

The instant **"📅 Book a call"** button was added to the widget **source**
(`src/app/components/ChatWidget.tsx`). Live customer sites load the pre-built,
minified **`public/widget.js`**, which is generated outside this repo.

- [ ] **Rebuild `public/widget.js`** from your widget build pipeline and deploy
      it, so the booking CTA (and any future widget changes) reach live embeds.
- Backend + dashboard settings work immediately; only the embedded widget UI
  depends on this rebuild.
- **Attribution fidelity (optional, recommended):** lead source attribution
  works today using `document.referrer`, but for full-fidelity page URL + UTM
  capture, have the loader expose the merchant page URL on the global
  `window.__SapybaseParentUrl` (the widget reads it automatically). Without it,
  attribution falls back to the referrer, and direct visits show as "Direct".

---

## 4. Plan / tier gating  **[Platform]** — verify, usually already set

These features are gated to **PRO / ENTERPRISE** (or a CUSTOM plan with the
matching flag). No new config if your plans are already defined, but confirm:

| Feature | Required entitlement |
|---------|----------------------|
| Lead capture, hot-lead alerts, booking link | `lead_capture` (Pro+) |
| Slack lead handoff | Pro+ (CUSTOM: `webhook`) |
| ROI dashboard, Conversion funnel | `analytics` (Pro+) |

- [ ] Confirm `PLAN_LIMITS` / custom-plan flags grant these on the plans you
      intend to sell them on.

---

## 5. Per-customer settings  **[Per-customer]** — no action from you

Your end users self-serve these in **Dashboard → Settings → Customize →
"Lead alerts & notifications"**. Listed so you can support them:

- **Hot-lead alerts** toggle + optional **alert email** override (defaults to
  their account email).
- **Weekly digest** toggle.
- **Slack channel** — paste a Slack **Incoming Webhook** URL
  (<https://api.slack.com/messaging/webhooks>). Must start with
  `https://hooks.slack.com/`.
- **Booking link** — paste a Calendly / Cal.com / HubSpot Meetings link
  (`https://…`). Drives the widget "Book a call" CTA for HOT/WARM leads.

---

## 6. Quick reference — all new environment variables  **[Platform]**

Set on the **Render backend service** (and `CRON_SECRET` also on the Cron Job).
See `sapybase_ai_engine/.env.example` for the annotated list.

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `RESEND_API_KEY` | Resend transactional email | one email option |
| `EMAIL_FROM` | Verified sender address (Resend) | with Resend |
| `SMTP_USER` / `SMTP_PASS` | Gmail SMTP fallback | other email option |
| `EMAIL_FROM_NAME` | Sender display name (default `Sapybase`) | optional |
| `CRON_SECRET` | Guards + authorizes the weekly-digest cron | for weekly digest |

---

## 7. Troubleshooting notes

- **Emails never arrive:** no provider configured (Render logs show
  `EMAIL: no provider configured … skipping`), or (Resend) the domain isn't
  verified, or (Gmail) you used a normal password instead of an App Password.
- **Weekly digest returns 403:** `CRON_SECRET` missing on the service, or the
  `x-cron-secret` header doesn't match.
- **Booking CTA doesn't show on a live site:** rebuild `public/widget.js`
  (section 3); also confirm the owner set a booking link and the lead scored
  HOT/WARM (COLD leads don't see it by design).
- **Dashboard shows no data locally:** Clerk dev vs prod instance mismatch —
  `pk_test/sk_test` (`.env.local`) and `pk_live/sk_live` (`.env`) are *separate
  user pools*. Sign in with the identity that owns the data for that instance.
