## Phase 1: Structural Cleanup & Dependency Pruning
Your existing items are correct. Additions:

*   **Clerk proxy route:** The src/proxy.ts file is misnamed — it appears to be your actual middleware.ts. Rename it and consolidate it with Phase 2's middleware work rather than treating them separately.
*   **Duplicate Alert components:** You have src/components/marketing/Alert.tsx AND src/app/components/Alert.tsx with near-identical logic. Delete the marketing version and update imports.
*   **Duplicate BotIntegrationDocs:** src/app/components/BotIntegrationDocs.tsx is the same component referenced from both dashboard and docs pages. Confirm there's only one source of truth.
*   **AvatarShared exports:** LogoCustomizer.tsx re-exports constants from AvatarShared.ts which causes indirect imports in downstream files. Clean up re-exports to import directly from AvatarShared.

---

## Phase 2: Next.js Native Architecture Transition
Your existing items are correct. Additions:

*   **Embed route isolation:** src/app/providers.tsx already short-circuits for /embed/ routes. When you deconstruct the global provider, this guard must be preserved in the new layout structure — the embed iframe must never receive Clerk, QueryClient, or toast providers.
*   **useSessionManager hook:** This hook in src/lib/hooks/useSessionManager.ts enforces session freshness via sessionStorage — a pattern that breaks under SSR. It needs to be moved inside a useEffect with an isClient guard before the provider refactor runs.
*   **UserSeed pattern:** The SSR seed via src/app/components/UserSeed.tsx + DashboardLayout is a good pattern but currently fetches /api/me during SSR on every dashboard navigation. Consider caching with cache: 'force-cache' and a short revalidation window instead of no-store.
*   **NavigationProgress dependency:** This component uses useIsFetching from React Query, which requires QueryClientProvider. If you split providers by route group, ensure this component stays within the dashboard provider boundary.

---

## Phase 3: Performance & Asset Polish
Your existing items are correct. Additions:

*   **Animated SVG in Footer:** InteractiveSchematic in Footer.tsx runs a requestAnimationFrame loop updating React state 60 times per second. This will cause hydration warnings and LCP regressions if it's a Server Component. It must stay 'use client' and be lazy-loaded with dynamic(() => ..., { ssr: false }).
*   **Hero gradient animation:** HeroSection.tsx uses inline @keyframes via a <style jsx> tag which is not supported without the styled-jsx package in App Router. Move those keyframes to globals.css.
*   **BotPreview and InlineBotPreview duplication:** There are two near-identical chat preview components — one in BotPreview.tsx and one inlined in demo/customize/page.tsx. Consolidate before the image optimization pass or you'll optimize one and miss the other.
*   **Background images as style props:** Several components (ServicesClient, PricingClient, AboutClient) use backgroundImage inline styles pointing to .webp files. These bypass next/image entirely. Use CSS custom properties or move hero backgrounds to next/image with fill and objectFit for proper LCP optimization.

---

## Phase 4: Hardening the Demo System
Your existing items are correct. Additions:

*   **pdfjsLib global check:** demoRag.ts checks window.pdfjsLib and window.XLSX as globals. This pattern is fragile — if the scripts haven't loaded yet, parsing silently falls back to raw text. The dynamic import refactor should replace these global checks with proper module-level awaits.
*   **sessionStorage key collision:** Both src/lib/demo/demoStorage.ts and src/lib/demoStorage.ts (the duplicate you're deleting) use identical keys like demo_bot_config. Before deleting the duplicate, audit that no component still imports from the root-level version — a stale import would silently write to the same key and corrupt demo state.
*   **Demo chat page redirect race:** demo/chat/page.tsx calls router.replace('/demo/train') inside a useEffect if not trained, but also renders null while mounted is false. The brief render-before-redirect can cause a flash. Add a Suspense boundary or loading.tsx for the demo route group.
*   **DEMO_MSG_CAP is exported from two places:** Both src/lib/demo/demoRag.ts and src/lib/demoRag.ts export it. After deleting the duplicate, grep for all import sites to ensure none are left pointing to the deleted file.

---

## Phase 5: SaaS Engine & Conversion Funnel
Your existing items are correct. Additions:

*   **UpgradeError class portability:** UpgradeError is defined in useAuthenticatedFetch.ts but caught in TrainPage, BotsPage, and RegisterPage. When you restructure providers, ensure this class remains importable from a shared utilities path rather than a hook file.
*   **Polar redirect loop risk:** DashboardPricing and RegisterPage both watch searchParams.get('payment') === 'success' and redirect. If the sync call fails and the user refreshes, they re-trigger the sync. Add a sessionStorage flag (e.g., sb_sync_attempted) to prevent repeated sync attempts on the same payment return.
*   **useInactivityTimeout:** This hook in src/lib/hooks/useInactivityTimeout.ts attaches multiple window event listeners on every render. It needs a useCallback dependency audit to prevent listener accumulation, especially before the provider refactor changes when it mounts.
*   **Admin route server-side gate gap:** dashboard/settings/admin/layout.tsx performs a server-side fetch to /api/me to verify SUPER_ADMIN role. If NEXT_PUBLIC_API_URL is undefined in the build environment, this fetch silently fails and falls through to a redirect — not an error. Add an explicit environment variable check at build time.

---

**Note:** The most critical additions are the embed route isolation preservation, the sessionStorage key collision audit, and the Polar redirect loop prevention — these are the most likely to cause silent data corruption or broken user flows during migration.