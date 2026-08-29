# Vaayu — Technical Summary for Developers

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Website Visitor                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
   ┌────────────┐                    ┌──────────────────┐
   │  Chatbot   │                    │  LLM API         │
   │  Widget    │                    │  (Gemini 2.5)    │
   │ (Embedded) │◄───────────────────┤  (Inference)     │
   │  JS/React  │                    │                  │
   └────────────┘                    └──────────────────┘
        │
        │ (API calls)
        ▼
   ┌──────────────────────────────────────────┐
   │         FastAPI Backend                  │
   │    (Python + uvicorn + gunicorn)         │
   │                                          │
   │ - Chat endpoint: /api/chat               │
   │ - Widget session: /api/widget/session    │
   │ - Admin endpoints: /api/admin/*          │
   │ - Lead scoring + alerts                  │
   │ - BYOD routing + pools                   │
   └──────────────────────────────────────────┘
        │
        ├─────────────────┬────────────────┬─────────────────┐
        ▼                 ▼                ▼                 ▼
   ┌─────────────┐  ┌──────────┐   ┌──────────────┐   ┌────────────┐
   │  Shared DB  │  │  BYOD    │   │    Redis     │   │  Slack     │
   │ (PostgreSQL)│  │  Client  │   │   Cache      │   │  Webhook   │
   │             │  │   DBs    │   │              │   │            │
   │ - Messages  │  │(Customer │   │ - Sessions   │   │ Hot leads  │
   │ - Analytics │  │Postgres) │   │ - Chat cache │   │ Alerts     │
   │ - Users     │  │          │   │              │   │            │
   └─────────────┘  └──────────┘   └──────────────┘   └────────────┘
```

---

## Tech Stack Details

### Frontend
**Widget (End User)**
- **React** embedded iframe
- **TypeScript** for type safety
- **CSS-in-JS** for styling
- ~50 KB gzipped

**Dashboard (Admin & Users)**
- **Next.js 16** (App Router)
- **React 19** server components
- **Tailwind CSS** + dark mode
- **Framer Motion** for animations
- **React Query** for data fetching
- **Clerk** for authentication
- Deployed on **Vercel** with edge functions

### Backend
- **FastAPI** (Python 3.12+)
- **Uvicorn** ASGI server
- **Gunicorn** with 4 worker processes
- **Pydantic** for request validation
- Deployed on **Render** with auto-scaling
- Public URLs: `sapyai.onrender.com`

### Database
**Shared (Default)**
- **PostgreSQL** (managed via Supabase)
- **Tables:** companies, users, chat_logs, company_knowledge, lead_capture, analytics
- **Indexes:** Optimized for chat + search queries

**BYOD (Enterprise)**
- Customer brings their own Postgres
- Engine maintains separate pool per tenant
- Schema injection + auto-migration
- Data isolation via `vaayu_runtime` role (DML-only)
- Connection pooling per tenant (max 3 conns, global ceiling 100)
- Circuit breaker for fault isolation

### LLM & Embeddings
- **Gemini 2.5 Pro** for chat inference
- **Gemini Embeddings** for RAG (stored in `pgvector`)
- **RAG Flow:** User question → Embeddings → Vector search → Retrieve top-k docs → Prompt → LLM response
- Latency: ~200ms prompt processing + ~500ms LLM response

### Caching & Performance
- **Redis** (managed)
  - Session tokens (TTL 30 min)
  - Chat query cache (exact_query_cache)
  - Rate limiting buckets
  - BYOD DSN cache (TTL 5 min)
  - BYOD routing decision cache (TTL 45 sec)

- **Browser caching**
  - Static assets: 30 days
  - API responses: 1 min (react-query)

### Authentication & Security
- **Clerk** OAuth + email (shared DB)
- **JWT tokens** (max 10 min for admin operations)
- **Super-admin gates** for BYOD lifecycle
- **KMS encryption** for stored database credentials
  - AES-GCM 256-bit
  - Master keys in Render env
  - Per-tenant data encryption key

### Email & Notifications
- **Resend** API for transactional emails
- **Slack** webhooks for lead alerts
- **AlertManager** for system alerts (observability)

### Infrastructure & DevOps
- **Render** (backend, background workers, cron jobs)
  - 2 static egress IPs for BYOD allowlisting
  - Cron: `byod-switchin-purge` (3 AM), `byod-dataplane-migrations` (3:30 AM)
- **Vercel** (Next.js frontend, edge functions)
- **Supabase** (PostgreSQL, auth helpers)
- **Grafana Cloud** (metrics, alerting, dashboards)
- **GitHub Actions** (CI/CD, tests, linting)

### Monitoring & Observability
- **Prometheus** (metrics collection)
  - `sapybase_http_requests_total` (counters)
  - `sapybase_http_request_duration_seconds` (histograms)
  - `byod_*` gauges (circuit breaker, cache hits/misses, tenant pools)
- **Grafana Cloud** (dashboards, alerting)
  - 14-day free trial → auto-fallback to free tier
  - Mimir ruler (alert rules)
  - Alloy scraper (metrics ingestion)
- **Custom alerts** (8 rules, 3 page-severity)
  - BYODTenantBreakerOpen
  - BYODTenantWriteDegraded
  - BYODKmsColdTenantDown

---

## Core Endpoints

### Chat API
```
POST /api/widget/session
- Input: bot_id, origin, user_metadata (optional)
- Output: session_token (30 min TTL)
- Rate limit: 100/min per origin

POST /api/chat
- Input: message, session_token, message_id
- Output: {"response": "...", "lead_score": 0.92, "confidence": 0.8}
- Rate limit: 2000/hr per session
- Response time: p95 = 12ms (shared), p95 = 800ms (with LLM)
```

### Admin API (Requires super-admin + fresh JWT <10 min)
```
GET /api/admin/byod/tenants
- Output: List of all BYOD tenants with status, health, routing state

POST /api/admin/users/{clerk_id}/byod/enroll
- Enable BYOD for a user

PUT /api/admin/users/{clerk_id}/byod/connection
- Store encrypted database credentials

POST /api/admin/users/{clerk_id}/byod/test
- Verify DSN connectivity + pgvector availability

POST /api/admin/users/{clerk_id}/byod/provision
- Provision schema, roles, runtime DSN

POST /api/admin/users/{clerk_id}/byod/health
- Check tenant database health (classify errors)

POST /api/admin/users/{clerk_id}/byod/enable
- Enable routing to tenant database (live traffic)

POST /api/admin/users/{clerk_id}/byod/disable
- Disable routing, revert to shared database

GET /api/admin/users/{clerk_id}/byod/usage
- Usage metrics (messages billed, trailing 24h/7d/30d)
```

### Client API (Requires session auth, company-scoped)
```
GET /api/byod/me
- Current status, last health check, pending requests

POST /api/byod/me/test
- Self-serve test of their DSN

PUT /api/byod/me/connection
- Client submits DSN (stored PENDING, not live)

POST /api/byod/me/request-change
- Request reconnect (if NEEDS_RECONNECT) or leave BYOD
```

---

## Data Model Highlights

### Core Tables (Shared DB)
```sql
companies (
  id UUID,
  clerk_user_id VARCHAR,
  tier ENUM (FREE, STARTER, GROWTH, BUSINESS, CUSTOM),
  custom_plan_config JSONB,
  created_at TIMESTAMP
);

company_knowledge (
  id UUID,
  company_id UUID,
  content TEXT,
  embedding vector(1536),
  source_type ENUM (uploaded, website, api),
  created_at TIMESTAMP,
  CONSTRAINT fk_company FOREIGN KEY (company_id)
);

chat_logs (
  id UUID,
  company_id UUID,
  message TEXT,
  response TEXT,
  lead_score FLOAT,
  confidence FLOAT,
  created_at TIMESTAMP
);

lead_capture (
  id UUID,
  company_id UUID,
  name TEXT,
  email VARCHAR,
  phone VARCHAR,
  message TEXT,
  quality_score FLOAT,
  status ENUM (new, contacted, qualified, converted),
  created_at TIMESTAMP
);
```

### BYOD Tables (Control Plane)
```sql
byod_tenant_databases (
  company_id UUID PRIMARY KEY,
  db_url_encrypted BYTEA,
  runtime_dsn_encrypted BYTEA,
  runtime_dsn_data_key BYTEA,  -- KMS-wrapped
  status ENUM (PENDING, LIVE, DISABLED, NEEDS_RECONNECT),
  routing_enabled BOOLEAN DEFAULT FALSE,
  schema_version VARCHAR,
  created_at TIMESTAMP,
  last_health_at TIMESTAMP,
  pending_change_kind VARCHAR,  -- "reconnect" | "leave"
  pending_change_at TIMESTAMP
);
```

### Tenant Data Plane (Customer's DB)
- Auto-created schema with same tables as shared DB
- `vaayu_runtime` role (DML-only, cannot drop tables)
- Separate per-tenant connection pool + circuit breaker

---

## Latency & Performance

### Target SLOs
- **Shared Plane:**
  - Error rate: <0.5% (p99)
  - p95 latency: <1.5 sec
  - p99 latency: <3.3 sec
- **BYOD Plane:**
  - Error rate: Soft-degrade (reads work, writes cache)
  - Circuit breaker: Open after 5 consecutive failures (reset 30s)

### Real Production Numbers (Last 6h, 729 requests)
- Error rate: 0% (0 5xx, 0 4xx)
- p95 latency: 12.3 ms
- p99 latency: 24.5 ms

### Chat Pipeline Breakdown
1. **Request parse + auth** = 1-2 ms
2. **RAG embedding** = 100-150 ms
3. **Vector search** = 5-10 ms
4. **LLM inference** = 300-800 ms
5. **Response formatting + DB write** = 10-20 ms
6. **Total p95** = 500-1000 ms

---

## BYOD Architecture

### Two-Plane Design
1. **Control Plane (Sapybase)** = Auth, KMS, orchestration, metrics
2. **Data Plane (Customer's DB)** = Actual chat data

### Data Flow (BYOD Chat)
```
1. Client chat → /api/chat (Sapybase backend)
2. Authorize + resolve tenant DSN (KMS decrypt from control DB)
3. Get tenant pool connection (circuit breaker + pooling)
4. Query tenant DB: company_knowledge (vector search)
5. LLM inference (Gemini, not on tenant DB)
6. Write chat_logs to tenant DB
7. Return response to client
8. Background: Emit metrics, update billing counter
```

### Fault Isolation
- **Circuit Breaker:** Tracks per-tenant health, auto-opens on 5 failures
- **Query Timeout:** 30 sec per statement (prevents hung queries)
- **Pool Limits:** Max 3 conns per tenant (prevents resource exhaustion)
- **Graceful Degradation:**
  - DB unreachable → Serve from cache OR return "Tenant DB unavailable" page
  - Read-only DB → Chat succeeds (reads OK), analytics soft-fail (writes cache)
  - KMS down → Serve from cache for 1 hour

---

## Security Highlights

1. **Database Credentials**
   - Never logged, stored, or cached in plaintext
   - AES-GCM encrypted at rest in control DB
   - Decrypted only in memory for connection pooling
   - Per-tenant encryption key (different for each customer)

2. **BYOD Schema Isolation**
   - `vaayu_runtime` role (DML-only, read/write data tables only)
   - Cannot modify schema, drop tables, or access other roles
   - Cannot execute functions or create views

3. **Network Isolation**
   - Customer allows 2 static Render egress IPs (`74.220.48.0/24` + `74.220.56.0/24`)
   - Private-link option coming in v2
   - All traffic: TLS 1.3 + mutual cert validation option

4. **Authentication**
   - Clerk OAuth (industry standard, SOC 2)
   - Admin operations require fresh JWT (<10 min old)
   - Webhook signature verification (HMAC-SHA256)

5. **Compliance Ready**
   - SOC 2 Type II eligible
   - DPA (Data Processing Agreement) available
   - GDPR delete support (hard-delete from both planes)
   - Audit logs for all admin operations

---

## Testing Strategy

### Backend (Python)
- **Unit tests:** 366+ tests, 100% core paths
- **Integration tests:** Postgres fixtures, pgvector vector search
- **BYOD tests:** Circuit breaker, failover, KMS, soft-degrade
- **Chaos tests:** Connection pool exhaustion, timeouts, KMS errors
- **CI:** GitHub Actions (runs on all PRs)

### Frontend (React/Next.js)
- **Component tests:** 286+ tests (vitest)
- **Accessibility:** Keyboard nav, ARIA labels, color contrast
- **E2E:** (Not yet automated, manual testing in preview)
- **CI:** TypeScript strict mode (0 errors)

---

## Deployment & Rollback

### Normal Deploy
1. Merge to `MainV2` branch
2. GitHub Actions: Run tests, build Docker image
3. Render auto-deploys backend (blue-green)
4. Vercel auto-deploys frontend (immutable, instant rollback)
5. Smoke tests: Hit health endpoints

### Rollback Strategy
- **Backend:** Render single-click rollback to previous deployment
- **Frontend:** Vercel automatic revert (push old commit)
- **Database:** Zero-downtime migrations (additive only, never remove columns)
- **BYOD:** Can disable globally via `BYOD_ENABLED=false` (dark data stays)

### BYOD Production Readiness
- ✅ Phase 0: KMS setup
- ✅ Phase 1: Metrics + egress IP documentation
- ✅ Phase 2: HTTP metrics + multiprocess Prometheus
- ✅ Phase 3: Circuit breaker + per-tenant pooling
- ✅ Phase 4: Canary dry-run (Neon test DB)
- ✅ Phase 5: Failure injection (all 4 modes verified)
- ✅ Phase 6a: Observability + alerts
- ✅ Phase 6b: Runbooks + on-call docs
- ✅ Phase 7: Shared-fleet regression (SLO gates pass)
- ✅ Phase 8: Production deploy + live client test
- ⏳ Phase 9: First paying customer (C3-C5 gates)

---

## Open Source & Reusability

### Not Open Source (Yet)
- Vaayu is closed-source proprietary
- Built with popular open-source libraries:
  - FastAPI, Pydantic, SQLAlchemy, psycopg2
  - Next.js, React, Tailwind, Framer Motion
  - Postgres, Redis, Gemini API

### Potential for Contribution
- We use standard tech stacks (Python/Node.js)
- Bug fixes and improvements gladly accepted
- Integrate with the Vaayu platform for lead scoring

---

## Roadmap for Developers

**Current (v1):**
- ✅ Chat + lead scoring
- ✅ Slack integration
- ✅ BYOD (early access)

**Next (2-4 weeks):**
- Email digest (lead summary)
- Webhooks (CRM integration)
- SMS alerts

**Soon (1-2 months):**
- API for custom integrations
- Prompt templating
- Custom lead scoring rules

**Future (3-6 months):**
- Multi-language support
- Advanced analytics (cohort analysis, LTV tracking)
- Private-link connectivity for BYOD

---

## For the Product Hunt Audience

### Why This Tech Stack?

**FastAPI** → 10x faster development, Pythonic, built-in async
**Next.js** → Server components reduce bundle size, SEO benefits
**Postgres + pgvector** → Open-source reliability + native vector search
**Gemini 2.5** → Most capable LLM at reasonable cost
**Render + Vercel** → Fast deploy, infrastructure as code, auto-scaling

### Performance Metrics We're Proud Of
- **Sub-100ms chat UI response** (perceived latency)
- **12ms p95 backend latency** (shared plane)
- **99%+ uptime** (redundant infra)
- **Zero cold starts** (always-warm workers)

### Scalability
- 4 Gunicorn workers on Render (can add more)
- Horizontal scaling: Redis + DB connection pooling
- Can handle 10,000 concurrent chats
- BYOD tenants isolated → one customer's outage ≠ everyone's

---

## Developer-Friendly Features

1. **Webhook support** (coming soon)
   - Lead events: `lead.created`, `lead.scored`, `lead.qualified`
   - Chat events: `chat.started`, `chat.completed`

2. **REST API** (documented)
   - [docs.vaayu.io/api](https://docs.vaayu.io/api)
   - OpenAPI/Swagger schema
   - Postman collection included

3. **SDKs** (planned)
   - JavaScript/TypeScript
   - Python
   - Go (maybe)

4. **Self-hosted Option** (v2)
   - Docker image
   - K8s Helm charts
   - Bring your own LLM

---

*Questions? Check our docs or reach out to the team.* 🚀
