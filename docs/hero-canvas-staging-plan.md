# Hero canvas staging plan

Turns `PreFooterCanvas` from a uniform-size shape cycle into a staged, cinematic hero background.

## Context

`PreFooterCanvas` became the homepage hero background (replacing `AntigravityBackground`).
Two problems followed from that move.

1. Every shape was normalised to an identical on-screen envelope by `fitToViewport`.
Safe, but monotonous - nothing reads as big when everything is the same size.
2. As a hero background it now sits behind the headline and both CTAs, so contrast matters far more than it did as a standalone prefooter section.

## Decisions

- **Scale ambition**: sphere 0.75 / torus 2.6 / wave 2.2 / pyramid 1.9.
Big beats deliberately bleed off-frame.
- **Legibility**: no vignette.
Instead a finer, denser, lighter dot field - richness comes from density, not contrast.
- **Wave motion**: slow diagonal drift across the hold, not a literal left-to-right traverse.

## Key distinction

Intentional bleed is not the clipping bug fixed earlier.
That bug was points crossing the camera plane, where `focal / (focal + z + depth)` divides by near-zero and projects to ~140,000px or gets dropped entirely.
The camera-plane guard stays; only the uniform-envelope rule goes away.

## Phases

### Phase 1 - Spatial indexing (prerequisite)

The illumination loop currently tests every projected point against every dot: 2,400 x 5,760 = 13.8M iterations/frame.
At the denser grid this becomes ~52M/frame and drops frames.

Dots sit on a regular lattice, so the cells within the influence radius can be computed arithmetically instead of searched.
Cost becomes points x ~25 cells = ~100k iterations, and is independent of grid density.

Requires storing grid origin and spacing on `stateRef` so the render loop can map screen position to cell index.

### Phase 2 - Finer, lighter dot field

- Spacing 15px -> 10px (single constant).
- Dot radius 1.0 -> 0.65.
- Ambient alpha 0.12/0.08 -> 0.09/0.06; active max 0.96 -> 0.50.
- `arc()` -> `fillRect()`; at sub-pixel radii the two are visually identical and fillRect is materially cheaper across ~13k dots/frame.

### Phase 3 - Staging registry

Per-shape config, no branching:

```ts
type ShapeStage = {
  scale: number;         // >1 deliberately bleeds off-frame
  offset?: { x; y };     // static composition offset, fraction of minDim
  drift?: { x; y };      // travel across the hold, fraction of minDim
  cameraDepth: number;   // lower = stronger perspective = more depth
  hold: number;          // seconds on screen
};
```

| shape | scale | cameraDepth | hold | reads as |
|-------|-------|-------------|------|----------|
| sphere | 0.75 | 220 | 7s | calm - the breath between big moments |
| torus | 2.6 | 120 | 9s | giant, bleeds top and bottom |
| wave | 2.2 | 140 | 11s | sweeps past on a slow diagonal |
| pyramid | 1.9 | 150 | 9s | monumental, sits low and looms |

Cycle order is the point: small -> giant -> sweeping -> monumental.

Point count stays a single global constant rather than per-shape.
Morph interpolates point-to-point by index, so mismatched counts would truncate and distort the transition.
Spatial indexing makes points cheap enough that sizing for the largest shape costs nothing meaningful.

### Phase 4 - Safety guards

Replaces `fitToViewport`'s envelope normalisation:

- **Camera-plane guard**: skip points whose perspective divisor falls below a floor.
Prevents the explosion-to-140,000px failure.
- **Off-screen cull**: skip projected points outside the canvas + influence margin.
Pays for the deliberately oversized shapes.

## Risks

- Uniformly lighter means the frame edges also get subtle, where there is no text to protect.
A vignette would have kept edges bold and only calmed the centre.
If the result reads flat, an edge-weighted boost is the follow-up - do not pre-build it.
- Giant shapes on a fixed 15px lattice read coarser, not more detailed.
The finer 10px grid in Phase 2 is what keeps big shapes continuous rather than gappy.

## Verification

Browser verification is user-run per project policy.
Static checks (tsc, lint, vitest) run on every slice.
