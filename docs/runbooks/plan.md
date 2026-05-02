# Next.js Native Audit & Migration Plan (Updated May 1, 2026)

## Executive summary

The product is **mostly migrated and operating as a native Next.js App Router app**. Routing, layouts, metadata, middleware, and API route placement are all aligned to modern Next.js patterns.

However, a few items prevent it from being "perfectly" native/high-performance:
1. Root documentation still references Vite/React template defaults.
2. Root layout is monolithic, leaking Clerk/Auth JS to the `/embed` routes.
3. Legacy `<img>` tags bypass Next.js image optimization.
4. Backend API calls still proxy to a separate origin for many requests.

---

## Evidence of successful native Next.js migration
- App Router structure in `src/app` with route groups and nested layouts.
*   **Server-Side Seeding**: `dashboard/layout.tsx` correctly fetches user data on the server.
- Middleware-based auth protection in `src/middleware.ts`.
- Next config and runtime scripts use `next build`, `next start`, and `next dev`.

---

## Gaps to close for a "100% native" Next.js product

### 1) Deconstruct Root Layout (Route Group Isolation)
- **Problem**: `RootLayout` wraps everything in `Providers` (Clerk, etc.). Even with client-side guards, the heavy JS bundles are downloaded on the `/embed` routes.
- **Fix**: Move `Providers` into a `(main)` route group and leave the root layout "naked." Create a specialized layout for the `embed` group.

### 2) Migrate to `next/image`
- **Problem**: Key components (`AboutClient`, `ChatWidget`) use standard `<img>` tags.
- **Fix**: Swap all local and remote images to `next/image` for automatic WebP conversion, lazy loading, and LCP improvements.

### 3) Server Component Conversion
- **Problem**: `EmbedPage` and several dashboard sections use `"use client"` for logic that is available on the server (e.g., `params`, `searchParams`).
- **Fix**: Convert `src/app/embed/[botId]/page.tsx` to a Server Component to eliminate client-side JS overhead in the widget iframe.

### 4) Metadata & SEO Isolation
- **Problem**: All routes share the same root metadata, causing `/embed` routes to have incorrect OG tags.
- **Fix**: Move marketing SEO to `(site)/layout.tsx` and use `generateMetadata` for dynamic bot titles in the embed route.

---

## Recommended implementation roadmap

### Phase 1 (fast wins, 1-2 days)
- Update docs (README, architecture notes).
- **[NEW]** Migrate legacy `<img>` tags in `AboutClient.tsx` and `HeroSection.tsx` to `next/image`.
- Remove legacy header usage (`X-XSS-Protection`) and verify CSP policy.
- Add bundle/CWV baseline checks in CI.

### Phase 2 (core architecture, 3-7 days)
- **[NEW]** **Route Group Isolation**: Move `RootLayout` logic into `(site)`, `(dashboard)`, and `(embed)` groups.
- **[NEW]** Convert `EmbedPage` and `UserSeed` into Server Components.
- Move high-traffic data fetching from client hooks to server boundaries.
- Introduce cache/revalidation strategy by route type.

### Phase 3 (enterprise performance hardening, 1-2 weeks)
- Analyze bundle split with `next build` output and trim heavy client deps.
- **[NEW]** Evaluate **Edge Runtime** for the `/embed` route handlers to minimize global latency.
- Evaluate backend colocation and request path optimization for chatbot latency under load.

---

## "Perfect for business" checklist

- [ ] 95+ Lighthouse on key marketing pages (mobile) and no CWV regressions.
- [ ] No Clerk/Toast JS bundles loaded in the `/embed` iframe.
- [ ] Documented cache strategy per route segment.
- [ ] 100% usage of `next/image` for production assets.
- [ ] Production load-test for chat streaming + tenant isolation validation.
