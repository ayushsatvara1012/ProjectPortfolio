# Typography readability fix plan

## Problem

User-reported: text feels "thin" and "too small" in several places, in both light and dark theme, straining the eye.

## Root causes (confirmed via code audit, not guesswork)

1. **Global mobile font shrink** - `src/app/globals.css:45-57` sets `html { font-size: 14px }` on mobile
   (bumped to 16px only at `md:` / 768px+).
   Since all Tailwind `text-*` classes are `rem`-based, this silently scales every text size
   down ~12.5% on every screen under 768px (most traffic).
   `text-sm` renders at 12.25px instead of 14px, `text-xs` at 10.5px instead of 12px.
2. **Body text has no explicit weight, defaulting to regular (400)** - `src/app/globals.css:69`
   `body { @apply font-sans ... text-slate-500 dark:text-slate-400; }` sets color but never
   sets a weight, so every paragraph inherits the browser/font default of 400.
   Colors (`slate-500`/`slate-400`) are staying as-is per user instruction - this is scoped
   to weight/size only, not contrast/color. The "thin" complaint in both themes is a
   font-weight problem, not a contrast problem:
   - In dark mode specifically, regular-weight (400) light text on a near-black background
     suffers halation/irradiation - a real optical effect where thin strokes on dark
     backgrounds look even thinner/blurrier than the same weight does on a light background.
     The fix for this is a slightly heavier weight, not a color/contrast change.
   - In light mode, regular (400) at small sizes (13-14px effective, see #1) reads as faint
     purely because the stroke width is thin relative to the size - again a weight fix,
     not a color fix.
3. **No real type scale** - `tailwind.config.js` has no custom `fontSize`/`fontWeight` theme.
   Every heading/body/caption size and weight is hand-picked per component, so the same
   semantic role (H2, card title, caption) uses 3-5 different size/weight combos across
   the codebase (see prior audit in conversation - Services.tsx, WhatWeSolve.tsx,
   EngineSection.tsx, ProjectSection.tsx, dashboard BotsClient.tsx/admin/page.tsx/database/page.tsx).
4. **Thin weight at small sizes** - `font-light` used at 12px in
   `src/app/(app)/(site)/about/components.tsx:80,85,91,96` - worst-case combo (small + thin).
5. **Arbitrary pixel sizes bypassing the scale** - dashboard uses `text-[15px]`, `text-[18px]`,
   `text-[12.5px]`, `text-[13px]` (e.g. `BotsClient.tsx`, `register/page.tsx:74`) instead of
   standard Tailwind steps, so there's no consistent floor.

## Reference pattern (how Gemini/Claude/ChatGPT handle this)

- Base message/body text: 16px, weight 400-450, never below ~15px.
- Muted/secondary text: max one perceptual step down from primary text color
  (keeps contrast >= 7:1), never a 400-point color gap.
- Dark mode text color: off-white rather than pure white, weight unchanged or +25,
  never lighter - avoids halation glare while keeping strokes visually full.
- Headings: weight 600 (semibold) typically, rarely 500-, rarely 700+.
- Caption/small text floor: never below 13-14px, never paired with weight below 400.

## Fix plan

### Phase 1 - Root cause CSS (highest impact, lowest risk, font-only)
- Remove or raise the 14px mobile root font-size in `globals.css` (target: 16px baseline,
  or 15px minimum if a deliberate density reason exists - to be confirmed before implementing).
  Size only - no color change.
- Give `body` an explicit weight in `globals.css` (e.g. 425-450 instead of the inherited 400)
  to fix the halation/thin-stroke perception in dark mode and the faint-at-small-size
  perception in light mode. Weight only - `text-slate-500`/`dark:text-slate-400` stay
  exactly as they are, no color/contrast changes anywhere in this plan.
- Remove `font-light` usage in `about/components.tsx:80-96` (weight only, size at those
  lines stays `text-[12px]` unless it's independently flagged as too small in review).

### Phase 2 - Real type scale
- Add `fontSize` scale to `tailwind.config.js` with paired `lineHeight` and a documented
  default weight per token (e.g. `h1`, `h2`, `h3`, `body`, `caption`), so semantic roles
  become lookups instead of hand-picked per file.
- Set a weight floor rule: no `text-xs`/`text-sm` role may use `font-light`/`font-normal`;
  minimum `font-medium` (500) at small sizes.

### Phase 3 - Sweep and normalize (size/weight only)
- Marketing: collapse H2 to one size/weight combo (currently 4 variants across
  Services/WhatWeSolve/HowItWorks/EngineSection/ProjectSection/PricingPreview/NewSection/Testimonials).
- Dashboard: replace arbitrary `text-[Npx]` values with new scale tokens across
  `BotsClient.tsx`, `admin/page.tsx`, `database/page.tsx`, `register/page.tsx`, `account/page.tsx`.
- Re-check readability in both themes after the sweep (manual spot check + browser preview,
  light and dark) - checking for size/weight regressions only, not auditing or adjusting
  any color tokens.

## Explicitly out of scope

- No `text-{color}-*` class changes anywhere (light or dark mode).
- No changes to `--color-*` tokens in `globals.css` `@theme` block.
- No changes to background colors, borders, or any non-typography visual property.
- Font family stays Plus Jakarta Sans throughout - only `font-size`/`line-height`/
  `font-weight` are in scope for this plan.

## Status

Plan only - no code changes made yet.
User chose "plan doc first, review before implementing."

## Next

Review this plan with user, get sign-off, then implement Phase 1 -> 2 -> 3 in that order
(each phase should leave the suite green and be visually verified in the browser preview,
light + dark mode).
