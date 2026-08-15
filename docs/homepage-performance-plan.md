# Homepage Performance Plan - Hero + ChatbotShowcase

Companion to `docs/homepage-performance-audit.md`, which holds the findings, the measurements and the rejected ideas.
This document holds the rules, the phase order, and the test strategy.

Scope: sections 1 and 2 of `src/app/(app)/(site)/page.tsx` only.
Goal: cut ~3.4 MB of above-the-fold transfer and stop a permanent 60 fps main-thread loop, **without moving a single visible pixel**.

---

## 1. The rules

These govern every change in this plan.
A change that cannot satisfy Rule 1 does not ship, regardless of what it saves.

**R1 - Pixel-perfect is the acceptance bar, not an aspiration.**
Every fix is classified before it is written:

| Class | Definition | Evidence required |
|---|---|---|
| **A** | Cannot alter output pixels (paint order, cached values, dead code, non-mounted elements) | Argument in the plan + green visual regression |
| **B** | Alters pixels below the perceptual threshold | Numeric delta measured and recorded + green visual regression at tolerance 0 |
| **C** | Alters visible pixels | **Rejected.** Logged in the audit with the reason. |

**R2 - Baselines are captured before the first line of production code changes.**
The visual-regression baselines are the only proof we have that R1 held.
Captured after a fix, they prove nothing. Phase 0 exists solely for this.

**R3 - One fix per commit, and the visual suite runs green on every commit.**
If a diff appears, the bisect must land on one change. Batched fixes make a pixel regression unattributable.

**R4 - Bit-exactness is proved in vitest before it is trusted in the browser.**
For the canvas geometry work (Phase 6) the old and new implementations must produce byte-identical facet ordering and corner heights across an angle sweep.
Screenshots can hide a 1-in-768 ordering bug; an array comparison cannot.

**R5 - The two known traps are tested explicitly, not just avoided.**
Sort-tie ordering and LUT float accumulation each get a dedicated failing-first test. See §5.3.

**R6 - No new visual dependencies, no new runtime dependencies.**
`svgo` is already a devDependency. Playwright is test-only. Nothing is added to the client bundle.

**R7 - The E2E harness never touches the user's dev server or `.next/` cache.**
Separate port, separate build directory. See §4.1.

**R8 - Screenshot baselines are platform-specific.**
Baselines generated on macOS will not match Linux CI. Either pin CI to the official Playwright container and regenerate there, or run the visual suite on one machine only. Decide before Phase 0 (see Open Questions).

---

## 2. Phase order

Phase 0 is a hard gate. Phases 1-7 are independent of each other and can be reordered or dropped individually.

| Phase | Change | Class | Audit ref |
|---|---|---|---|
| **0** | **E2E harness + baseline capture** | - | §4 |
| 1 | `image 1.svg` -> WebP q90 1920w | B | P0-1 |
| 2 | Move `backdrop-filter` to a static sibling div | A | P0-2 |
| 3 | Cache `targetScrollY`; suspend rAF once settled | A | P0-3 |
| 4 | Gate canvas mount on `>=640px`; reduced-motion draws once | A | P0-4 |
| 5 | SVGO precision 4 on both chat SVGs + lazy/async | B | P1-1 |
| 6 | Facet reuse, height LUT, offscreen sky, drop no-op stroke | A | P1-2, P1-3 |
| 7 | Delete unused assets + dead import | A | P2-1, P2-2, P2-3 |

Recommended shipping order: **0 -> 1 -> 2 -> 5 -> 7 -> 3 -> 4 -> 6.**
That front-loads the byte wins (cheap, independently verifiable) and leaves the render-logic rewrite last, when the harness has been exercised.

---

## 3. Per-phase specification

### Phase 1 - Wash asset

