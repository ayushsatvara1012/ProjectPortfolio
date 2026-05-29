# Homepage & Navbar — Performance Audit Report

**Date:** 2026-05-29  
**Branch:** `sapybase-main`  
**Scope:** Homepage (`/`) and Navbar component — UI/UX changes reviewed for performance, loading time, efficiency, and CSS best practices.  
**Auditor:** Claude Code (Sonnet 4.6)

---

## Executive Summary

The new design is visually ambitious and the UX intent is clear. However, several critical issues need to be resolved before this can ship without degrading Core Web Vitals. The two most urgent are:

1. **A live WebGL canvas running inside the Services dropdown at all times** — even when the dropdown is closed.
2. **A massive dead-code JSX block in `HeroSection.tsx`** that bundles unused libraries but never renders.

Secondary priorities are unoptimised SVG payloads, a font class that silently falls back to system sans-serif, and invalid Tailwind utilities that silently do nothing.

---

## Section 1 — Critical Bugs

### BUG-01 · WebGL Canvas Running 24/7 Inside the Navbar Dropdown

**File:** `src/app/components/Navbar.tsx` — line 162–178  
**Severity:** Critical  

`AntigravityBackground` (a full Three.js `Canvas` with 100 particles) is mounted inside the Services dropdown panel. The component is always in the DOM — it is never conditionally rendered based on `isServicesOpen`. It is only visually hidden with `opacity-0 pointer-events-none`. This means:

- Two WebGL contexts run simultaneously the moment the homepage loads: one in `HeroSection` and one inside the navbar.
- The navbar canvas runs its `useFrame` loop at 60 fps indefinitely — raycasting on every frame, computing 100×100 = **10,000 particle positions** per tick, updating two GPU buffers.
- On mobile (which has no GPU headroom), this will cause janky scroll and throttled frame rates even though the canvas is invisible.

**Fix direction:** Mount `AntigravityBackground` conditionally on `isServicesOpen`, or replace it with a lightweight static gradient/illustration that doesn't require a WebGL context.

---

### BUG-02 · Dead-Code JSX Block Bundled With Live Code

**File:** `src/components/marketing/HeroSection.tsx` — lines 141–458  
**Severity:** High  

A large section wrapped in `{false && (...)}` is never rendered at runtime but is **fully compiled, bundled, and shipped to the browser**. JavaScript bundlers do not tree-shake JSX dead code. Inside this block:

- `framer-motion` `<motion.div>` and `<AnimatePresence>` are referenced.
- `<input type="color">`, a full bot preview panel, and an `<Image>` import are included.
- The `useState` hooks for `view`, `botColor`, and `isTraining` (lines 21–23, 57–64) exist only to support this dead block. They still run on every render cycle.

**Fix direction:** Remove the entire `{false && (...)}` block and the three `useState` declarations that serve only it. If the content needs to be preserved for reference, move it to a comment in a separate file or a git branch.

---

### BUG-03 · Typewriter Phase States Are Partially Unreachable

**File:** `src/components/marketing/HeroSection.tsx` — lines 27, 29–55  
**Severity:** Medium  

The phase type is declared as `'typing' | 'pausing' | 'deleting' | 'pause-before-type'` but only `'typing'` and `'deleting'` are ever assigned. `'pausing'` and `'pause-before-type'` are dead states. The actual pause behaviour is handled inline via `setTimeout` inside the `'typing'` branch. The stale type union misleads future maintainers and could mask a bug if a phase is accidentally set to one of the unused values (the effect would silently hang).

**Fix direction:** Simplify the type to `'typing' | 'deleting'` to match actual usage.

---

### BUG-04 · Fragile Anchor-Scroll Race Condition on Cross-Route Navigation

**File:** `src/app/components/Navbar.tsx` — lines 96–103  
**Severity:** Medium  

When clicking a `#home` anchor from a non-home route, the code does:
```js
router.push('/');
setTimeout(() => {
  document.querySelector('#home')?.scrollIntoView({ behavior: 'smooth' });
}, 100);
```
A hard-coded 100ms timeout is used to wait for the new page to mount. This is unreliable — on slow connections or constrained devices the new page will not have rendered within 100ms, so the `querySelector` returns `null` and the scroll silently fails. Additionally, `SmoothScrollProvider` fires `window.scrollTo(0, 0)` on every pathname change (via `ScrollResetter`), which directly conflicts with the anchor scroll and can win the race, leaving the user at the top of the page with no scroll to the intended target.

