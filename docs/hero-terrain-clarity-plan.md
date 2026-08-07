# Hero terrain clarity

Status: SHIPPED locally 2026-08-06, uncommitted.
Scope: `src/components/marketing/HeroHorizonField.tsx` (rewritten generator), `src/components/marketing/HeroSection.tsx` (background revert).

## Problem

The hero massif read as tangled wire rather than as a surface.
Two independent causes, both structural rather than cosmetic.

**No hidden-line removal.**
Both grid families were drawn in full, so every line behind a ridge showed through it.
On a steep flank the two families cross constantly and the result is a web with no readable silhouette.

**The noise was finer than the grid could sample.**
Grid lines sit 0.5 world units apart, so the surface is only sampled at that pitch across a line family.
The old field ran 5 octaves at SCALE 12, putting the finest octave at wavelength 0.75 units - roughly 1.5 samples per period, past Nyquist.
Neighbouring lines therefore picked up incoherent phases of the same octave, which appears as noise between lines instead of as shape along them.

## Fixes

**Floating-horizon occlusion.**
Height never moves a point sideways - the projected x carries no h term - so a screen column is exactly one view ray.
Visibility collapses from a 3-D query to a 1-D running minimum per column.
Bins are uniform in 1/d because flat-ground y is affine in 1/d, so a bin is a constant ~1.7px tall everywhere.
Each bin stores the minimum over strictly nearer bins only, so the error is one-sided: the buffer can fail to hide, never over-hide, and a crest is always drawn.
Bounded to the massif's x range, since flat ground cannot occlude anything.

**Four octaves at SCALE 22.**
Finest octave wavelength 2.6 units, about five samples per period.
THE OCTAVE COUNT IS A SAMPLING CONSTRAINT, NOT A TASTE ONE - a fifth octave lands at 1.3 units and the tangle returns.
Detail lost is bought back by the ridge crease and a domain warp, neither of which aliases.

**Gradient noise replacing value noise.**
Value noise pins extrema to the integer lattice, which under a ridge operator makes ridges prefer 0/45/90 degrees.

**Musgrave per-octave weighting.**
Each octave attenuated by the previous one's value, so detail accumulates on ridges and valleys stay smooth.

**Exact silhouette crossings.**
Run ends are bisected (7 halvings) onto the visibility boundary instead of landing on whichever sample straddled it.
Without this, ends sit up to a full step short or long, leaving stubs past ridges and gaps at crests.

**Screen-adaptive sampling.**
Step = STEP_PX·d/FOCAL walks every line at a near-constant pixel rate.
Uniform world stepping oversampled far ends by orders of magnitude while undersampling near ends.

**Two path-hygiene fixes.**
`filter(onFrame)` welded surviving ends across off-frame gaps, drawing chords that were never on the surface - now splits instead.
Runs under 5px are dropped; a line clearing a ridge for a few pixels reads as dirt, not geometry.

**Smooth near envelope.**
The old hard `d < 1.9` cut drew a visible diagonal crease and step across the lower-left corner.

## Background

Reverted to the original colorful `/image 1.svg` wash inside HeroSection.
The `hero-wash.webp` + page-level wrapper spanning hero and showcase is gone; `page.tsx` is back to its committed state.
`public/hero-wash.webp` is now unused and still on disk.

## Result

Path data 55KB -> 28KB, 609 relief paths, generation ~200ms at module load (server-only component, so build-time for a prerendered page).
Suite green: tsc 0 in src, lint 0 errors, 423 frontend tests.

## Verification tooling

Tuned against an offline twin in the session scratchpad (`field.mjs` + a pure-JS PNG rasterizer), so the geometry could be looked at without a dev server.
A `verify.mjs` renders the real component through React and rasterizes its actual SVG, which is how the transcription from the twin was confirmed.
Worth rebuilding if this is touched again - the defects above are invisible at 1x and obvious at 2.6x.