- Extract the base64 PNG from `public/image 1.svg` (1920x1446 RGB).
- Encode `cwebp -q 90` at native width -> `public/hero-wash.webp` (~128 KB).
- Replace the `bg-[url('/image%201.svg')]` at `page.tsx:138` **and** `HeroSection.tsx:23`.
- Prefer `next/image` with `fill` + `quality={90}`; if the CSS-background layering is load-bearing, a plain `.webp` `url()` is acceptable and still gets the 95% saving.
- Do **not** delete `public/image 1.svg` in this phase - Phase 7 removes it once the visual suite is green.
- Recorded delta: maxΔ 0.40/255 under the live pipeline, 1.60/255 worst case. See audit P0-1.

### Phase 2 - Static backdrop-filter sibling

Restructure the sticky container at `page.tsx:135`:

```
sticky container (bg-slate-950 = backdrop root)
├─ wash div                                    (static, unchanged)
├─ NEW  absolute inset-0 backdrop-blur-xl saturate-150   (static, no content)
└─ HeroHorizonField      ← drop backdrop-blur-xl saturate-150 from HeroHorizonCanvas.tsx:266
```

Paint order is unchanged - `filtered(wash over slate-950)` then canvas content, before and after.
Both elements are `absolute inset-0` on the same box, so the sampled region is identical.
Confirmed the hero text is a later `z-10` sibling and was never part of the backdrop.

### Phase 3 - Scroll loop

- Move the `targetScrollY` computation into `handleResize` and cache it. It is scroll-invariant (`chatbotsRect.top + scrollY` cancels), so the scroll handler becomes pure arithmetic on `window.scrollY` with **zero layout reads**.
- Cache `rect.width`/`rect.height` in `handleResize`; stop calling `getBoundingClientRect()` inside `draw()`.
- Start rAF from the scroll handler; `cancelAnimationFrame` and null the handle when `Math.abs(target - current) <= 0.0001`.
- Keep the lerp factor at `0.08` and the threshold at `0.0001` - the converged frame must be bit-identical.
- No IntersectionObserver. The target clamps past ChatbotShowcase, so the loop self-suspends; an observer would only add a resume path that has to choose between snapping and re-lerping.

### Phase 4 - Mount gating

- In `HeroHorizonField`, gate on `matchMedia('(min-width: 640px)')` with a `change` listener so crossing the breakpoint mounts the canvas.
- Load `HeroHorizonCanvas` via `next/dynamic` with `ssr: false`.
- `prefers-reduced-motion`: **draw once at angle 0, then do not loop.** The static terrain must still be visible - the current behavior renders it, and blanking it would be a regression, not an optimization.

### Phase 5 - Chat SVGs

- `svgo --precision 4` on `public/generic_chat.svg` and `public/chemical_chat.svg`.
- Gzipped transfer 214 KB -> 64 KB (-70%). Geometry shifts by at most 0.0001 units in a 300-unit viewBox = 0.00013 px at display size.
- Add `loading="lazy"` and `decoding="async"` to both `<img>` tags in `ChatbotShowcase.tsx`.
- Keep them as SVG. Rasterizing was measured and rejected - see audit P1-1.
- Commit the optimized files, and keep the originals in git history rather than a `.orig` file.

### Phase 6 - Canvas hot path

Prerequisite: **extract the pure geometry out of the `useEffect` closure** into `src/components/marketing/heroTerrain.ts` - `terrainHeight`, `projectRotated`, and the facet-ordering function.
Nothing in the render changes in this step; it exists so §5.3 can test the functions directly.

Then:
- Build the facet array once. Re-seed the index array in canonical order (v descending, u ascending) every frame **or** tie-break the comparator on original index. At angle 0 every facet in a row shares a byte-identical sort key, and stable-sort order decides which `destination-out` erase wins on overlap.
- Precompute corner heights into a LUT keyed by grid index, populated with the *same* float accumulation the loops use (`u + U_STEP`, `v - V_STEP` from the same constants) so the doubles are bit-identical.
- Render the galaxy sky once into an `OffscreenCanvas` at resize time; `drawImage()` it per frame.
- Delete the `strokeStyle = 'transparent'` + `ctx.stroke()` pair and the now-dead `alpha`/`depthAlpha`/`textClearance` computation that only guarded it.
- **Do not** collapse the `destination-out` erase into the fill. It punches to transparent so the wash shows through; a single fill would composite onto the sky. Rejected in audit P1-2.