**Fix direction:** Use a URL with an explicit hash (`router.push('/#home')`) and let the browser handle native anchor resolution, or use a `useEffect` that waits for the element to exist before scrolling.

---

### BUG-05 · `isServicesOpen` State Shared Between Desktop Dropdown and Mobile Accordion

**File:** `src/app/components/Navbar.tsx` — lines 23, 135, 305  
**Severity:** Low  

A single `isServicesOpen` boolean drives both the desktop dropdown and the mobile accordion. If a user opens the services accordion on mobile, resizes their browser to desktop breakpoint, the desktop dropdown will be in the open state immediately. Conversely, the click-outside handler (bound to `dropdownRef`) only covers the desktop dropdown — it has no equivalent for mobile, so the accordion can remain open after navigating away without being closed.

**Fix direction:** Use two separate state values: `isServicesOpenDesktop` and `isServicesOpenMobile`.

---

## Section 2 — Performance Issues

### PERF-01 · `AntigravityBackground` Default in Hero Has No Particle Cap for Mobile

**File:** `src/components/marketing/HeroSection.tsx` — line 70  
**Severity:** High  

`<AntigravityBackground />` is called with no props, meaning it falls through to component defaults: `particleCount=50`, `particleType='capsule'`, `effectStyle='classic'`. This creates **2,500 instanced meshes** (`50×50`) with `CapsuleGeometry` (complex shape with end-caps, 2 radial + 8 height segments each). The `useFrame` loop runs a nested O(N²) loop with multiple `Math.sin` and `Math.cos` calls per particle per frame.

On mobile (even a modern iPhone), this is extremely heavy. There is no responsive particle-count reduction.

**Fix direction:** Detect `window.innerWidth` or use a CSS media query to pass `particleCount={20}` on mobile. Alternatively, replace the capsule geometry with the cheaper `'dot'` (sphere) type already used in `ScrollTravelSection`.

---

### PERF-02 · `ScrollTravelSection` rAF Loop Runs When Off-Screen

**File:** `src/components/marketing/ScrollTravelSection.tsx` — lines 17–73  
**Severity:** High  

A `requestAnimationFrame` loop (`tick`) runs unconditionally from mount to unmount. It runs the full spring physics and DOM style mutations on every frame even when the section is nowhere near the viewport — i.e., while the user is reading the hero or the bottom of the page.

Additionally, the `AntigravityBackground` inside this section uses `particleCount={100}` — 10,000 particles. This canvas runs its own `useFrame` loop in parallel. Together, during scrolling through the homepage, there can be up to three concurrent `useFrame` loops running (hero, scroll-travel section, navbar dropdown).

**Fix direction:** Wrap the `requestAnimationFrame` loop in an `IntersectionObserver`. Start the loop when the section enters the viewport, cancel it when it exits.

---

### PERF-03 · Large Unoptimised SVG Files Served as `<img>` Tags

**File:** Multiple — `EngineSection.tsx`, `WhatWeSolve.tsx`, `NewSection.tsx`  
**Severity:** High  

The following files are loaded with plain `<img src="...">` tags, receiving no Next.js image optimisation (format conversion, responsive sizing, lazy loading):

| File | Size | Component | Usage |
|---|---|---|---|
| `vector_SBengine.svg` | **408 KB** | `EngineSection.tsx` | Engine diagram |
| `vector_chat.svg` | **352 KB** | `EngineSection.tsx` | Chat illustration |
| `vector_WWS.svg` | **336 KB** | `WhatWeSolve.tsx` | Background |
| `vector_ChatBG.svg` | **7.5 MB** | Not audited | Unknown |
| `logo2.svg` | **208 KB** | `Navbar.tsx` | Repeated 6× in dropdown |

The `logo2.svg` at 208 KB is used as a small icon (displayed at `w-5 h-5`) inside each service row in the dropdown and mobile menu — **6 HTTP requests totalling 1.2 MB** for a 20px icon.

SVG files are not compressed by Next.js's `<Image>` optimisation pipeline (they are already vector), but `<img>` tags also miss `loading="lazy"` which is critical for below-the-fold assets.

