# BYOD alerting — rules + paging (readiness Step 6, §3.1 / §3.2)

Two artifacts get loaded into **Grafana Cloud (Mimir)**, where the metrics
remote-written by the [Alloy scraper](../../../alloy/README.md) are evaluated:

| File | What it is | Loads into |
|------|-----------|------------|
| `byod_alerts.yml` | The `byod` rule group (8 alerts). **Generated** from `slo.py` — do not hand-edit. | Mimir **ruler** |
| `byod_alertmanager.yaml` | Routes the three `severity: page` alerts to the on-call pager, everything else to the ticket/info queue. Secrets-free template (`${ENV_VARS}`). | Mimir **Alertmanager** |

Both are loaded with [`mimirtool`](https://grafana.com/docs/mimir/latest/manage/tools/mimirtool/)
(downloaded locally, gitignored). Pin the version; tested with **3.1.1**.

## Page routing contract

The pager route matches `severity="page"` **and** `feature="byod"`. Every rule in
`byod_alerts.yml` carries `feature: byod`; exactly three carry `severity: page`:

- `BYODKmsDecryptErrors` — KMS/decrypt failing, cold tenants down
- `BYODGlobalCeilingReached` — global connection ceiling hit, shedding 503s
- `BYODRoutingIntegrityViolation` — cross-tenant routing assertion tripped

Changing a severity in `slo.py` changes who gets paged — keep this list in sync.

## Validate locally (no credentials needed)

`mimirtool` fully parses an Alertmanager config when normalizing it, so
`migrate-utf8` doubles as an offline syntax check. Render the template with dummy
values first so no real secret is needed:

```sh
cat > /tmp/.env.am <<'EOF'
ALERT_SMTP_FROM=alerts@example.com
ALERT_PAGER_TO=pager@example.com
ALERT_QUEUE_TO=queue@example.com
RESEND_API_KEY=re_dummy
EOF
set -a; source /tmp/.env.am; set +a
envsubst < byod_alertmanager.yaml > /tmp/byod_am.yaml
./mimirtool alertmanager migrate-utf8 /tmp/byod_am.yaml   # exit 0 + echoes normalized config = parses
```

## Load into Grafana Cloud

```sh
# 1. Rules → ruler
./mimirtool rules load byod_alerts.yml \
    --address="${GRAFANA_CLOUD_PROM_URL%/api/prom/push}" \
    --id="${GRAFANA_CLOUD_USER}" --key="${GRAFANA_CLOUD_API_KEY}"

# 2. Alertmanager config → real secrets at the shell, render to a gitignored temp file
set -a; source .env.alertmanager; set +a          # NOT committed
envsubst < byod_alertmanager.yaml > /tmp/byod_am.yaml
./mimirtool alertmanager load /tmp/byod_am.yaml \
    --address="${GRAFANA_CLOUD_AM_URL}" \
    --id="${GRAFANA_CLOUD_USER}" --key="${GRAFANA_CLOUD_AM_TOKEN}"
rm -f /tmp/byod_am.yaml
```

Required env (`.env.alertmanager`, gitignored):

| Key | Value |
|-----|-------|
| `ALERT_SMTP_FROM` | verified Resend sender, e.g. `alerts@yourdomain.com` |
| `ALERT_PAGER_TO` | on-call pager email |
| `ALERT_QUEUE_TO` | ticket/info queue email (may equal the pager for the pilot) |
| `RESEND_API_KEY` | Resend API key — used as the SMTP password (SMTP user is literally `resend`) |
| `GRAFANA_CLOUD_AM_URL` | Grafana Cloud Alertmanager endpoint |
| `GRAFANA_CLOUD_AM_TOKEN` | Access Policy token with `alerts:write` scope |

## Test fire (closes §3.2)

After loading, fire each `page` alert against a canary so it reaches the pager
(not just the queue) — e.g. trigger a KMS-decrypt failure on the canary tenant
and confirm the `[PAGE] BYOD BYODKmsDecryptErrors` email lands. Record the
on-call sign-off in [byod_runbook.md](../../../docs/runbooks/byod_runbook.md).
