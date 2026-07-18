# Homepage redesign — "warm editorial" (Vaayu)

## Goal
Rebuild the marketing homepage (`src/app/(app)/(site)/page.tsx`) in the Claude-Console / Chatbase
editorial language: warm ivory ground + cobalt accent, generous whitespace, product-moment cards,
and a real BI-console showcase. Low density, "big AI company" restraint. Approved via mockup
(3 iterations) before this build.

## Locked design decisions (from the user)
- Palette: **warm cream + cobalt accent**. Cobalt = `#004DE8` (light) / `#6E97FF` (dark). Paper
  `#FAF9F5` / `#14130E`. Ink `#1A1914` / `#F5F3EB`.
- Type: **keep Plus Jakarta Sans** (`font-google`) — no serif. Warmth comes from palette + space + doodles.
- Feature cards: **3 pillars** (grounded answers, lead capture+scoring, ROI) + **owner tools**
  (Slack/email hot-lead handoff) + **advanced** (chemical vertical pack + BYOD Postgres).
- Integrations row: **real only** — embed platforms (Next.js, React, WordPress, Shopify, Webflow, HTML)
  + Slack, WhatsApp, Webhooks. No invented logos; monochrome glyphs.
- Content grounded strictly in real Vaayu features. Pricing from canonical `PLANS`/`PRICE_MATRIX`.

## Conventions honored
- Tailwind 4 + `dark:` variants + arbitrary hex (matches existing components, e.g. FeatureCardsSection).
- Class-based dark mode (`.dark`). `font-google`. Shared fixed `Navbar` (transparent over hero) + `Footer`.
- Server Components by default; `'use client'` only for the copy-embed button.
- No framer-motion on the homepage sections (perf: keep hero LCP + bundle lean).

## Components (new, under `src/components/marketing/home/`)
- `HomeHero.tsx` — centered hero, hand-drawn doodle, cobalt-tinted showcase panel w/ dark chat console.
- `FeatureGrid.tsx` — 2 big + 3 small product-moment cards (grounded answer, scored lead, ROI, Slack/email handoff, vertical pack + BYOD).
- `ConsoleShowcase.tsx` — big split: dark BI-console panel (revenue + funnel) + short copy.
- `InstallStrip.tsx` + `CopyEmbed.tsx` — one-line embed snippet with copy button (client).
- `IntegrationsRow.tsx` — real-only chip row.
- `HomeMetrics.tsx` — 4 static stats (24/7, <5 min, 1 line, $0).
- `HomePricing.tsx` — Explore Free + Starter/Growth/Scale from canonical data, warm-styled.
- `FinalCTA.tsx` — calm closing CTA + doodle.

## Wiring
`page.tsx` composes the new sections in place of Hero/FeatureCards/WhatWeSolve/ScrollTravel/Testimonials/PricingPreview.
Old components stay on disk (unused) for easy revert. JSON-LD (product + FAQ) preserved.

## Verify
`npx tsc --noEmit`, `npm run lint`, `npm run test`, and drive the page in the dev server (light + dark, mobile + desktop).

## Status
BUILT locally, UNCOMMITTED (per user: do not commit/push until told). Mockup artifact:
claude.ai/code/artifact/b6f323b3-63c8-40b0-84ff-bc08c04c52a1
