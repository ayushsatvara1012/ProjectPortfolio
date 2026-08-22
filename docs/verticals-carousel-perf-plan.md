# Verticals section - performance and correctness pass

## Problem

`src/components/marketing/VerticalsSection.tsx` renders two complete copies of the same three cards: a stacked list for phones (`lg:hidden`) and an animated carousel for laptops (`hidden lg:block`).
Only one is ever visible, but both are always in the DOM.

That doubling is the root of most of the cost, and it also produces a genuine correctness bug (duplicate SVG mask ids).

## Findings

### Performance

1. Double mount.
Six inline card SVGs (the SDS one is ~8KB of path data on its own) and six `next/image` elements instead of three.
`display: none` does not prevent image fetch or decode, so three 876x926 webp files are downloaded and decoded on every viewport for a subtree nobody can see.

2. Unconditional timer.
The 5s auto-advance `setInterval` runs regardless of whether the section is on screen or the tab is focused.
Each tick starts a 900ms `transform` transition across three large SVG subtrees.

3. No layer promotion.
The glide animates translate + rotate + scale over SVGs containing live `<text>`.
Without `will-change: transform` the browser re-rasterizes the whole vector subtree on every frame instead of compositing a cached raster.

4. `AgentShowcaseSection` is marked `'use client'` but has no hooks, no state and no event handlers.
It ships to the client for no reason.

### Bugs

5. Duplicate SVG ids.
`sds_svg-a` through `-e` and `coa_svg-a` through `-d` each appear twice.
`url(#id)` resolves to the first match in document order, which is the copy inside the `display: none` tree.

6. The centred carousel card is a `<button>` with `aria-label={undefined}` wrapping only `aria-hidden` artwork, so it has no accessible name.

7. `aria-live="polite"` on text that rotates every five seconds interrupts screen readers repeatedly, and there is no pause control (WCAG 2.2.2).

8. On desktop, card tag/title/description exist only in the hidden mobile tree, so assistive tech gets nothing but decorative artwork.

9. `SLOTS[slot]` is indexed by `(index - active) % CHEMICAL_CARDS.length`.
Adding a fourth card yields `undefined` and a crash.

10. The `CARD_SIZES` comment describes a `max-w-8xl` three-column grid that the component no longer has.

## Plan

### Slice 1 - collapse to a single DOM tree

One `.map()` over `CHEMICAL_CARDS` producing one `<article>` per card.
Layout switches by CSS only, so there is no hydration flash and no media-query hook.

- The rail is `grid gap-6` below `lg` and `relative` (absolute children) at `lg`.
- The text block is visible below `lg` and `sr-only` at `lg`, which simultaneously fixes finding 8.
- The click target at `lg` is an overlay `<button class="hidden lg:block absolute inset-0">` inside the art frame, which keeps the button content model valid (a `<button>` cannot legally contain `<h4>`/`<p>`).

Fixes findings 1, 5, 8.

### Slice 2 - gate the timer

`IntersectionObserver` on the rail plus `document.visibilitychange`.
The interval only exists while the section is on screen in a visible tab.

Fixes finding 2.

### Slice 3 - compositing

`will-change: transform` and `backface-visibility: hidden` on the three carousel cards, applied only when motion is actually enabled.

Fixes finding 3.

### Slice 4 - accessibility

- Drop `aria-live` from the rotating description.
- Add a real pause/resume control.
- Centred card overlay becomes inert (`aria-hidden`, `tabIndex -1`, `pointer-events: none`) rather than an unnamed button.

Fixes findings 6, 7.

### Slice 5 - cleanup

- Derive slot geometry safely so a fourth card cannot crash the component.
- Remove `'use client'` from `AgentShowcaseSection`.
- Correct the stale `CARD_SIZES` comment.

Fixes findings 4, 9, 10.

## Verification

`npx tsc --noEmit`, `npm run lint`, `npm run test` must stay green.
Browser verification is the user's call per CLAUDE.md - never self-started.
