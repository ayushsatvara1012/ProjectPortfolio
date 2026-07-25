# Navbar collapsing pill - plan

## Goal

Reshape the site navbar to match the Figma wireframe: a top-anchored bar with square top corners and heavily rounded bottom corners, inset from the viewport edges.
On scroll it retracts upward, leaving a short centered pill hanging below the top edge.
Clicking the pill returns the page to the top, and the bar accordions back down once it arrives.

## Locked decisions

| Question | Decision |
|---|---|
| Expanded height | Unchanged - stays 80px (`h-20`) |
| Layout space | Header stays `fixed`; page content never moves when the bar collapses |
| Colors | Unchanged - transparent at scroll-top, `#FAFAFC/70` + backdrop blur + soft shadow once scrolled, with dark-mode equivalents |
| Collapse threshold | 80px of scroll (one bar height) |
| Pill content | A bare `keyboard_arrow_down` chevron - no background, label or dashes (revised 2026-07-25; it was "nothing", but the pill needed to announce itself) |
| Re-expand trigger | Scroll position only. Clicking the pill scrolls to the top; the bar never expands in place (revised 2026-07-25 - hover-to-expand removed) |
| Mobile | Unchanged - the shape and collapse apply at `lg` and up only |

## Approach

The shape is produced with an animated `clip-path: inset(...)` on a `.nav-shell__surface` layer inside the `<header>`, not on the header itself and not by changing its box.

The first attempt clipped the `<header>`, which broke the nav: the desktop dropdown panels are header descendants, so `inset(0 16px 0 16px)` cut everything below the 80px bar and removed the dropdowns from paint and hit testing.
The surface layer carries the glass (tint, blur, shadow, radii); the header is `pointer-events: none` so a collapsed bar cannot swallow clicks, and `.nav-shell__content` (logo, links, auth) fades and lifts 12px on its own transition.

The glass surface is now always on - it no longer fades in at the scroll threshold - per the Frame 19 reference.

Why `clip-path`:

- `inset()` interpolates its four offsets **and** its `round` radii, so a single transition drives both the retract and the corner change.
- It clips hit testing as well as paint, so the collapsed state is only interactive inside the pill - the rest of the header stops swallowing clicks with no `pointer-events` juggling.
- It clips the `backdrop-filter` surface too, so the blur follows the shape rather than the element box.
- The header's children are never reflowed by the animation, so the logo and links are masked rather than squashed.

Geometry (desktop):

The header box itself is inset from the viewport by `lg:w-[calc(100%-32px)]`, so the clip-path's side offsets are measured from that box, not the viewport.

| | Side inset | Bottom inset | Radii (TL TR BR BL) |
|---|---|---|---|
| Expanded | 0 | 0 | `0 0 28px 28px` |
| Collapsed | `calc((100% - 300px) / 2)` | `calc(100% - 30px)` (leaves a 30px tall pill) | `0 0 24px 24px` |

## The border

There is no CSS `border` anywhere on the shell.
It cannot work: in the collapsed state the clip-path cuts through the middle of the box, and a border lives on the box *edges* - all four of which are outside the pill - so the pill comes out unbordered.
The same is true of `outline` and of the `mask-composite` gradient-border trick, since both are anchored to the border box.

Instead two layers share the clip geometry:

| Layer | Box | Pill | Radii | Paint |
|---|---|---|---|---|
| Border | `inset-0` | 300x30 | 28 / 24 | `bg-slate-900/10 dark:bg-white/15` |
| Glass | `top-0 left-px right-px bottom-px` | 298x29 | 27 / 23 | tint + `backdrop-blur-xl saturate-150` |

The glass layer sits 1px inside the border layer on the sides and bottom - never the top, since the bar is flush with the viewport edge - so the 1px sliver left showing is the stroke, and it follows the shape in both states.
The inner layer's pill is 2px narrower and 1px shorter to keep that offset constant through the animation; its box is already 2px narrower, so the percentage terms would otherwise resolve to the *same* pill and collapse the stroke on the sides.

The border colour is a low-alpha wash rather than the old `slate-200/80`, because the border layer is painted beneath the glass layer and therefore sits inside its backdrop.
A high-alpha colour there would be sampled by `backdrop-filter` across the whole bar and flatten the blur into a solid tint, killing the see-through.
At 10% the interior wash is negligible (the glass tint was nudged 70 -> 75 to compensate) and the stroke still reads at roughly the contrast the old border had.

