# Homepage story canvas plan

Gives the dot-matrix canvas room to be the star, and gives it something to say.

Extends `docs/hero-canvas-staging-plan.md` - that plan made the canvas look good, this one makes it mean something.

## The problem

The canvas renders abstract solids (sphere, torus, pyramid, wave) that say nothing about the product, and it sits behind centred hero copy - the worst arrangement, because the copy occupies exactly the part of the frame where the shape is most interesting.

## The decision

Two changes, agreed with the user:

1. **Hero**: copy moves left and gets trimmed, so the shape owns the centre and right of the frame.
2. **Story section**: a new full-screen section below the hero where the canvas plays a four-beat narrative with no competing copy.

Hero stays restrained with a single calm shape.
The story section is where the show happens.

## Rejected: removing hero copy entirely

The user asked whether the hero text could go completely.
It cannot, for three reasons, one of them decisive.

- **Mobile would be blank.** `HeroBackground` returns `null` on mobile, under `prefers-reduced-motion`, and before idle-mount - deliberately, to protect LCP.
Text is the only hero content phone users get.
- **The H1 is the page's strongest SEO signal.** A canvas-only hero is invisible to search.
- **Both CTAs would fall below the fold**, which costs conversion.

Underneath all three: an abstract dot funnel cannot state "AI chat for your website".
It suggests flow and filtering.
A visual reinforces a claim; it cannot make one cold.

## Phases

### Phase A - Hero layout

- Copy moves from centred to left column on `lg+`; stays centred below that breakpoint, where the canvas does not render anyway.
- Paragraph trims from ~50 words to one line.
Proposed: "The chat that answers every customer question 24/7, captures the lead, and proves the revenue it earned."
"No code required" survives as a small tag near the CTAs.
- H1 and both CTAs unchanged.
- New `focusX` / `focusY` props on `PreFooterCanvas` (0-1, default 0.5) offset the projection centre so the shape sits in the free right-hand space.
Hero passes ~0.66; the story section keeps the default.

Deliberately not reusing per-shape `STAGE.offset` for this - that is per-shape composition, whereas this is a per-placement concern.

### Phase B - Story section shell

New `src/components/marketing/home/StoryCanvas.tsx`, placed between `HeroSection` and `ChatbotShowcase`.

- Full-screen (`min-h-dvh`), page background, canvas full-bleed.
- Lazy-mounted on approach via IntersectionObserver + dynamic import - it is below the fold and must not touch LCP.
- Ships first with the existing shapes, to validate layout and performance before any new geometry exists.

Two canvases now live on one page.
The existing IntersectionObserver already pauses off-screen instances, so only one animates at a time - but this needs confirming under measurement, not assumption.

### Phase C - The four beats

Replaces the abstract cycle inside the story section only.
The hero keeps one calm shape.

| beat | geometry | says |
|------|----------|------|
| scatter | random points in an ellipsoid, drifting | visitors arriving |
| funnel | hyperboloid; radius narrows down its length | qualification and scoring |
| constellation | nodes on a blob, edges sampled between near neighbours | retrieval, the knowledge layer |
| ridge | surface ramping upward left to right | revenue, proved |

All four must emit exactly `POINT_COUNT` points.
The morph lerps point-to-point by index, so any mismatch truncates and distorts the transition.

**Flow is brightness, not motion.**
A band of raised intensity travelling down the funnel reads as flow and costs almost nothing.
Physically moving points would need a per-shape animated deformation the engine does not have.
Start with brightness; only build real particle motion if brightness proves insufficient.

### Phase D - Captions and accessibility

- A small, low-contrast caption under the canvas naming the current beat, cross-fading with it.
This is the difference between a pretty abstract animation and something a visitor actually understands.
It is a caption, not competing copy.
- `sr-only` description of the full narrative, so the section is not purely decorative to screen readers.
- Reduced-motion: the story section shows a single static beat rather than nothing, since unlike the hero it has no text to fall back on.

## Risks

- **Two live canvases.** Confirm by measurement that off-screen pausing works and the page holds 60fps.
- **Hero copy trim costs indexable body text.** Partly offset by the story section's `sr-only` narrative and by FeatureGrid / WhatWeSolve copy.
- **Beat legibility.** If the four forms do not read as their meaning without the caption, the caption is doing all the work and the geometry needs rethinking - not more caption.

## Verification

Browser verification is user-run per project policy.
Static checks (tsc, lint, vitest) run on every slice.
