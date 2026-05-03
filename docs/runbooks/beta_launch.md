# Beta Launch Runbook (Phase 4.2)

## Pre-Launch Gate (run before inviting any users)

### Load Test at 5x Scale
```bash
cd sapybase_ai_engine
SSE_TEST_API_KEY=<key> ./venv/bin/python scripts/sse_load_test.py \
  --base-url https://<render-url> \
  --concurrency 100 \
  --ttft-threshold 2.0
```
**Required**: `PASS` with p95 TTFT < 2.0s.

### Health Check (run before every deploy)
```bash
SSE_TEST_API_KEY=<key> ./venv/bin/python scripts/beta_health_check.py \
  --base-url https://<render-url>
```

---

## Beta User Onboarding (10–20 users)

### Invite Criteria
- [ ] At least one user per target segment: solo dev, small agency, enterprise team
- [ ] Mix of technical and non-technical users
- [ ] Geographic spread if relevant for latency monitoring

### Onboarding Steps per User
1. Create account → verify email flow works end-to-end
2. Create first bot → confirm knowledge ingestion succeeds (PDF/URL)
3. Embed widget on their site → confirm CORS and API key scoping
4. Send 5+ chat messages → confirm stream, citations, and fallback responses

### Feedback Collection
- Weekly async form (Notion / Typeform) covering:
  - TTFT perceived ("felt fast / slow")
  - Onboarding friction points
  - Missing features (prioritize by frequency)

---

## Monitoring During Beta (2-week window)

### Daily Checks
- [ ] Run `beta_health_check.py` against production
- [ ] Review Sentry for new error classes
- [ ] Check rate-limit hit rate in logs — if >10% of sessions hit 429, raise limits

### Weekly Checks
- [ ] Run full load test at 100 concurrency
- [ ] Review Graphify "Surprising Connections" report for unexpected coupling
- [ ] Triage beta feedback form submissions

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| p95 TTFT | > 1.5s | > 2.0s |
| Error rate | > 2% | > 5% |
| 429 rate | > 5% | > 15% |
| Health check | any WARN | any FAIL |

---

## Go/No-Go Criteria for GA Launch

- [ ] Load test PASS at 100 concurrent streams with p95 TTFT < 2.0s
- [ ] Zero critical Sentry errors over final 48h of beta
- [ ] Beta NPS ≥ 7/10 average
- [ ] All onboarding friction points from week 1 resolved
- [ ] `beta_health_check.py` green for 7 consecutive days