### Phase 7 - Cleanup

- Delete `public/new_brand.svg` (2.79 MB), `public/Vector(Stroke).svg` (3.46 MB), `public/hero_bg.svg` (310 KB), and `public/image 1.svg` once Phase 1 is green.
- Confirm with `grep -r` across the whole repo, not just `src/` - docs and email templates can reference `public/`.
- Remove the unused `ChatbotShowcaseOrnament` import at `ChatbotShowcase.tsx:2`. Confirm the omission was deliberate first; if the ornament was meant to render, that is a visual change and a separate decision.

---

## 4. E2E UI test harness

### 4.1 Setup

Add `@playwright/test` as a devDependency. Test-only, nothing enters the client bundle.

`playwright.config.ts`:

- `testDir: 'e2e'`
- `webServer`: `next build && next start -p 3100`, with `NEXT_DIST_DIR=.next-e2e` so the production build never touches the `.next/` cache the user's dev server on :3000 owns (R7). This requires `distDir: process.env.NEXT_DIST_DIR || '.next'` in `next.config.mjs` - a one-line change, and the only production-config edit in this plan.
- Add `.next-e2e/` to `.gitignore`.
- Projects: `desktop` (1440x900, DPR 1), `desktop-hidpi` (1440x900, DPR 2), `mobile` (390x844, DPR 3).
- `expect.toHaveScreenshot`: `maxDiffPixels: 0`, `animations: 'disabled'`.

Scripts: `test:e2e`, `test:e2e:update`.

### 4.2 Determinism

The canvas animates, so a naive screenshot is flaky. Three mechanisms:

1. **Settle-wait helper.** Poll `canvas.toDataURL()` and resolve once two consecutive samples are identical, with a timeout. This needs no production test hook and works before *and* after the Phase 3 rAF change.
2. **Font gate.** `await document.fonts.ready` before every screenshot - Plus Jakarta Sans and Newsreader shift text metrics if unloaded.
3. **Fixed scroll positions.** Scroll by absolute pixel offsets, never by element or by wheel events.

### 4.3 Test files

```
e2e/
├── helpers/settle.ts              # canvas-stable + fonts-ready helpers
├── homepage-visual.spec.ts        # R1 gate - the pixel-perfect proof
├── homepage-behavior.spec.ts      # loop suspension, mount gating, a11y
└── homepage-budget.spec.ts        # asset-size regression guards
```

**`homepage-visual.spec.ts`** - the acceptance gate. One `toHaveScreenshot` per state, `maxDiffPixels: 0`:

| Case | State |
|---|---|
| hero-top | scrollY 0 |
| hero-mid-rotation | scrollY = 0.5 x targetScrollY (mid-lerp, settled) |
| hero-settled | scrolled past ChatbotShowcase, angle clamped to max |
| chatbot-showcase | section 2 in view |
| mobile-hero | 390x844, canvas absent by design |
| reduced-motion | `prefers-reduced-motion: reduce`, terrain must render at angle 0 |
| hidpi-hero | DPR 2, guards the `Math.min(dpr, 2)` path |

Run across light and dark where the sections differ.

**`homepage-behavior.spec.ts`** - asserts the performance claims rather than trusting them:

- **rAF suspends when settled** (Phase 3): instrument `requestAnimationFrame` via `addInitScript`, scroll, wait for settle, then assert the frame count stops rising over 1 s. This is the test that would have caught the original always-on loop.
- **No forced layout during scroll** (Phase 3): wrap `getBoundingClientRect` with a counter in `addInitScript`; assert the delta across a scroll burst is 0 on the canvas element.
- **Canvas not mounted below 640px** (Phase 4): assert `canvas.horizon-canvas` has zero matches at 390px wide, and that it appears after resizing to 900px.
- **Reduced-motion still paints** (Phase 4): assert the canvas is non-blank (sample `toDataURL` and check it is not a uniform transparent buffer). Guards the exact bug that was in the first draft of the audit.
- **Chat images lazy** (Phase 5): assert `loading="lazy"` and `decoding="async"` on both, and that they are still in the DOM and rendered on first paint.
- **Accessibility unchanged**: canvas keeps `aria-hidden="true"`, both chat panels keep their `sr-only` descriptions.

