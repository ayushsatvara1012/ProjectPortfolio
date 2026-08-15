# Homepage Performance Audit - Hero + ChatbotShowcase

Scope: `src/app/(app)/(site)/page.tsx` sections 1 and 2 only.
Files audited: `HeroSection.tsx`, `HeroHorizonField.tsx`, `HeroHorizonCanvas.tsx`, `heroSky.ts`, `home/ChatbotShowcase.tsx`, `ChatbotShowcaseOrnament.tsx`, plus the `public/` assets they reference.

**Constraint: the rendered result must be pixel-identical to today.**
Every recommendation below is classified against that bar:

| Class | Meaning |
|---|---|
| **A** | Identical by construction - the change cannot alter output pixels |
| **B** | Measured delta below the perceptual threshold, numbers given |
| **C** | Changes pixels - **rejected**, listed only so the reasoning is on record |

Nothing in the accepted set is a visual trade.
Where the fast option cost quality, the report takes the slower option and says what it costs.

---

## P0 - Critical

### P0-1. `/image 1.svg` is a 2.79 MB PNG wearing an SVG costume - Class B

`public/image 1.svg` is a 1920x1446 SVG whose entire body is one `<image>` tag holding a base64 PNG.
Base64 inflates it ~33% and it gzips to 2.1 MB (already-compressed PNG bytes do not re-compress).
As a CSS `url()` it bypasses `next/image`, so it gets no AVIF/WebP conversion and no responsive sizing.

Referenced at `page.tsx:138` (sticky wash behind both sections) and `HeroSection.tsx:23` (dead on the homepage - `hideWash` is passed - but live for any other consumer).

**Verification method.** I extracted the PNG, re-encoded it at several settings, and pushed each candidate through the *actual* render pipeline in Python - `bg-cover` into a 1920x1080 box, `scale(1.15)`, the CSS blur, then `opacity: 0.4` composited over `#020617` - then measured per-channel delta against the original on the final composited pixel (0-255 scale):

| Variant | Bytes | maxΔ / meanΔ (3.45px blur) | maxΔ / meanΔ (24.25px blur) |
|---|---|---|---|
| current SVG | 2,794,504 | reference | reference |
| lossless WebP | 1,235,552 | **0.00** / 0.000 | **0.00** / 0.000 |
| **q90 / 1920w** | **128,412** | **1.60** / 0.148 | 0.40 / 0.049 |
| q80 / 1920w | 84,282 | 2.40 / 0.205 | 0.80 / 0.060 |
| q70 / 1280w | 31,624 | 5.20 / 0.412 | 0.80 / 0.098 |
| q60 / 960w | 17,070 | 8.00 / 0.554 | 1.20 / 0.138 |

Two blur columns because the effective blur depends on whether P0-2 keeps the canvas's `backdrop-blur-xl`.
It does (see below), so the right-hand column is the operative one - but the left column is what you get if that filter is ever removed, so the pick should survive both.

**Correction to my first report.** I recommended q60/960w at 17 KB.
Under the 24px blur that is genuinely invisible (maxΔ 1.2), but at 3.45px it reaches **maxΔ 8/255**, which can band in smooth gradients. It was the wrong call for a pixel-perfect bar.

**Fix:** **WebP q90 at native 1920w - 128 KB, -95.4%.**
Worst-case delta is 1.6/255 on a single channel, under the ~2 LSB threshold where 8-bit dithering noise lives, and 0.4/255 in the actual pipeline. Serve through `next/image` (`fill`, `quality={90}`) or as a plain `.webp` background.
If you want literally zero delta, lossless WebP is 1.24 MB (-56%) - still a real win, but I would not spend 1.1 MB on a difference no display can resolve.

### P0-2. The full-viewport `backdrop-filter` sits on the one element that repaints every frame - Class A

`HeroHorizonCanvas.tsx:266` carries `backdrop-blur-xl saturate-150`.
`backdrop-filter` makes the compositor snapshot, blur (24px Gaussian) and saturate everything painted beneath the element - a full 100vh x 100vw layer.
Because the *canvas contents change every scroll frame*, that backdrop cannot be cached; it is re-derived per frame. This is the largest GPU cost on the page.

