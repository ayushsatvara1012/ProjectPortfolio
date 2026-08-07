# Hero terrain line integrity

Fixes the broken lines, blank wedge and single heavy dark curve in `src/components/marketing/HeroHorizonField.tsx`.

The mountain's shape is correct and is frozen.
Every defect below is in how the shape is drawn - the hidden-line pass and the opacity model - not in the height field.
Noise, seeds, octaves, amplitude and both envelopes are untouched, so the silhouette comes out bit-identical.

Supersedes nothing; it is a follow-up to `docs/hero-terrain-clarity-plan.md`, which rewrote the surface itself.

## Measurements taken before any change

Captured by running the module headlessly under `node --experimental-strip-types` with the React component stripped.

| Quantity | Value |
|---|---|
| PLANE strokes | 85 |
| RELIEF strokes | 609 |
| Relief opacity max | 0.269 (at width 1.2) |
| Massif core region x150-400 y350-650, opacity range | 0.043 - 0.132, median 0.079 |
| Runs deleted by `o < 0.012` | 67 in-frame, 6,549 px of line |
| Deleted-run cluster | x 450-680, y 314-322; longest single deletion 180 px |
| Runs deleted by `MIN_LEN` | 25 total, 15 in-frame |
| Runs deleted by `half(i) && peak < 0.4` | 33 |
| Occlusion gaps on/near the massif | 195 total |
| Gaps 2-15 px (spurious) | 40 |
| Gaps >= 40 px (genuine occlusion) | 130 |
| Visible runs under 6 px on the massif | 19 |

## Defect 1 - the blank wedge is deleted line, not faded line

`emit()`'s `if (o < 0.012) return;` discards 67 in-frame runs totalling 6,549 px, clustered at x 450-680, y 314-322 - the right shoulder just below the horizon.

Those runs compute to `o ~ 0.0111`.
The lines beside them never touch the massif, so they route to the plane layer, where effective opacity at y 318 is `0.12 x hf-depth(318)` = `0.12 x 0.094` = `0.0113`.
Identical brightness: one line is deleted, its neighbour at the same brightness is kept.
That asymmetry is the wedge.

## Defect 2 - the occlusion test is finer than the buffer feeding it

The floating horizon is built on 1.5 px columns sampled along each column-centre ray, but drawn points sit anywhere inside their column.
Across a steep crest the surface moves several pixels of screen y per column, while `visible()` allows `+0.4` px of slack.

A line that is genuinely the frontmost surface therefore flickers hidden/visible along its own length: 40 measured gaps in the 2-15 px range, plus 19 sub-6 px slivers that `MIN_LEN` then deletes outright, each leaving a further hole.

## Defect 3 - the heavy dark curve is one run's maximum applied to the whole run

Darkest strokes, in order, form one connected chain over the summit:

```
o=0.269 w=1.2  (250,290) -> (397,380)
o=0.268 w=1.2  (111,349) -> (258,287)
o=0.242 w=1.2   (89,309) -> (161,266)
o=0.186 w=1.2 (-108,404) -> (111,349)
```

Neighbouring strokes in the same region sit at 0.043-0.132, median 0.079 - so 2-6x the opacity on a 1.33x wider stroke.

`peak` is the maximum height over an entire banded run and `BOOST = 2.3` multiplies the whole run by it uniformly.
A major line (`u % 5 == 0`, base 0.22, width 1.2) that merely grazes the summit is drawn at crest brightness all the way down both flanks, across ground that is nearly flat.

## Defect 4 - density pops rather than ramps

`half(i) && peak < 0.4` is a hard gate, so half-integer lines appear abruptly where the run maximum crosses 0.4.
Line density therefore doubles along a contour that has nothing to do with the surface, making the crest read denser than the flanks.

Owner authorised changing density (shape stays locked).

## Changes

### A. Erode the occluder instead of trusting a hardcoded tolerance

Dilate the horizon buffer by one column - `visible()` tests against the **max** over columns `c-1, c, c+1` at the same depth bin.

Larger stored y means easier to be visible, so a max-dilation is a conservative erosion of the occluder.
It preserves the buffer's existing one-sided guarantee (it can fail to hide, never wrongly hide) and bounds the intra-column sampling error by the inter-column difference, which is the quantity actually causing the flicker.
Leak at a silhouette edge is bounded by one column, 1.5 px.

Zero extra `height()` evaluations - it is a pass over the array that already exists.

### B. Weld before culling

In `sampleLine`, merge consecutive visible runs whose end-to-start screen distance is under `WELD` (3 px), then let `MIN_LEN` apply to what survives.
Removes the sliver holes without re-admitting specks.

### C. Lower the opacity floor

`0.012` -> `0.004`, roughly where an 8-bit sRGB composite quantises to nothing.
Relief lines then fade continuously exactly like plane lines do, and the wedge closes.

### D. Per-point crest emphasis

Split runs on a **height** band as well as the existing depth band - the `band()` machinery already exists, it needs a second index.
Opacity then tracks local height, so a crest is bright only where it is a crest and the flanks fall back in line with their neighbours.

`CREST_MAX` and `BOOST` retuned so the massif's top decile lands at 0.15-0.18 rather than 0.27.

