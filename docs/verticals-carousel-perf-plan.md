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

### Slice 2 - remove the auto-advance entirely

Owner decision after the first pass: the deck advances on click and nothing else.

This is strictly better than gating the timer, which is what the first pass did
(`IntersectionObserver` + `visibilitychange` + `matchMedia`).
With no timer there is nothing to gate, so all of that goes: no observer, no
media-query hooks, no pause state, no `visibilitychange` listener.
The component's only remaining state is `{ active, previous }` and it runs no
effects at all.

Fixes finding 2 by deletion, and dissolves finding 7 - a five-second timer was the
only reason the description could not be a live region.

### Slice 3 - compositing

`backface-visibility: hidden` on the cards, plus `will-change: transform` taken out
**in CSS only**, via `lg:group-hover:` / `lg:group-focus-within:` on the rail.

Promotion costs a compositor layer per card - several MB each at a 720px card - so
it is held only while the rail is hovered or holds focus, which with click-only
advance is exactly the window in which a move can be coming.
Doing this with a hook would mean state, an effect and a re-render for something
the compositor can decide by itself.
Tailwind wraps `group-hover` in `@media (hover: hover)`, so touch devices do not
get stuck promoted.

Fixes finding 3.

### Slice 4 - accessibility

- Keep `aria-live="polite"` on the description. It is correct once the text changes
  only on click: one announcement per user action.
- The centred card's overlay stays **enabled and focusable**. Disabling it would
  drop focus on the floor for keyboard users, because the button they just
  activated is the one that becomes centred. It carries `aria-current` and a
  "Showing X" / "Show X" label instead, which also gives it the accessible name it
  was missing.

Fixes findings 6, 7.

### Slice 5 - cleanup

- Derive slot geometry safely so a fourth card cannot crash the component.
- Remove `'use client'` from `AgentShowcaseSection`.
- Correct the stale `CARD_SIZES` comment.

Fixes findings 4, 9, 10.

## Verification

`npx tsc --noEmit`, `npm run lint`, `npm run test` must stay green.

Arbitrary Tailwind utilities are proved by compiling the sheet and grepping it:

```
npx @tailwindcss/cli -i src/app/globals.css -o /tmp/out.css \
  --content src/components/marketing/VerticalsSection.tsx
```

Grep the **escaped** selector, not the declaration - the class name is written
`.lg\:group-hover\:\[will-change\:transform\]`, so a plain `will-change:transform`
search returns nothing and looks like a failure when the rule is present.

There is no `distDir` / `NEXT_DIST_DIR` override in `next.config`, so `next build`
writes into the shared `.next/` and can disturb the owner's dev server.
Browser verification is the owner's call per CLAUDE.md - never self-started.