**Correction to my first report.** I said "delete `backdrop-blur-xl saturate-150` and bake it into the layer beneath."
That is wrong twice over. Deleting it changes pixels outright (`saturate-150` is a substantial color shift). And baking it into the asset does not work either: the 24px radius is in *screen* space (constant at every viewport width) while a baked-in radius lives in *image* space and scales with viewport width - so the two can only agree at one specific window size.

**Fix that is identical by construction:** move the filter off the canvas onto a **static sibling** sitting between the wash and the canvas:

```
sticky container (backdrop root: bg-slate-950)
├─ wash div            (static)
├─ NEW static div      ← absolute inset-0, backdrop-blur-xl saturate-150, no content
└─ HeroHorizonCanvas   ← filter classes removed
```

Paint order is unchanged: currently the browser paints `filtered(wash over slate-950)` and then the canvas content over it; afterwards it paints exactly the same two things in the same order.
The filtered backdrop is clipped to the element's border box, not to content alpha, and both elements are `absolute inset-0` on the same box - so the sampled region is identical too.

I confirmed the backdrop root is what I assumed: the hero text lives in a later sibling with `z-10`, so it is painted *after* the canvas and was never part of the backdrop. Only `bg-slate-950` + the wash are.

The win is that the filter element is now static, so the compositor caches the blurred layer once instead of re-deriving it 60x/second.
Same pixels, one blur instead of thousands.

### P0-3. The render loop never idles and thrashes layout every frame - Class A

`renderLoop()` calls `requestAnimationFrame` unconditionally, forever, and runs `updateScrollProgress()` every tick: two `getElementById` lookups plus a `getBoundingClientRect()` - a forced synchronous layout - 60x/second, permanently, even when the hero is far off screen and the angle has long settled.
`draw()` adds a third `getBoundingClientRect()` per painted frame.
`updateScrollProgress` is *also* bound to `scroll`, so it runs twice per frame while scrolling.

**Key observation:** `targetScrollY` is `chatbotsRect.top + scrollY - vh * 0.20` - the `+ scrollY` cancels the rect's scroll dependence, so **this value does not change while scrolling**. It only changes on resize/reflow. Today it is recomputed 60x/second to produce the same number.

**Fix (all Class A):**
- Compute and cache `targetScrollY` in `handleResize`. The scroll handler then becomes pure arithmetic on `window.scrollY` - **zero layout reads during scroll**.
- Start rAF from the scroll handler; `cancelAnimationFrame` and null the handle once `|target - current| <= 0.0001`. The final frame is bit-identical - it is the same lerp, just not re-running after it has converged.
- Cache `rect.width`/`rect.height` from `handleResize` instead of re-measuring inside `draw()`.

**I dropped the IntersectionObserver I originally proposed.** Checking the math: once you scroll past ChatbotShowcase, `progress` clamps to 1 and the target goes constant, so the loop converges and the suspension above already stops it. The observer would add a resume path that has to choose between snapping (visibly different after a fast scroll away and back) and re-lerping. It bought nothing and risked pixels.

### P0-4. The canvas mounts and runs on mobile, where it is invisible - Class A

`page.tsx:135` hides the layer with `hidden sm:block`, but `HeroHorizonField` still mounts, still ships its JS, still generates the 220-star sky, and still runs the permanent rAF loop.
`draw()` early-returns on a zero-size rect so nothing paints - but the per-frame `getElementById` + `getBoundingClientRect` cost is paid in full, on the devices least able to afford it.

**Fix:** gate the mount on `matchMedia('(min-width: 640px)')` inside `HeroHorizonField` (with a `change` listener so crossing the breakpoint mounts it), and load the canvas via `next/dynamic` with `ssr: false`.
Below 640px the element renders nothing today, so not mounting it is identical by construction.

**Correction to my first report.** I wrote that `prefers-reduced-motion` should "skip the loop entirely."
That is a bug: reduced-motion users currently still see the static terrain at angle 0 - skipping the loop would leave them a blank canvas. The correct behavior is **draw once at angle 0, then do not loop.**

---

## P1 - High

### P1-1. 618 KB of chat mockup SVGs - Class B, and my original fix is withdrawn

`ChatbotShowcase.tsx:40,58` load `/generic_chat.svg` (330 KB, 421 paths, 2 `<feGaussianBlur>`) and `/chemical_chat.svg` (288 KB, 330 paths) as plain `<img>` with no loading hints.

