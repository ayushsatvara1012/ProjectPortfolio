# Sample-request → Google Sheet (Apps Script sink)

Phase 4b form (chemical vertical). When a visitor submits the **sample request
form** in the widget, the backend records it locally **and** POSTs the submission
to a configurable webhook (`SAMPLE_SINK_WEBHOOK_URL`). Point that webhook at the
Google Apps Script below to append one row per submission to a Google Sheet —
mirroring the client's existing "Google Form → Sheet" workflow.

> The same pattern works for **Excel Online**: instead of Apps Script, point
> `SAMPLE_SINK_WEBHOOK_URL` at a **Power Automate** "When an HTTP request is
> received" flow → "Add a row into an Excel table". The backend doesn't change.

## Payload the backend sends

`POST` with `Content-Type: application/json` and (if `SAMPLE_SINK_SECRET` is set)
an `X-Sapybase-Signature` header = HMAC-SHA256 of the raw body:

```json
{
  "event": "sample_request",
  "company_id": "6bffa999-…",
  "submitted_at": "2026-06-25T12:34:56+00:00",
  "idempotency_key": "…",
  "fields": {
    "product": "Acetone", "grade": "AR", "quantity": "2",
    "contact_name": "Asha", "company": "Acme Labs",
    "contact_email": "asha@acme.com", "contact_phone": "+91…",
    "address": "…", "application": "…", "notes": "…"
  }
}
```

`fields` is the full, customizable form payload — its keys are whatever the pack's
`sample_form` defines, so the sheet columns line up with the form 1:1.

## Setup (Google Sheets, ~2 minutes)

1. Open (or create) the destination Google Sheet. Add a header row matching the
   form fields, e.g. `Submitted | Product | Grade | Quantity | Name | Company |
   Email | Phone | Address | Application | Notes`.
2. **Extensions → Apps Script**, paste the script below, **Save**.
3. **Deploy → New deployment → Web app**: *Execute as* = **Me**, *Who has access*
   = **Anyone**. Copy the **Web app URL**.
4. Set the backend env vars and restart:
   - `SAMPLE_SINK_WEBHOOK_URL` = that Web app URL
   - `SAMPLE_SINK_SECRET` = a random string (use the same value in the script's
     `SECRET` below to verify the signature; leave both blank to skip verification)

```javascript
const SECRET = '';  // must match SAMPLE_SINK_SECRET (leave '' to skip verification)

function doPost(e) {
  try {
    const raw = e.postData.contents;

    // Optional HMAC verification (recommended once SECRET is set).
    if (SECRET) {
      const sig = e.parameter['sig'] || (e.headers && e.headers['X-Sapybase-Signature']);
      const mac = Utilities.computeHmacSha256Signature(raw, SECRET);
      const hex = mac.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
      if (hex !== sig) return ContentService.createTextOutput('bad signature').setStatusCode?.(401);
    }

    const body = JSON.parse(raw);
    const f = body.fields || {};
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // One row per submission. Reorder/extend to match your header row.
    sheet.appendRow([
      body.submitted_at || new Date().toISOString(),
      f.product || '', f.grade || '', f.quantity || '',
      f.contact_name || '', f.company || '', f.contact_email || '',
      f.contact_phone || '', f.address || '', f.application || '', f.notes || ''
    ]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

> Apps Script's `doPost` doesn't always expose custom headers; if HMAC via header
> is unreliable in your deployment, the backend can be switched to append the
> signature as a `?sig=` query param instead — tell me and I'll flip it.

## Notes

- **Idempotent:** the backend dedups by `idempotency_key` (10-min window) so a
  double-submit/retry won't create duplicate rows. If you want belt-and-braces,
  the script can also skip a row whose `idempotency_key` already exists.
- **Dormant until configured:** with `SAMPLE_SINK_WEBHOOK_URL` unset, submissions
  are still recorded locally + the owner is notified (Slack/email) — nothing
  breaks before the sheet is wired.
- **Per-client later:** for now this is one fixed destination (env var). The
  customise section will make the sink URL + form fields per-company.
