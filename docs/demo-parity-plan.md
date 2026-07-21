# Demo section parity with live dashboard

## Problem

The public demo (`src/app/(app)/demo/*`) is a self-contained clone of the dashboard running on
`sessionStorage` + a mock backend (`src/lib/demo/mockBackend.ts`, `demoStorage.ts`, `demoRag.ts`).
It drifts out of sync every time a real dashboard page gains a feature, so prospects see a stale
experience that does not match what they get after signing up.

## Goal

Bring the three main demo surfaces (Train AI, Insights, My Bots) up to parity with the live
dashboard, mocking any backend the new UI needs so the demo stays server-free.

## Confirmed scope (2026-07-20)

- Update Train AI, Insights, and My Bots + shell.
- Mock the responses for backend-dependent features (crawl discovery, AI insights report),
  not just disabled UI.

## Gap analysis (source of truth)

### Train AI (`demo/train/page.tsx` vs `dashboard/train/page.tsx`)

- Missing multi-page crawl discovery ("Find more pages" + candidate checklist + filter + word estimate)
  shipped in PR #113 (2026-07-20).
- Stacked layout instead of side-by-side Add/Manage grid (`lg:grid-cols-[7fr_5fr]`).
- Click-only dropzones (no drag-and-drop).
- Synchronous training instead of async job + progress bar ("Training... X/Y").
- No storage-used footer under the form.
- "AI memory" KPI shows segments; real shows lifetime messages.
- Bug: demo `SourceBrowser` reads `localStorage['vaayu_demo_knowledge']` while the page writes
  `sessionStorage['demo_knowledge_chunks']`, so Manage knowledge always renders empty.

### Insights (`demo/insights/page.tsx` vs `dashboard/insights/page.tsx`)

- AI insights report block entirely missing (30-day heatmap `ActivityInsights`, top trends,
  recommended action). Real renders it on the Funnel tab from `reportData`.
- No `RequestsInboxPanel` on the Sales tab.
- No ghost-town / error / "generate your insights" empty states.
- Capped at `max-w-6xl` centered; real is full-width.

### My Bots (`demo/bots/page.tsx` vs `dashboard/bots/BotsClient.tsx`)

- Close match already. Intentional demo divergences (locked "add" slot, chat button vs delete)
  are acceptable. Minor polish only.

## Implementation phases

### Phase 1 - Train AI parity
1. Fix the storage-key mismatch so the demo SourceBrowser reads real demo knowledge.
2. Rework layout to side-by-side Add/Manage grid.
3. Add drag-and-drop to PDF/CSV dropzones (port `dropHandlers` / `dropzoneCls`).
4. Add "Find more pages" crawl discovery UI backed by a mock `/api/train/discover`.
5. Simulate async training progress (client-side job with progress bar).
6. Add storage-used footer; fix "AI memory" KPI to lifetime messages framing.

### Phase 2 - Insights parity
1. Drop `max-w-6xl`, go full-width to match the real layout.
2. Port the `ActivityInsights` report block (heatmap + trends + recommended action) driven by
   `buildDemoReport` on the Funnel tab, with generating/empty states.

### Phase 3 - My Bots + shell polish
1. Align bot-card details and nav labels where cheap; keep intentional demo affordances.

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run test` green.
- Manual: walk `/demo/train` (discover, drag-drop, train, manage) and `/demo/insights`
  (all three tabs, generate insights) in the browser preview, light + dark.

## Status

See memory `demo-parity-plan.md`.