**Fix direction:**
- Add `loading="lazy"` and `decoding="async"` to all decorative `<img>` tags that are below the fold.
- Optimise `vector_SBengine.svg`, `vector_chat.svg`, and `vector_WWS.svg` with `svgo` (the project already has `svgo.config.js` — run `npx svgo public/vector_*.svg`).
- Replace `logo2.svg` used as a dropdown icon with a simple inline SVG or a much smaller icon that matches actual display size.

---

### PERF-04 · `NewSection.tsx` Calls `setState` on Every Scroll Event

**File:** `src/components/marketing/NewSection.tsx` — lines 36–49  
**Severity:** Medium  

`setRagOpacity(opacity)` is called on every `scroll` event, even when `opacity` has not changed from its previous value. React will batch this, but the function still runs and produces a reconciliation cycle on every scroll tick. The `style={{ opacity: ragOpacity * 0.15, transition: '...' }}` means the DOM is updated on every scroll frame.

**Fix direction:** Either use a `useRef` and set the inline style directly (`el.style.opacity = ...`) without going through React state, or throttle the scroll handler.

---

### PERF-05 · Lenis Smooth Scroll rAF Loop Never Pauses on Hidden Tab

**File:** `src/components/SmoothScrollProvider.tsx` — lines 24–37  
**Severity:** Medium  

The Lenis smooth scroll library runs a `requestAnimationFrame` loop (`raf`) from mount until the component unmounts (i.e., for the entire session). There is no `document.addEventListener('visibilitychange', ...)` handler to pause Lenis when the browser tab is hidden. This wastes CPU and battery on background tabs.

**Fix direction:** Add a `visibilitychange` listener that calls `lenis.stop()` on `hidden` and `lenis.start()` on `visible`.

---

### PERF-06 · Material Symbols Font Loaded as Render-Blocking Stylesheet

**File:** `src/app/layout.tsx` — lines 65–68  
**Severity:** Medium  