**Correction to my first report - this is the one that would have cost you real quality.** I recommended rasterizing both to 2x WebP.
That is wrong. These are UI mockups full of text and hairlines, authored at 300x400 and displayed at ~380 CSS px. On a DPR-3 phone that is ~1140 device pixels; an 840px raster would be *upscaled*, visibly softening text that is currently resolution-independent. Vector stays crisp at every DPR. **Do not rasterize these.**

The correct fix is SVGO, which is a far bigger win anyway. Measured, gzipped transfer:

| | current | SVGO p4 | SVGO p3 |
|---|---|---|---|
| generic_chat | 114,093 | **32,252** | 20,136 |
| chemical_chat | 100,163 | **32,145** | 21,765 |

I also tested an SVGO config with all path rewriting disabled (metadata/whitespace only): it saved **3 bytes**. These files are pure path data, so every byte of the gain comes from coordinate precision - there is no free lossless tier here.

Rendered both at 1200px (over 3x display size) and diffed against the originals:

- **p4:** maxΔ 12-13, on 0.44-0.54% of pixels
- **p3:** maxΔ 15, on 0.84-1.25% of pixels

Every differing pixel is on a stroke edge - this is antialiasing rounding, not geometry moving. At precision 4, a coordinate can shift by at most 0.0001 units in a 300-unit viewBox, i.e. **0.00013 px** at display size. The deltas exist only because the rasterizer rounds a subpixel edge differently at 3x zoom.

**Fix:** SVGO at **precision 4** - 214 KB of gzipped transfer down to 64 KB (**-70%**), geometry sub-pixel by construction. Add `loading="lazy"` and `decoding="async"` (Class A: a lazy image already in the viewport loads immediately, so above-the-fold behavior is unchanged).

### P1-2. Per-frame work that should be cached

Inside `draw()`, every frame:

- **The facet array is rebuilt (768 objects) and re-sorted (~7,400 comparisons).** The `u`/`v` pairs never change. **Class A, but with a trap I missed initially:** at angle 0, `sinA` is 0, so `avgVRot` collapses to `vCenter + V_CENTER` - **every one of the 32 facets in a row has a byte-identical sort key.** `Array.prototype.sort` is stable per ES2019, so today those ties resolve to the fresh-build order (v descending, u ascending), and that order decides which facet's `destination-out` erase lands on top where facets overlap. Naively reusing a mutated array would carry over the *previous* frame's ordering and change pixels. The rewrite must re-seed the index array in canonical order each frame, or make the comparator total by tie-breaking on the original index. With that, output is identical.
- **`terrainHeight()` runs 4x per facet (3,072 calls/frame)** with `sin`/`cos`/`exp`/`pow` inside. Corner heights are shared between adjacent facets, so a precomputed lookup table cuts this ~4x, and heights are angle-independent so it is built once. **Class A conditionally:** the LUT must be keyed by grid index and populated using the *same* float accumulation the loops use (`u + U_STEP`, `v - V_STEP` from the same starting constants), which reproduces bit-identical doubles. Keyed any other way, rounding could drift.
- **`ctx.stroke()` runs on every facet with `strokeStyle = 'transparent'`** - a no-op that still walks the path, 768x/frame. Removing it is Class A (a zero-alpha source-over stroke writes nothing), along with the now-dead `alpha`/`depthAlpha`/`textClearance` computation that only guarded it.

**Correction to my first report.** I suggested collapsing the per-facet `destination-out` erase and the subsequent fill into a single fill.
That is **Class C - it changes the image.** `destination-out` punches the canvas to *transparent*, so the following `rgba(11,15,25,α)` fill composites over nothing and lets the wash below show through the canvas. A single `source-over` fill would instead composite onto the sky and onto previously-drawn facets. Those differ wherever facets overlap, which is everywhere once the terrain rotates. **Rejected - keep both passes.**

### P1-3. The static galaxy sky is redrawn every frame - Class A

`drawGalaxySky()` re-creates 3 `createRadialGradient` objects, re-fills 3 large rects under `globalCompositeOperation = 'lighter'`, then redraws 220 stars - ~15 of which set `shadowColor`/`shadowBlur`, the most expensive 2D-canvas operation available - every frame, despite the code comment correctly noting it is "static, unaffected by rotation."

