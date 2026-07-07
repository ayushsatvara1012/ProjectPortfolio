# Security Policy

## Reporting a Vulnerability

Do **not** open a public issue. Email **security@sapybase.com** with:
- Vulnerability description and impact
- Steps to reproduce or PoC
- Affected component (frontend, backend, widget)

**SLA:** Acknowledge within 48 hours. Fix within 14 days for critical issues.

## In Scope

- Authentication bypass, privilege escalation, cross-tenant data leakage
- SQL injection, SSRF, RCE
- Exposed secrets or API keys
- CSP bypass or XSS

## Security Guardrails (Code Reference)

- **Auth**: Clerk JWT on dashboard/API routes; API key + origin allowlist on widget routes. Multi-tenant: all queries scoped to `company_id` (enforce at DB layer).
- **Headers**: HSTS + preload, CSP (`'self'` + Clerk/Cloudflare/Stripe), X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff.
- **Rate Limiting**: Redis-backed slowapi on public endpoints.
- **Data Deletion**: Clerk webhook auto-purges on account delete; API: `DELETE /api/user/gdpr-delete`; manual: email privacy@sapybase.com.
- **Logging**: No API keys/secrets in stdout/logs; redact sensitive values in debug logs.