Relief strokes switch to `butt` caps: splitting a run duplicates the boundary point into both halves, and round caps extend `w/2` past it, so every joint doubles its own alpha. That already beads the depth-band joints; adding height bands would multiply it. At widths 0.7-1.2 the cap shape itself is sub-pixel.

### E. Ramp density instead of gating it

Replace the `peak < 0.4` hard gate with a continuous fade on local height, so half-integer lines ramp in over the flank rather than popping along a contour.
Runs that fade past the floor from (C) disappear on their own.

## Verification

Owner chose **manual**: no dev server, no browser driven from here.

Claude verifies numerically and by headless PNG render (`qlmanage`), and reports:
- the same measurement table, after
- spurious-gap count (2-15 px) driven to near zero, genuine gaps (>= 40 px) unchanged in count
- opacity max within 0.15-0.18, massif median unchanged near 0.079
- deleted in-frame line length near zero
- `npx tsc --noEmit`, `npm run lint`

Owner then previews and confirms.

## Outcome

Shipped locally, uncommitted.

| Quantity | Before | After |
|---|---|---|
| In-frame line deleted while still visible | 6,549 px (67 runs) | 358 px (53 runs, all at o <= 0.0038) |
| Spurious gaps 2-6 px | 13 | 0 |
| Spurious gaps 6-15 px | 23 | 15 |
| Genuine occlusion, gaps 15-40 px | 24 | 24 |
| Genuine occlusion, gaps >= 40 px | 130 | 127 |
| Sub-6 px slivers on the massif | 19 | 12 |
| Relief opacity max | 0.269 | 0.223 (a flat foreground major, matching the plane layer) |
| Summit x60-320 y250-330, max | 0.269 chain | 0.179 |
| Summit top decile | - | 0.149 |
| Massif core x150-400 y350-650, top 10 | 0.13 down to 0.08 | 0.12 down to 0.10 |
| RELIEF paths | 609 | 854 |
| Rendered SVG bytes | ~69 KB | ~85 KB |

The genuine-occlusion counts holding still across the whole weld sweep (3, 5, 7, 9) is the evidence that the weld reaches grazes only.

`npx tsc --noEmit`: 11 errors before the change and 11 after, all in stale `.next/types/validator.ts` route types, none in `src/`.
`npm run lint`: 0 errors, 69 warnings, none in this file.
`npm run test`: 423 passed, 31 files.

Residual, accepted: 15 gaps in the 6-15 px class. These are lines tangenting a ridge over a stretch long enough that welding them would draw a chord across genuinely hidden surface. `WELD = 9` would take them to 11; not taken.

## Follow-up F - erosion radius in pixels, and why `COL` was the wrong reserve

The reserve item below ("halve `COL`") was measured and is backwards.
Shrinking `COL` sharpens the buffer, which erodes it *less*, so the tangent flicker returns.
At fixed erosion the census moves monotonically the wrong way:

| `COL` | spurious gaps 6-15 px | slivers < 6 px |
|---|---|---|
| 1.5 | 10 | 8 |
| 1.0 | 11 | 10 |
| 0.75 | 11 | 11 |
| 0.5 | 12 | 12 |

The cause is that erosion was expressed as "one column", tying a visibility tolerance to a resolution parameter.
Decoupling them - `ERODE_PX` in pixels, radius `= round(ERODE_PX / COL)` columns - makes `COL` purely a resolution knob again.

`ERODE_PX = 3` is the top of the usable range rather than a midpoint, and the genuine-occlusion classes are what bound it:

| `ERODE_PX` | 6-15 px | 15-40 px | >= 40 px | slivers < 6 px |
|---|---|---|---|---|
| 1.5 (as shipped above) | 10 | 17 | 119 | 8 |
| 3 | 9 | 18 | 117 | 5 |
| 4.5 | 11 | 24 | 110 | 7 |
| 6 | 13 | 22 | 111 | 7 |

At 4.5 px the `>= 40` class collapses and `15-40` jumps, which is long occlusions being punched through and split - surface behind a ridge leaking into view.
That is a worse artefact than the gap it buys, so 3 px is taken and the sweep stops there.

Also on this pass: the relief layer is wrapped in `<g id="mountain-terrain">` so the terrain is addressable on its own. Purely an identifier - no geometry, ordering or attribute change.

Shape still bit-identical. `npx tsc --noEmit` 11 errors, all pre-existing in stale `.next/types/validator.ts`, none in `src/`. `npm run lint` 0 errors. `npm run test` 423 passed.

## Not doing

- Any change to `pnoise`, `ridged`, `env`, `height`, `SEED_*`, `SCALE`, `OCT`, `AMP`, `LAC`, `GAIN`, `WARP`, `FLOOR`, `SHARP`, or either envelope. Shape is locked.
- Adding or removing peaks.
- ~~Halving `COL`. Held in reserve - only if (A) leaves spurious gaps, since it quadruples buffer build cost at module load.~~ Measured and rejected; see Follow-up F.
- Converting the relief polylines to Bezier `C`/`S` paths. RDP already runs at `EPS = 0.55` units, so the polyline deviates from the true curve by under half a pixel before the viewport scale - below what a curve fit could recover, and it would add a fitting stage between RDP and the band split for no visible gain.
- Round caps on relief strokes. They are deliberately `butt`; see the note in the component - band boundaries share a point, and a round cap composites that point's alpha twice and beads the line.
