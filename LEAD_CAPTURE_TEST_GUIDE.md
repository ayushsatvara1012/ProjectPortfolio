# Lead Capture Feature Test Guide

This guide walks you through testing your Sapybase lead capture webhook feature.

## Prerequisites

1. **Backend Running** — The Sapybase backend must be running
2. **Test Webhook URL** — You need a URL where webhook payloads will be delivered
3. **API Key** — A valid bot API key from your dashboard
4. **Pro Plan** — The bot must be on PRO or CUSTOM plan to use lead capture

## Quick Setup

### Step 1: Get Your API Key and Bot ID

Go to **Dashboard → Settings** and find:
- **API Key** — Your bot's API key
- **Bot ID** — Your bot's unique identifier


### Step 2: Get a Test Webhook URL

Use [webhook.site](https://webhook.site) to get a free test webhook:
1. Visit https://webhook.site
2. Copy the unique URL (e.g., `https://webhook.site/abc123def456`)
3. Add it to your bot settings: **Dashboard → Settings → Integrations → Lead Capture Webhook URL**

### Step 3: Update the Test Script

Edit `test_lead_capture.py` and update these lines:

```python
# Line ~30-33
API_KEY = "your-actual-api-key-here"
WEBHOOK_URL = "https://webhook.site/your-unique-id"
```

### Step 4: Start the Backend (if not running)

```bash
cd sapybase_ai_engine
python main.py
```

The backend should start on `http://localhost:8000`

### Step 5: Run the Test

```bash
python test_lead_capture.py
```

## Expected Test Flow

### ✅ If Everything Works:

1. **Backend Health Check** — `✅ Backend is running`
2. **Lead Captured** — `✅ Lead captured successfully! Lead ID: 12345`
3. **Webhook Delivered** — `✅ Found 1 webhook delivery attempt(s)` with status `SUCCESS`

Output example:
```
✅ Attempt 1: SUCCESS
   HTTP Status: 200
   Timestamp: 2026-05-06 14:30:45.123456
```

### ❌ If Lead Capture Fails:

**Common Causes:**

| Error | Cause | Solution |
|-------|-------|----------|
| `403 Forbidden` | Lead capture not enabled | Check bot is PRO/CUSTOM plan |
| `400 Bad Request` | Invalid payload | Verify email format is valid |
| `Duplicate` | Email captured in last 24h | Use different email address |
| Backend connection error | Backend not running | Start backend: `python main.py` |

### ❌ If Webhook Doesn't Fire:

**Common Causes:**

| Issue | Cause | Solution |
|-------|-------|----------|
| No webhook URL found | Not configured | Add URL to Settings → Integrations |
| Failed delivery attempts | Invalid webhook URL | Check URL format (must start with `https://`) |
| All attempts failed | Webhook endpoint error | Check webhook.site for error details |

## Manual Testing (Without Script)

If you prefer to test manually with curl:

```bash
curl -X POST http://localhost:8000/api/leads/capture \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "context": "Testing lead capture"
  }'
```

Expected response (success):
```json
{
  "status": "success",
  "lead_id": "12345"
}
```

Expected response (duplicate):
```json
{
  "status": "duplicate",
  "message": "Lead already captured recently"
}
```

## Database Verification

Check webhook delivery attempts directly in the database:

```sql
-- Check all leads captured
SELECT id, email, name, created_at FROM lead_capture 
WHERE company_id = 'YOUR_BOT_ID'
ORDER BY created_at DESC LIMIT 10;

-- Check webhook delivery attempts for a specific lead
SELECT attempt, status, http_status, error_msg, created_at 
FROM lead_webhook_deliveries
WHERE lead_id = 'LEAD_ID'
ORDER BY attempt ASC;

-- Check webhook delivery attempts for all leads (last 24h)
SELECT l.id, l.email, d.attempt, d.status, d.http_status
FROM lead_capture l
LEFT JOIN lead_webhook_deliveries d ON l.id = d.lead_id
WHERE l.company_id = 'YOUR_BOT_ID'
  AND l.created_at > NOW() - INTERVAL '24 hours'
ORDER BY l.created_at DESC;
```

## Webhook Payload Format

When a lead is captured, your webhook receives:

```json
{
  "event": "lead.captured",
  "lead_id": "12345",
  "email": "visitor@example.com",
  "name": "John Doe",
  "context": "User message or context",
  "bot_id": "your-bot-id",
  "bot_name": "Your Bot Name"
}
```

### Signature Verification (if webhook_secret is set)

The request includes header: `X-Sapybase-Signature: sha256=...`

To verify:
```python
import hmac
import hashlib

secret = "your-webhook-secret"
body = request.get_data()  # Raw request body
signature = request.headers.get('X-Sapybase-Signature')

expected_sig = "sha256=" + hmac.new(
    secret.encode(),
    body,
    hashlib.sha256
).hexdigest()

if hmac.compare_digest(signature, expected_sig):
    print("✅ Signature is valid")
else:
    print("❌ Signature is invalid")
```

## Test Results

Once you've run the test, here are the typical results:

### Full Success ✅
- Lead captured
- Webhook fired to your URL
- All attempts logged

### Partial Success ⚠️
- Lead captured
- Webhook URL not configured (expected)
- Can still verify lead in database

### Failure ❌
- Cannot capture lead
- Check plan, lead capture enabled, API key valid

## Troubleshooting

### "Cannot connect to backend"
```bash
# Verify backend is running
curl http://localhost:8000/api/health

# If not running, start it:
cd sapybase_ai_engine
python main.py
```

### "Lead capture requires Pro plan"
```bash
# Check bot tier in database:
SELECT id, bot_name, u.tier FROM companies c
JOIN users u ON c.user_id = u.id
WHERE c.id = 'YOUR_BOT_ID';

# Upgrade to PRO if needed
```

### "Webhook not firing"
1. Check webhook URL in Settings
2. Test URL format: must be `https://...`
3. Go to webhook.site and refresh to see if request arrived
4. Check database: `SELECT * FROM lead_webhook_deliveries WHERE lead_id = '...'`

## Questions?

- Check the implementation: `sapybase_ai_engine/main.py` (functions: `capture_lead()`, `_fire_webhook()`)
- Frontend code: `src/app/(app)/dashboard/settings/customize/page.tsx` (webhook URL input)
- Database schema: Check `lead_capture` and `lead_webhook_deliveries` tables
