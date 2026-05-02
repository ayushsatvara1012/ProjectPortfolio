# Next.js Native Audit (May 1, 2026)

## Executive summary

The product is **mostly migrated and operating as a native Next.js App Router app**. Routing, layouts, metadata, middleware, and API route placement are all aligned to modern Next.js patterns.

However, a few items prevent it from being "perfectly" native/high-performance:

1. Root documentation still references Vite/React template defaults.
2. Mixed client-heavy rendering patterns likely increase JS payload where server components could be used.
3. Global script/font usage can be optimized for Core Web Vitals and bundle weight.
4. Backend API calls still proxy to a separate origin for many requests, adding latency and cross-origin complexity.

---

## Evidence of successful native Next.js migration

- App Router structure in `src/app` with route groups and nested layouts.
- Root metadata/viewport exported from `src/app/layout.tsx`.
- Middleware-based auth protection in `src/middleware.ts`.
- API route handlers under `src/app/api/.../route.ts`.
- Next config and runtime scripts use `next build`, `next start`, and `next dev` in npm scripts.

---

## Gaps to close for a "fully native" Next.js product

### 1) Remove migration residue
- Replace Vite template README content with accurate Next.js architecture and ops docs.

### 2) Increase Server Component usage
- Audit `src/app/components/*.tsx` and dashboard pages for components that do not need client state/effects.
- Move fetch-heavy or static sections to server components.
- Keep `"use client"` only where interactivity is required.

### 3) Prefer first-party Next data patterns
- Where possible, fetch from server components and route handlers directly instead of browser-side fetch + client hydration.
- Use route segment caching/revalidation intentionally (`revalidate`, `dynamic`, or fetch cache controls).

### 4) Performance and CWV
- Fonts:
  - Keep `next/font` as primary path; reduce duplicate external font CSS if possible.
- Scripts:
  - Reassess global `lazyOnload` chatbot loader so it does not run on every page unless required.
  - Consider route-level/script-conditional loading.
- Images:
  - Migrate eligible image usage to `next/image` with proper sizes/priority.

### 5) Security/perf header cleanup
- `X-XSS-Protection` is legacy and no longer meaningful for modern Chromium.
- `X-Frame-Options: ALLOWALL` is non-standard; CSP `frame-ancestors` should be the canonical control.

### 6) Reduce cross-origin API dependence where feasible
- Current rewrite proxy to external backend can be acceptable, but business-critical flows may benefit from:
  - regional colocation,
  - edge-safe proxy/route handlers,
  - or BFF-style server actions for latency-sensitive operations.

---

## Recommended implementation roadmap

### Phase 1 (fast wins, 1-2 days)
- Update docs (README, architecture notes).
- Remove legacy header usage and verify CSP policy.
- Add bundle/CWV baseline checks in CI (Lighthouse CI or Web Vitals reporting).

### Phase 2 (core architecture, 3-7 days)
- Convert non-interactive dashboard/marketing sections to server components.
- Move high-traffic data fetching from client hooks to server boundaries.
- Introduce cache/revalidation strategy by route type.

### Phase 3 (enterprise performance hardening, 1-2 weeks)
- Analyze bundle split with `next build` output and trim heavy client deps.
- Add performance budgets and regression gates.
- Evaluate backend colocation and request path optimization for chatbot latency under load.

---

## "Perfect for business" checklist

- [ ] 95+ Lighthouse on key marketing pages (mobile) and no CWV regressions.
- [ ] Documented cache strategy per route segment.
- [ ] Minimal client JS in dashboard shell.
- [ ] Observability for LCP, INP, TTFB, error rate, and chatbot response latency.
- [ ] Security review of headers, CSP, cookie/session settings, and embed hardening.
- [ ] Production load-test for chat streaming + tenant isolation validation.
