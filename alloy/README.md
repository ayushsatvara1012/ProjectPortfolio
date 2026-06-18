# Grafana Alloy scraper (BYOD monitoring — readiness Step 6)

A tiny agent that scrapes the Sapybase backend's token-gated `/metrics` and
remote-writes to Grafana Cloud, where `byod_alerts.yml` evaluates and pages.

## Deploy on Render (Background Worker, Docker)

1. Render → **New + → Background Worker** → this repo, branch `MainV2`.
2. **Root Directory:** `alloy` · **Runtime:** Docker (auto-detects the Dockerfile).
3. **Environment** — set these four:

| Key | Value |
|-----|-------|
| `METRICS_SCRAPE_TOKEN` | same value as on the backend service (the scrape token) |
| `GRAFANA_CLOUD_PROM_URL` | Grafana Cloud → Prometheus → "Remote Write Endpoint" URL (ends in `/api/prom/push`) |
| `GRAFANA_CLOUD_USER` | the Prometheus instance **Username / Instance ID** (a number) |
| `GRAFANA_CLOUD_API_KEY` | a Grafana Cloud **Access Policy token** with `metrics:write` scope |

4. Deploy. Within ~1 min, metrics appear in Grafana Cloud (Explore →
   `sapybase_http_requests_total`).

The scrape target is pinned to `sapyai.onrender.com`; change it in `config.alloy`
if the backend host changes.
