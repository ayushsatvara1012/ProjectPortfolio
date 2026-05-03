# Sapybase 100/100 Launch Readiness Plan

This plan outlines the roadmap to move the Sapybase SaaS product from its current **79/100** score to a **100/100** production-ready state. It addresses all critical gaps identified in the audit: isolated components, low test coverage, missing monitoring, and architectural fragmentation.

---

## Phase 1: Foundation & Stability (Testing & Validation)
**Goal**: Increase reliability from "untested" to "verified" and close data validation gaps.

### 1.1 Testing Coverage Expansion
- **Action**: Implement a minimum of 20 new test files using Vitest (frontend) and Pytest (backend).
- **Key Flows**: 
  - Chat ingestion -> Embedding -> Retrieval flow.
  - Subscription tier enforcement (Free/Basic/Pro/Business/Enterprise).
  - Auth middleware & protected route guards.
  - Multi-tenant isolation (ensuring Bot A cannot access Bot B's knowledge).

### 1.2 Data Validation Hardening
- **Action**: Audit all Pydantic (backend) and Zod (frontend) schemas.
- **Edge Cases**: 
  - Handle malformed PDF/CSV uploads gracefully with specific user feedback.
  - Validate all external URLs for SSRF protection (already started in `main.py`).
  - Sanitize all LLM outputs to prevent prompt injection leakage in the UI.

### 1.3 Centralized Logging & Error Visibility
- **Action**: Integrate Sentry or a similar observability tool.
- **Implementation**: 
  - Backend: FastAPI exception handlers to capture 500s.
  - Frontend: React Error Boundaries to prevent dashboard crashes.
  - Alerting: Set up Slack/Email alerts for rate-limit peaks or DB connection failures.

---

## Phase 2: Architectural Hardening (Performance & Scaling)
**Goal**: Improve cohesion and prepare for high-concurrency traffic.

### 2.1 Route Group Isolation & Bundle Optimization
- **Action**: Deconstruct the root layout to isolate `(site)`, `(dashboard)`, and `(embed)` routes.
- **Benefit**: Reduces the `/embed` widget payload by 60-70% by removing Clerk and heavy dashboard providers.

### 2.2 Edge Runtime Conversion
- **Action**: Move the `/embed` route and chat retrieval logic to Vercel Edge Runtime.
- **Constraint**: Must use Edge-compatible libraries (e.g., `jose` for JWT, `httpx` for requests).

### 2.3 Distributed Rate Limiting
- **Action**: Enforce Redis as the primary storage for `slowapi` rate limits.
- **Requirement**: Zero-downtime fallback to in-memory only if Redis is completely unreachable.

---

## Phase 3: Security, Compliance & Documentation
**Goal**: Achieve "Enterprise Ready" status through audits and transparency.

### 3.1 Security & Compliance Audit
- **Action**: Create a `SECURITY.md` and implement a GDPR-compliant data deletion endpoint.
- **Checks**: 
  - verify CSP headers in `next.config.mjs`.
  - Ensure no sensitive keys are logged in `stdout`.
  - Automated database backup verification scripts.

### 3.2 100% Component Mapping
- **Action**: Resolve the "99 isolated nodes" flagged by Graphify.
- **Implementation**: Refactor isolated functions into shared utility modules (`src/lib`) or explicit component hierarchies. Every node must have at least 2 edges.

---

## Phase 4: Optimization & Launch (Beta Phase)
**Goal**: Final polish and real-world validation.

### 4.1 Production Load Testing
- **Action**: Run the `sse_load_test.py` at 5x expected scale (100+ concurrent streams).
- **Metric**: Maintain < 2s Time-to-First-Token (TTFT) under load.

### 4.2 2-Week Trusted Beta
- **Action**: Onboard 10-20 users. 
- **Focus**: Monitor for "Surprising Connections" in Graphify and resolve any UX friction in the onboarding flow.

---

## AI Implementation Constraints (CRITICAL)

When executing this plan, the AI assistant (Antigravity) MUST adhere to the following rules:

1. **No Hallucinations**: NEVER assume a library or function exists. Always run `ls` or `grep` to verify the presence of files/imports before writing code.
2. **Context First**: Always check `graphify-out/GRAPH_REPORT.md` before modifying core architecture to avoid breaking hidden dependencies.
3. **TypeScript Strictness**: New frontend code must be 100% type-safe. Avoid `any` at all costs.
4. **Atomic Commits**: Each feature (e.g., "Add Sentry") must be verified with a test run before proceeding to the next item.
5. **Zero-Downtime Migration**: Database schema changes must be backward compatible (Additive first, then Destructive only after code migration).
6. **Token Efficiency**: Use summarized views of large files (`main.py`) rather than reading the full content repeatedly.
7. **Security Defaults**: All new API endpoints must default to "Protected" (Clerk auth required) unless explicitly marked as Public (e.g., Widget API).