The Material Symbols icon font is loaded via a standard `<link rel="stylesheet">` tag in `<head>`:
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,200,0..1,-50..200" />
```
This is a synchronous, render-blocking request to an external CDN on every page load. It fetches the variable font CSS and then the font file itself — two sequential network round-trips before text renders.

Furthermore, the font is requested with the full variation axis range (`0..1` for FILL, `-50..200` for GRAD) which results in a larger variable font file than if only the used axes were specified.

**Fix direction:** Replace with `next/font/google` for the Material Symbols font (Next.js supports this), or add `rel="preload"` alongside the stylesheet link. The project already uses `next/font` for body fonts — consistency would also help.

---

### PERF-07 · `WhatWeSolve.tsx` Scroll Listener Has No Throttle or Debounce

**File:** `src/components/marketing/WhatWeSolve.tsx` — lines 33–64  
**Severity:** Low  

The scroll handler iterates over all item refs and calls `getBoundingClientRect()` on each one every scroll event. `getBoundingClientRect()` triggers a layout reflow. While the listener is `{ passive: true }` ✓ (which is good), calling it 5 times per scroll tick on every fired event can still accumulate layout query cost on low-end devices.

**Fix direction:** Use `IntersectionObserver` for this use case — it is designed exactly for detecting which element is nearest the viewport centre, is passive by nature, and does not cause forced reflows.

---

## Section 3 — CSS Best Practices

### CSS-01 · `font-google` Resolves to a Non-Existent Web Font

**File:** `src/app/globals.css` — line 13  
**Severity:** High  

```css
--font-google: "Google Sans", sans-serif;
```

"Google Sans" is an **internal proprietary Google typeface** — it is not available on Google Fonts or any public CDN. It is only present on Google-owned devices and Chrome OS. On all other devices (i.e., all user devices), `font-google` silently falls back to `sans-serif` (the system font). Every element that uses `font-google` throughout the navbar, hero, and all homepage sections is rendering in the default system font rather than the intended design.

The project loads `Bricolage_Grotesque` and `Darker_Grotesque` via `next/font/google` (in `layout.tsx`) which are actually available. These are mapped to `--font-display` and `--font-sans` respectively, but the majority of the UI uses `font-google` instead.

**Fix direction:** Replace `"Google Sans"` with `"Bricolage Grotesque"` or `"Darker Grotesque"` — both are already loaded. Update the `--font-google` variable in `globals.css` to use one of the loaded font variables.

---

### CSS-02 · `text-md` Is Not a Valid Tailwind Utility

**File:** `src/app/components/Navbar.tsx` — lines 130, 231, 238  
**Severity:** Medium  

`text-md` does not exist in Tailwind CSS. The correct utility for 16px base font size is `text-base`. When Tailwind encounters `text-md`, it generates no CSS rule. The element renders at whatever font size it inherits — which means these elements rely entirely on inheritance and can produce inconsistent results.

Occurrences found in `Navbar.tsx` at:
- Line 130: desktop nav link wrapper
- Line 231: Login button
- Line 238: Get Started button

**Fix direction:** Replace all instances of `text-md` with `text-base`.

---

### CSS-03 · `font-regular` Is Not a Valid Tailwind Utility

**File:** `src/app/components/Navbar.tsx` — lines 130, 231, 237  
**Severity:** Medium  

`font-regular` is not a Tailwind class. The correct utility for `font-weight: 400` is `font-normal`. Like `text-md`, this silently generates no CSS and the element relies on inherited weight. In buttons this can result in unexpectedly bold or light text depending on the parent's computed weight.

**Fix direction:** Replace all instances of `font-regular` with `font-normal`.

---

### CSS-04 · Unused Custom Font Variables Declared in Globals

**File:** `src/app/globals.css` — lines 4–8  
**Severity:** Low  

Five font families are declared as CSS custom properties (`--font-questrial`, `--font-quantico`, `--font-londrina`, `--font-oneoutline`, `--font-glook`) but none of these fonts are loaded via `next/font` or any `<link>` tag. The Tailwind theme generates utility classes for them (`font-questrial`, `font-quantico`, etc.) but using any of these classes will fall back to the system sans-serif — producing no visible effect while adding to the CSS bundle size.

**Fix direction:** Either load these fonts via `next/font/google` if they are intentionally planned, or remove the variables and their theme entries if they are leftover from an earlier design iteration.

---

### CSS-05 · Inline `style jsx` in HowItWorks Breaks Tailwind Consistency

**File:** `src/components/marketing/HowItWorks.tsx` — lines 352–357  
**Severity:** Low  

```jsx
<style jsx>{`
  @keyframes fadeSlideIn { ... }
`}</style>
```

Using `styled-jsx` (the `jsx` prop on `<style>`) is the legacy Next.js Pages Router CSS approach. In the App Router, component-scoped CSS should be handled via CSS modules, `globals.css`, or a Tailwind arbitrary value. `styled-jsx` in the App Router injects a `<style>` tag into the DOM on every render rather than extracting it at build time — this results in a FOUC risk and the style tag appearing in unexpected places in the serialised HTML.

**Fix direction:** Move the `fadeSlideIn` keyframe definition to `globals.css` under `@layer base` alongside the other keyframes already defined there.

---

### CSS-06 · Header Background Transition Causes Full-Layer Repaint on Scroll

**File:** `src/app/components/Navbar.tsx` — line 111–115  
**Severity:** Low  

The `<header>` transitions `background-color` via `transition-all duration-500` and triggers a React state update (`setScrolled`) on every scroll event. Transitioning `background-color` forces the browser's compositor to repaint the entire header layer on each frame of the transition. With `backdrop-blur-2xl` also toggled at the same time, this means a blur filter is being added/removed while a background repaints — two expensive GPU operations triggered by a React re-render.

`transition-all` is particularly broad — it transitions every animatable property including `box-shadow`, `border-color`, and `backdrop-filter`, none of which benefit from broad transitions.

**Fix direction:** Replace `transition-all duration-500` with explicit `transition-[background-color,border-color,box-shadow] duration-500`. Use `will-change: background-color` on the header to promote it to its own composite layer and avoid repainting the content beneath.

---

## Section 4 — Accessibility & UX Gaps

### A11Y-01 · Hamburger Button Missing `aria-expanded`

**File:** `src/app/components/Navbar.tsx` — line 282–288  
**Severity:** Medium  

The mobile hamburger button has `aria-label="Toggle Menu"` but no `aria-expanded={isOpen}` attribute. Screen readers cannot determine whether the menu is currently open or closed without `aria-expanded`.

**Fix direction:** Add `aria-expanded={isOpen}` and `aria-controls="mobile-nav-menu"` to the button. Add `id="mobile-nav-menu"` to the mobile dropdown div.

---

### A11Y-02 · Typewriter Caret Is Not Hidden from Screen Readers

**File:** `src/components/marketing/HeroSection.tsx` — lines 92–99  
**Severity:** Low  

The blinking cursor `<span>` inside the `<h1>` has no `aria-hidden="true"`. Screen readers will read it as an empty element, creating a pause or spurious text in the heading announcement. The typewriter text itself (`{displayText}`) is also announced character-by-character as it types in some screen readers because the surrounding `<h1>` is live content.

**Fix direction:** Add `aria-hidden="true"` to the caret span. Wrap the entire typewriter group in `aria-live="polite"` with a visible label, or use `aria-label` on the `<h1>` with a static description.

---

## Section 5 — Summary Table

| ID | Severity | Category | Component | Issue |
|---|---|---|---|---|
| BUG-01 | Critical | Performance | Navbar.tsx | WebGL canvas running inside always-mounted dropdown |
| BUG-02 | High | Bundle size | HeroSection.tsx | Dead JSX block bundled with live code |
| BUG-03 | Medium | Code quality | HeroSection.tsx | Unused phase states in typewriter |
| BUG-04 | Medium | UX / Bug | Navbar.tsx | Fragile 100ms setTimeout for anchor scroll |
| BUG-05 | Low | State | Navbar.tsx | Shared open state between desktop and mobile |
| PERF-01 | High | Performance | HeroSection.tsx | No mobile particle count reduction |
| PERF-02 | High | Performance | ScrollTravelSection.tsx | rAF loop runs when off-screen |
| PERF-03 | High | Loading | Multiple | Large unoptimised SVGs with no lazy loading |
| PERF-04 | Medium | Performance | NewSection.tsx | setState on every scroll tick |
| PERF-05 | Medium | Performance | SmoothScrollProvider.tsx | Lenis rAF never pauses on tab hide |
| PERF-06 | Medium | Loading | layout.tsx | Material Symbols loaded as render-blocking stylesheet |
| PERF-07 | Low | Performance | WhatWeSolve.tsx | getBoundingClientRect on every scroll event |
| CSS-01 | High | CSS | globals.css | `font-google` resolves to non-existent "Google Sans" |
| CSS-02 | Medium | CSS | Navbar.tsx | `text-md` is not a valid Tailwind utility |
| CSS-03 | Medium | CSS | Navbar.tsx | `font-regular` is not a valid Tailwind utility |
| CSS-04 | Low | CSS | globals.css | Five unused font variables declared but never loaded |
| CSS-05 | Low | CSS | HowItWorks.tsx | `styled-jsx` used in App Router context |
| CSS-06 | Low | CSS | Navbar.tsx | `transition-all` on header triggers full repaint |
| A11Y-01 | Medium | Accessibility | Navbar.tsx | Hamburger button missing `aria-expanded` |
| A11Y-02 | Low | Accessibility | HeroSection.tsx | Typewriter caret not hidden from screen readers |

---

## Priority Fix Order

**Ship blockers (fix before any production deploy):**
1. BUG-01 — Remove or conditionally mount the WebGL canvas in the navbar dropdown.
2. CSS-01 — Fix `font-google` to point to an actually loaded font; this silently breaks all typography.
3. BUG-02 — Remove the dead `{false && ...}` block in `HeroSection.tsx`.

**Should fix before release:**
4. PERF-03 — Run `svgo` on the large SVGs and add `loading="lazy"` to below-fold images.
5. PERF-01 — Reduce particle count on mobile for the hero background.
6. PERF-02 — Wrap `ScrollTravelSection` rAF loop with `IntersectionObserver`.
7. CSS-02, CSS-03 — Replace `text-md` and `font-regular` with valid Tailwind utilities.
8. A11Y-01 — Add `aria-expanded` to the hamburger button.

**Nice to have (post-launch):**
9. BUG-04 — Fix anchor-scroll race condition.
10. PERF-04, PERF-05, PERF-07 — Scroll listener optimisations.
11. CSS-05, CSS-06 — CSS consistency and repaint optimisations.
12. BUG-03, BUG-05, A11Y-02, CSS-04 — Code quality cleanups.