**Fix:** render the sky once into an `OffscreenCanvas` at resize time and `drawImage()` it per frame.
Identical by construction: the main canvas is `clearRect`-ed to transparent before the sky is drawn, so `lighter` composites against the same transparent start on the offscreen surface, and blitting the result with `source-over` onto a transparent canvas reproduces it exactly. Facets still erase into it the same way afterwards.
~240 draw calls plus 3 gradient constructions become one blit.

---

## P2 - Medium

### P2-1. 6.2 MB of unreferenced assets in `public/` - Class A

`public/new_brand.svg` (2.79 MB), `public/Vector(Stroke).svg` (3.46 MB) and `public/hero_bg.svg` (310 KB) have zero references in `src/`.
`new_brand.svg` is within a few hundred bytes of `image 1.svg` - almost certainly the same asset duplicated.
No runtime impact; this is deployment and clone weight. Delete after confirming nothing outside `src/` links them.

### P2-2. `ChatbotShowcaseOrnament` is imported but never rendered - Class A

`ChatbotShowcase.tsx:2` imports it and the JSX never uses it - 18 stroked paths of dead bundle, and a lint error waiting to happen.
Worth confirming the omission was deliberate before deleting; if the ornament was *meant* to render, adding it is a visual change and belongs in a separate decision.

### P2-3. `HeroHorizonField` is a pointless client boundary - Class A

An 8-line `'use client'` component that renders `<HeroHorizonCanvas>` and forwards `className`.
Under P0-4 it stops being pointless - it becomes the media-query and `next/dynamic` gate. Give it that job rather than deleting it.

---

## Rejected - would change pixels (Class C)

| Idea from the first report | Why it is rejected |
|---|---|
| Rasterize the chat SVGs to 2x WebP | Upscaled on DPR-3 phones; visibly softer text than vector. Quality loss. |
| Drop `backdrop-blur-md` from the chat panels | Removes real blur of the wash behind them. Visible. |
| Delete `backdrop-blur-xl saturate-150` from the canvas | `saturate-150` is a substantial color shift. Superseded by the static-sibling fix in P0-2. |
| Collapse the facet `destination-out` + fill | Different compositing result wherever facets overlap. See P1-2. |
| Scope down `transition-colors duration-500` | No static pixel change, but it alters theme-toggle animation feel. Opt-in only. |
| Reduce the 6 stacked backdrop-filter layers generally | Each one is doing visible work. P0-2 fixes the only one that is structurally misplaced. |

---

## Revised plan

| # | Change | Class | Effort | Gain |
|---|---|---|---|---|
| 1 | `image 1.svg` -> WebP q90 1920w via `next/image` | B (maxΔ 0.4/255) | S | **-2.67 MB** |
| 2 | Move `backdrop-filter` to a static sibling div | A | XS | Largest GPU/jank win |
| 3 | Cache `targetScrollY`; suspend rAF once settled | A | M | Zero layout reads during scroll |
| 4 | Gate canvas mount on `>=640px`; reduced-motion draws once | A | S | Fixes the worst-case profile |
| 5 | SVGO precision 4 on both chat SVGs + lazy/async | B (sub-pixel) | S | **-150 KB** gzipped |
| 6 | Facet reuse (canonical re-seed), height LUT, offscreen sky, drop no-op stroke | A | M | ~3-5x cheaper frame |
| 7 | Delete unused assets + dead import | A | XS | -6.2 MB deploy |

Items 1-5 and 7 are independently shippable.
Item 6 is the only one touching render logic in a way that needs a visual diff, and its two traps (sort-tie ordering, LUT float accumulation) are documented above.

## Verification

Static gates, run automatically: `npx tsc --noEmit`, `npm run lint`, `npm run test`.

The Class A items are safe on the reasoning above. The two Class B items are measured but were measured *analytically* - I reproduced the pipeline in Python, I did not screenshot the real page. **Proving pixel-perfect end-to-end needs before/after screenshot diffs from a running dev server**, which per project policy requires your explicit Manual/Auto call. Until that runs, treat B as "measured sub-threshold", not "confirmed identical in browser."

Post-change targets: no long tasks > 50 ms and no forced-reflow warnings in a hero -> ChatbotShowcase scroll trace at 4x CPU throttle; Lighthouse mobile LCP < 2.5 s, CLS < 0.1, TBT < 200 ms.
