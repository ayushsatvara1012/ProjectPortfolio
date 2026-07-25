# Navbar audit fixes - plan

Follow-up to `docs/navbar-collapsing-pill-plan.md`.
That plan built the collapsing pill; this one fixes the 17 findings from the 2026-07-25 audit of it (motion smoothness, responsiveness, correctness, contrast).

## Scope

All 17 findings, grouped into four slices.
Suite green between each slice.
No behavioural redesign - the locked decisions in the pill plan (scroll-only trigger, 80px collapse, desktop-only shape) all stand.

## Slice 1 - Motion (findings 1-5)

The three animated pieces currently run on three unrelated timings, so the shell, the content and the chevron never agree on where they are mid-flight.

Single shared curve: `cubic-bezier(0.22, 1, 0.36, 1)`, exposed as `--nav-ease` in `globals.css` so the Tailwind classes and the clip-path rule cannot drift apart again.

| Piece | Collapsing | Expanding |
|---|---|---|
| Shell clip-path | 560ms, no delay | 560ms, no delay |
| Content row | 200ms, no delay | 300ms, 260ms delay |
| Pill chevron | 120ms, no delay | 200ms, 380ms delay |

The asymmetry is the point: content leaves *before* the shell clips it, and arrives *after* the shell has opened enough to hold it.
Symmetric timings are what produced the sliced-links and floating-chevron artifacts.

The delays move onto the state they belong to rather than living permanently in one branch - the current `delay-200` sits only on the collapsed class, which is accidentally correct in one direction and wrong in the other.

Also in this slice:

- **Hysteresis.** One threshold at 80px lets jitter restart a 560ms animation both ways. Collapse above 80, expand below 40; between the two the current state holds.
- **rAF-throttled scroll.** Dirty-flag pattern, one state read per frame.
- **`will-change: clip-path`** on `.nav-shell__layer--animated`. Animating a clip-path over a `backdrop-blur-xl saturate-150` surface re-samples the backdrop every frame across the full 1400px bar; this is the frame-drop risk on low-end hardware. It is already gated behind `mounted`, so it is not a permanent compositor cost from first paint.
- **`mounted` gate on the pill.** The shell paints its restored state directly on reload; the chevron still fades in over 300ms+200ms delay. Gate it the same way.
- **Drop `transition-all` on the content row** in favour of `transition-[opacity,transform]` - `transition-all` sweeps every late-resolving property (Clerk's `Show`, the deferred `UserButton`).

## Slice 2 - Responsiveness (findings 6-9)

- **Dropdown overflow.** `w-[760px]` fixed with no clamp runs past the right viewport edge at `lg`. Clamp with `max-w-[calc(100vw-2rem)]`, and anchor the panel to the *wrapper* rather than `-left-1/4` of the button so the Services panel can right-align instead of overflowing.
- **1024-1150px crowding.** The `gap-4 / lg:gap-8 / xl:gap-10` ladder starts too generous for 6 links plus logo plus two auth controls. Tighten the `lg` rung and the auth padding.
- **Mobile corner radius.** `rounded-b-[28px]` is unconditional but the header is full-bleed below `lg` - the curve meets the screen edge with nothing beside it. Gate to `lg:`.
- **Mobile menu seam.** The translucent curved bar sits over the opaque `#FAFAFC` / `#0B0F19` menu panel, notching both corners. While the mobile menu is open the shell goes flat and opaque to match the panel.

## Slice 3 - Correctness (findings 10-14)

- **Dropdown panel nested inside its trigger `<button>`.** Invalid HTML (interactive descendants of a button), swallows or double-fires item clicks, and the panel's whole text becomes the button's accessible name. Lift the panel out to be a sibling inside the existing relative wrapper `div`.
- **Scroll-lock leak.** The `isOpen` effect's cleanup restores only the class, not `documentElement.style.overflow` / `body.style.overflow` - unmounting with the menu open leaves the page permanently unscrollable. Restore both.
- **Escape key** closes the open desktop dropdown, else the mobile menu; focus returns to the trigger.
- **`aria-expanded` / `aria-haspopup`** on desktop and mobile dropdown triggers.
- **`focusWithin` while collapsed.** The content row is `lg:invisible` when collapsed, so `visibility: hidden` takes its descendants out of the tab order and `focusWithin` can never flip true from a keyboard tab. The guard is dead in that state. This is acceptable - the pill is the documented keyboard path - but the claim "tab-in re-expand" in the pill plan's verification list is wrong and gets corrected there. The guard stays because it is still live for the expanded state (it stops the bar retracting out from under a user tabbing through the nav near the threshold).

## Slice 4 - Contrast (findings 15-17)

- **Pill chevron** `slate-500 / dark:slate-400` -> `slate-700 / dark:slate-300`. It sits on 75%-opacity glass sampling arbitrary page content and is the only affordance in the collapsed state, so its contrast cannot be left to whatever scrolls underneath.
- **Nav links** `dark:text-slate-400` -> `dark:text-slate-300` on the translucent `slate-950/75`.
- **Dead colour classes** on the link wrapper (`text-slate-800 dark:text-slate-50 hover:text-slate-900`) - overridden by every child. Remove.

## Files

- `src/components/layout/Navbar.tsx`
- `src/app/globals.css` - `--nav-ease` variable, `will-change`
- `docs/navbar-collapsing-pill-plan.md` - correct the tab-in verification claim

## Verification

- tsc, lint, vitest green after each slice.
- Browser verification is the user's (per the project's browser policy). What to look for:
  - Collapse/expand at 80px: no sliced links, no chevron over a wide bar, no flicker when hovering the threshold.
  - Reload scrolled past 80px: pill present on first paint, chevron included.
  - Dropdown items click through on the first press; Escape closes.
  - 1024px exactly: no crowding, Services dropdown fully on screen.
  - Mobile menu open: no notch where the bar meets the panel.
  - Light + dark, and `prefers-reduced-motion: reduce`.