**`homepage-budget.spec.ts`** - stops the regression from coming back:

- Capture all responses for `/` via `page.on('response')`.
- Assert the hero wash transfers `< 200 KB` (was 2.79 MB).
- Assert each chat SVG transfers `< 45 KB` gzipped (was ~114 KB / ~100 KB).
- Assert total above-the-fold image bytes `< 400 KB`.
- Assert `image 1.svg`, `new_brand.svg`, `Vector(Stroke).svg` return 404 after Phase 7.

### 4.4 Vitest additions (no browser)

`src/components/marketing/__tests__/heroTerrain.test.ts`, enabled by the Phase 6 extraction:

- **Facet ordering is bit-identical** across an angle sweep (0 -> 0.42 rad in 100 steps) between a reference implementation that rebuilds+re-sorts and the optimized reuse path. Direct array comparison, R4.
- **Sort-tie ordering at angle 0** (R5, trap 1): assert that all 32 facets in a row share a sort key *and* that the emitted order is v-descending, u-ascending. A dedicated test because this is invisible to screenshots at most angles.
- **LUT float accumulation** (R5, trap 2): assert `Object.is` equality - not `toBeCloseTo` - between LUT values and the accumulated-loop values. `toBeCloseTo` would pass on exactly the drift this test exists to catch.
- **Sky generation determinism**: `generateGalaxySky(1337, ...)` returns identical output across calls, and the offscreen-rendered sky matches a direct draw.

### 4.5 The Phase 0 procedure

1. Land the harness with **zero production changes** except the one-line `distDir` in `next.config.mjs`.
2. Run `npm run test:e2e:update` on the current `updated/homepage-v1` HEAD.
3. Commit the baselines. This commit is the reference for the entire plan (R2).
4. Every subsequent phase runs `npm run test:e2e` and must be green with `maxDiffPixels: 0`.
5. For the two Class B phases (1 and 5), a diff is *expected* to be zero at the pixel level despite the sub-threshold encoding delta. If it is not, the phase is wrong - do not update the baseline to make it pass. Updating a baseline to accommodate a fix defeats the entire mechanism.

---

## 5. Definition of done

Per phase:
- `npx tsc --noEmit` clean, `npm run lint` zero errors, `npm run test` green.
- `npm run test:e2e` green at `maxDiffPixels: 0`.
- One commit, one fix (R3).

Whole plan:
- Above-the-fold transfer down from ~3.4 MB to under 400 KB.
- Performance trace over a hero -> ChatbotShowcase scroll at 4x CPU throttle: no long tasks > 50 ms, no forced-reflow warnings.
- Lighthouse mobile: LCP < 2.5 s, CLS < 0.1, TBT < 200 ms.
- Zero visual diffs against the Phase 0 baselines.

---

## 6. Open questions

1. **Baseline platform (R8)** - run the visual suite on macOS only, or pin CI to the official Playwright Docker image and generate baselines there? The second is more work now and the only option that survives CI adoption.
2. **`next/image` vs CSS background for the wash** - `next/image` adds AVIF and responsive sizing on top of the 95% saving, but the wash is a layered CSS background and the swap is slightly more invasive. Plain `.webp url()` is the low-risk option.
3. **Phase 6 scope** - it is the only render-logic rewrite. It can be deferred indefinitely; Phases 1-5 and 7 deliver the byte savings and the scroll-jank fix without it.
4. **`ChatbotShowcaseOrnament`** - was leaving it unrendered deliberate? If it was meant to be visible, that is a design change outside this plan.

---

## 7. Status

**PLAN ONLY** - 2026-08-15. Nothing built. Audit complete and re-verified against the pixel-perfect constraint.
Next action: answer the open questions, then Phase 0.