There is no drop shadow - it was dropped by request, which also removed the need for a negative bottom offset in the expanded clip rect (`clip-path` clips an element's own `box-shadow`, so preserving one required extending the clip rect past the border box).

Timing: 560ms on a custom `cubic-bezier(0.22, 1, 0.36, 1)` - a fast start that settles without overshoot, which is what reads as "accordion" rather than "slide".

## First-paint correctness

The transition class (`.nav-shell__surface--animated`) is withheld until a `mounted` flag flips in a `requestAnimationFrame` after the first scroll sync.
Without it, a reload with a restored scroll position past 80px paints the full bar (SSR always renders `scrolled = false`) and then visibly animates down into the pill.
This is also why the header no longer carries `transition-all`: that swept `width`, `height`, `left`, background and borders, so anything resolving late - Clerk's `Show`, the deferred `UserButton` - turned into a 500ms tween instead of a static value.

## Expansion state

`collapsed = scrolled && !focusWithin && !activeDropdown && !isOpen`

Scroll position is the **only** trigger; the other three terms are guards, not triggers.
They stop the bar retracting out from under a user who is mid-interaction - tabbing through the nav, reading an open dropdown, or in the mobile menu.

The pill is a real `<button>` carrying the chevron, and its `onClick` does nothing but `window.scrollTo({ top: 0 })`.
The bar then unfurls on its own when `scrolled` flips false, so there is exactly one source of truth for the shape.
`hovered` and `manuallyExpanded` are both gone.

The button is always rendered but goes `invisible` when expanded, rather than being unmounted.
It cannot stay hit-testable: at 300px wide and centred it sits directly on top of the expanded nav links and would swallow their clicks.
`visibility: hidden` removes it from hit testing while still allowing the opacity fade.
`tabIndex` follows the same switch so it leaves the tab order when expanded.

## Accessibility

- The pill button is the keyboard path back to the nav while scrolled: it is labelled "Back to top and show navigation", and activating it scrolls to the top, which expands the bar.
- Focus tracking (`onFocusCapture` / `onBlurCapture`) lives on the **content row**, not the `<header>`. On the header it would fire for the pill button too, expanding the bar in place on focus and contradicting the scroll-only rule.
- The scroll-to-top honours `prefers-reduced-motion` by falling back to `behavior: 'auto'`.
- `prefers-reduced-motion: reduce` drops the transition to `none`; the states still swap, they just do not animate.

## Files

- `src/app/globals.css` - `.nav-shell__layer` / `--inner` / `--animated` / `--collapsed` inside a `(width >= 64rem)` media query.

The media query must be written in **rem**, not `1024px`.
Tailwind v4 compiles `lg:` to `(width >= 64rem)`, and the two only coincide at a 16px root font size.
A visitor who raises their browser's default font size would otherwise land in a band where the clip-path applies but the `lg:` utilities do not: the nav content stays visible and unclipped while the shell is masked down to a pill, and the pill button stays hidden.
- `src/components/layout/Navbar.tsx` - `hovered` / `focusWithin` / `mounted` state, derived `collapsed`, threshold bumped from 10px to 80px.

## Rejected

An earlier implementation animated the `<header>`'s own `width` / `height` / `left` with `transition-all` and rendered a "Menu" label inside the pill.
Both were dropped: resizing the box reflows and squashes the children toward centre, which reads as a shrink rather than an accordion retract, and the label contradicts the locked "pure grabber" decision.

## Verification

- tsc, lint, vitest green.
- Browser: expanded shape at scroll-top, collapse past 80px, dropdown holds it open, no page reflow on collapse, light + dark, and mobile (< 1024px) visually unchanged.

Note (2026-07-25 audit): "tab-in re-expand" was listed here and is not achievable.
The content row is `lg:invisible` when collapsed, and `visibility: hidden` removes its descendants from the tab order, so `focusWithin` can never flip true from a keyboard tab in that state.
The pill button is the keyboard path back to the nav, as the accessibility section already says.
The `focusWithin` guard stays because it is still live in the *expanded* state, stopping the bar retracting out from under a user tabbing through the nav near the threshold.
See `docs/navbar-audit-fixes-plan.md`.
