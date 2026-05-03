# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, **do not** open a public GitHub issue.

Email **security@sapybase.com** with:
- A description of the vulnerability and its potential impact
- Steps to reproduce or proof-of-concept code
- The affected component (frontend, backend API, widget)

We will acknowledge receipt within **48 hours** and aim to release a fix within **14 days** for critical issues.

## Scope

In scope:
- Authentication bypass or privilege escalation
- Cross-tenant data leakage (accessing another user's bot/knowledge data)
- SQL injection, SSRF, or remote code execution
- Exposed secrets or API keys in responses
- CSP bypass or XSS in the widget or dashboard

Out of scope:
- Denial of service without meaningful data impact
- Social engineering
- Vulnerabilities in third-party dependencies without a demonstrated exploit path

## Security Architecture Overview

### Headers
- `Strict-Transport-Security` with `preload` enforced on all routes
- `Content-Security-Policy` restricts scripts to `'self'`, Clerk, Cloudflare, and Stripe
- `X-Frame-Options: SAMEORIGIN` on all non-embed routes
- `X-Content-Type-Options: nosniff` globally
- Embed routes use `frame-ancestors *` (required for the chat widget)

### Authentication
- All dashboard and API routes require a valid Clerk JWT via `get_current_user`.
- Widget/embed routes authenticate via a per-company API key + origin allowlist.
- Multi-tenant isolation enforced at the DB query layer: every query is scoped to `company_id`.

### Rate Limiting
- Redis-backed `slowapi` rate limits on all public API endpoints.
- In-memory fallback if Redis is unreachable (single-worker enforcement only).

### Data Deletion (GDPR / Right to Erasure)

Users may request permanent deletion of all their personal data:

1. **Self-service**: Delete your account from the Clerk user portal — this triggers a `user.deleted` webhook that automatically purges all associated data.
2. **API**: Authenticated users can call `DELETE /api/user/gdpr-delete` to immediately purge their account data without going through the Clerk portal.
3. **Manual request**: Email **privacy@sapybase.com** with the subject "Data Deletion Request". We will complete the deletion within 30 days.

Data deleted includes: user record, usage tracking, all bots, knowledge base chunks, leads, and subscription linkage.

### No Sensitive Keys in Logs
- API keys and secrets are never written to `stdout` or log files.
- Debug-level CORS rejection logs redact the expected origin value in production.
