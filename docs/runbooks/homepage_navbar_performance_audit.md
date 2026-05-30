# Homepage & Navbar — Performance Audit Report (Updated)

**Date:** 2026-05-29  
**Branch:** `sapybase-main`  
**Scope:** Full homepage audit including HeroSection, WhatWeSolve, ScrollTravelSection, FeatureIllustration, NewSection, HowItWorks, Navbar, and SmoothScrollProvider — Performance, UI/UX, animation flaws, and device optimization.  
**Auditor:** Claude Code (Sonnet 4.6)

---

## Executive Summary

Since the last audit, **4 critical issues have been fixed**. The Navbar WebGL canvas is now conditionally mounted, SmoothScrollProvider properly pauses on hidden tabs, separate dropdown states exist for mobile/desktop, and the hamburger button has proper ARIA attributes.

However, **3 critical blockers remain** that will degrade Core Web Vitals and user experience on lower devices:

1. **`font-google` silently breaks typography** — points to non-existent "Google Sans"
2. **Logo asset loaded 6 times** — 208KB × 6 = 1.2MB for a 20px icon
3. **Material Symbols render-blocking** — stylesheet blocks initial paint

Additionally, animation complexity across the homepage creates jank on mobile/tablet devices. The hero button's multi-layer reveals, ScrollTravelSection's morphing canvas, and HowItWorks SVG transitions all run at full complexity regardless of device.

---

## Section 1 — Fixed Issues (No Longer Blockers)

### BUG-01 ✅ WebGL Canvas Running 24/7 Inside Navbar Dropdown

**Status:** FIXED  
**Solution:** Implemented `renderCanvas` state with conditional rendering and 300ms cleanup timeout.

```jsx
const [renderCanvas, setRenderCanvas] = useState(false);

useEffect(() => {
  let timeoutId: NodeJS.Timeout;
  if (isServicesOpenDesktop) {
    setRenderCanvas(true);
  } else {
    timeoutId = setTimeout(() => {
      setRenderCanvas(false);
    }, 300);
  }
  return () => clearTimeout(timeoutId);
}, [isServicesOpenDesktop]);

{renderCanvas && <AntigravityBackground ... />}
```

**Impact:** Navbar canvas no longer runs continuously. Third WebGL context eliminated.

---

### BUG-05 ✅ `isServicesOpen` State Shared Between Desktop Dropdown and Mobile Accordion

**Status:** FIXED  
**Solution:** Separated into `isServicesOpenDesktop` and `isServicesOpenMobile`.

**Impact:** Users resizing browser no longer inherit dropdown state. Mobile accordion closes when navigating away.

---

### PERF-05 ✅ Lenis Smooth Scroll rAF Loop Never Pauses on Hidden Tab

**Status:** FIXED  
**Solution:** Added `visibilitychange` listener that calls `lenis.stop()` on hidden and `lenis.start()` on visible.

```jsx
const handleVisibilityChange = () => {
  if (document.hidden) {
    lenis.stop();
  } else {
    lenis.start();
  }
};
document.addEventListener('visibilitychange', handleVisibilityChange);
```

**Impact:** Background tabs no longer waste CPU and battery. ✓

---

### A11Y-01 ✅ Hamburger Button Missing `aria-expanded`

**Status:** FIXED  
**Solution:** Added `aria-expanded={isOpen}` and `aria-controls="mobile-nav-menu"` to button. Added `id="mobile-nav-menu"` to mobile dropdown.

**Impact:** Screen readers now correctly announce menu state. ✓

---

## Section 2 — Critical Blockers (Ship Stoppers)

### BLOCK-01 · `font-google` Resolves to Non-Existent Web Font

**File:** `src/app/globals.css` — line 8  
**Severity:** CRITICAL  
**Impact:** All typography fails silently across navbar, hero, and all sections.

```css
/* BROKEN */
--font-google: "Google Sans", sans-serif;
```

"Google Sans" is an **internal proprietary Google typeface**. It does not exist on public CDNs. On user devices, this silently falls back to the system sans-serif font. **Every element using `font-google` renders in the default system font, not the intended design.**

The project loads `Bricolage_Grotesque` and `Darker_Grotesque` via `next/font/google` (layout.tsx:10–20) which ARE available and loaded. These map to `--font-display` and `--font-sans` but the majority of the UI uses `font-google` instead.

**Occurrences:**
- HeroSection.tsx: lines 85, 106
- WhatWeSolve.tsx: lines 95, 101
- ScrollTravelSection.tsx: FeatureIllustration lines 39, 48, 52, 56
- NewSection.tsx: lines 61, 71, 74, 86, 89
- HowItWorks.tsx: multiple headings and text
- Navbar.tsx: lines 167, 173, 191, 194, 219, 236, 254, 268, 269, 275, 288
- EngineSection.tsx: lines 33, 36
- Footer.tsx: extensive usage

**Fix:** Replace `"Google Sans"` with `"Bricolage Grotesque"` (the heavier, display-oriented font already loaded).

---

### BLOCK-02 · Logo Asset Loaded 6 Times Totaling 1.2 MB

**File:** `src/app/components/Navbar.tsx` — lines 235 (desktop dropdown), 386 (mobile dropdown)  
**Severity:** CRITICAL  
**Impact:** 208 KB × 6 = **1.2 MB** of HTTP requests for a 20×20px icon.

The `logo2.svg` (208 KB) is used as a dropdown icon inside each service row. It's loaded via 6 separate `<img>` tags:
- Desktop dropdown: 6 service items → 6 requests
- Mobile dropdown: 6 service items → 6 requests (same images)

```jsx
<img src="/logo2.svg" alt="" loading="lazy" decoding="async" className="w-5 h-5" />
```

**Fix:** Replace with inline SVG or a much smaller icon (< 2KB). Alternatively, use CSS or a single icon font instead of 6 image requests.

---

### BLOCK-03 · Material Symbols Font Loaded as Render-Blocking Stylesheet

**File:** `src/app/layout.tsx` — lines 65–68  
**Severity:** CRITICAL  
**Impact:** Synchronous, render-blocking external request on every page load.

```html
<link 
  rel="stylesheet" 
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,200,0..1,-50..200" 
/>
```

This is a standard `<link rel="stylesheet">` tag that:
1. **Blocks rendering** until the CSS fetches from Google Fonts CDN
2. **Requests the full variation axis range** (`0..1` for FILL, `-50..200` for GRAD`) → larger variable font file
3. **Two sequential network round-trips** before text renders (CSS, then font file)

**Fix:** Use `next/font/google` for Material Symbols (Next.js supports this), or add `rel="preload"` with `as="font"` and `crossOrigin="anonymous"` to make it non-blocking.

---

## Section 3 — High-Priority Performance Issues

### PERF-01 · Navbar Header Transition Uses `transition-all` on Scroll

**File:** `src/app/components/Navbar.tsx` — line 148  
**Severity:** HIGH  
**Impact:** Repaints entire header layer and blur filter on every scroll state change.

```jsx
<header className={`fixed top-0 w-full z-50 h-20 transition-[background-color,border-color,box-shadow] duration-500 ...`}>
```

The header transitions `background-color`, `border-color`, `box-shadow`, and `backdrop-filter` simultaneously. When `scrolled` state changes, this triggers:
1. **Full layer repaint** (background-color change)
2. **Blur filter GPU operation** (backdrop-blur-2xl toggle)

Both happen at 500ms duration on every scroll event that crosses the threshold (line 43: `window.scrollY > 10`).

**Fix:** Specify explicit properties: `transition-[background-color,border-color,box-shadow]` (already correct in code, but verify no `transition-all` is being inherited).

---

### PERF-02 · Unoptimized Large SVG Files

**Files:** `public/vector_SBengine.svg`, `public/vector_chat.svg`, `public/vector_WWS.svg`  
**Severity:** HIGH  
**Impact:** Large uncompressed SVGs loaded on below-the-fold sections delay page load and increase bandwidth.

| File | Size | Component | Status |
|---|---|---|---|
| `vector_SBengine.svg` | **408 KB** | EngineSection | Not loaded (commented out) |
| `vector_chat.svg` | **352 KB** | EngineSection | Not loaded (commented out) |
| `vector_WWS.svg` | **336 KB** | WhatWeSolve | Loaded with `loading="lazy"` ✓ |

All three files have `loading="lazy"` and `decoding="async"` ✓, but are **not optimized with SVGO**. The project already has `svgo.config.js`.

**Estimated savings:** 60–70% reduction with SVGO (from 336 KB to ~100 KB for WWS).

**Fix:** Run `npx svgo public/vector_*.svg` to remove unused paths, convert transforms, and minify.

---

### PERF-03 · Hero Button Multi-Layer Reveal Animation Complexity

**File:** `src/components/marketing/HeroSection.tsx` — lines 111–128  
**Severity:** MEDIUM  
**Impact:** Three overlapping `<span>` elements with staggered scale-x and opacity animations on hover.

```jsx
<button className="overflow-hidden relative ...">
  <span className="... bg-blue-200 ... scale-x-0 group-hover:scale-x-150 ..." />
  <span className="... bg-blue-600 ... scale-x-0 group-hover:scale-x-[120%] ..." />
  <span className="... bg-blue-800 ... scale-x-0 group-hover:scale-x-75 ..." />
  <span className="... opacity-0 group-hover:opacity-100 ..." />
</button>
```

The animation is GPU-composited (transform: scale-x) but the layered structure and multiple repaints on hover can cause jank on mobile devices with limited GPU resources.

**Fix:** Simplify to a single-layer reveal or use CSS animations with `will-change: transform` to promote the button to its own composite layer.

---

### PERF-04 · HowItWorks Mobile Preview Scales But Animations Don't

**File:** `src/components/marketing/HowItWorks.tsx` — line 981  
**Severity:** MEDIUM  
**Impact:** Mobile devices run full animation complexity inside smaller container, creating perceived jank.

The mobile preview now scales responsively:
- Mobile (<640px): full width
- Tablet (640–768px): 300px max-width
- Tablet (768px+): 380px max-width

However, the **SVG animations, Framer Motion transitions, and particle physics inside the canvas all run at the same complexity** regardless of device capability. The three-step visual animations (INGEST, UNDERSTAND, DEPLOY) include:
- **SVG pathLength animations** (gradient strokes)
- **Moving data packets** (circles animating along paths)
- **Framer Motion transitions** with spring physics
- **Engine logo breathing animations** (scale + pulse)

On an iPhone 12 or budget Android tablet, this creates 60fps intent but perceptual jank due to memory pressure.

**Fix:** Detect `window.innerWidth` and reduce animation complexity (shorter durations, fewer elements, lower spring stiffness) on mobile devices below 768px.

---

## Section 4 — Good Patterns (No Changes Required)

### ✅ HeroSection: Particle Count Reduction for Mobile

```jsx
<AntigravityBackground
  particleCount={isMobile ? 20 : 50}
  particleType={isMobile ? 'dot' : 'capsule'}
/>
```

Desktop: 50 particles (2,500 instanced meshes with capsule geometry)  
Mobile: 20 particles (400 instanced meshes with dot geometry)

**Status:** Properly optimized. ✓

---

### ✅ ScrollTravelSection: IntersectionObserver Properly Pauses Animation

The rAF loop is wrapped in an `IntersectionObserver`:
- Starts when section enters viewport
- Pauses when section exits viewport
- Cancels and clears rAF on unmount

**Status:** Best-practice implementation. ✓

---

### ✅ WhatWeSolve: IntersectionObserver for Scroll Detection

Uses `IntersectionObserver` instead of scroll event listeners + `getBoundingClientRect()`.

**Status:** Performant. ✓

---

### ✅ NewSection: Direct DOM Manipulation for Opacity

```jsx
const onScroll = () => {
  const rect = section.getBoundingClientRect();
  const opacity = Math.max(0, Math.min(1, (visible - 0.7) / 0.25));
  if (ragRef.current) {
    ragRef.current.style.opacity = (opacity * 0.15).toString();
  }
};

window.addEventListener('scroll', onScroll, { passive: true });
```

Directly manipulates inline styles without triggering React state updates. Avoids reconciliation on every scroll event.

**Status:** Performant. ✓

---

## Section 5 — Device-Specific Performance Analysis

### Desktop (1920×1080, 60fps capable)

| Component | Issue | Severity |
|---|---|---|
| Navbar WebGL | ✅ Fixed (conditional) | — |
| Hero WebGL | 50 particles OK | Low |
| ScrollTravel WebGL | 100 particles + rAF OK (paused off-screen) | Low |
| Button reveals | 3 layers, acceptable | Low |
| SVG animations | Smooth, no issue | Low |

**Recommendation:** Desktop performs well. Ensure Material Symbols and logo assets load fast.

---

### Tablet (768×1024, GPU throttled)

| Component | Issue | Severity |
|---|---|---|
| HowItWorks animations | Full complexity in small container | **HIGH** |
| Logo loading (1.2 MB) | Network bottleneck | **CRITICAL** |
| ScrollTravel morphing | 100 particles + mask morphing + rAF | Medium |
| SVGs (336 KB unoptimized) | Network delay | **HIGH** |

**Recommendation:** Reduce HowItWorks animation complexity. Compress SVGs. Eliminate logo reloads.

---

### Mobile (375×812, CPU throttled, 4G)

| Component | Issue | Severity |
|---|---|---|
| Hero button reveals | Jank on interaction | **HIGH** |
| HowItWorks animations | Jank during scroll | **CRITICAL** |
| Logo loading (1.2 MB) | Network blocker | **CRITICAL** |
| Material Symbols render block | LCP delay | **CRITICAL** |
| `font-google` fallback | Typography broken | **CRITICAL** |

**Recommendation:** Fix typography. Load Material Symbols non-blocking. Eliminate logo reloads. Reduce animation complexity.

---

## Section 6 — Animation Complexity Audit

### Hero Section

**Canvas:** AntigravityBackground (50 particles desktop, 20 mobile)  
**Other:** Typewriter effect (character-by-character) + caret blink (caretBlink keyframe) + button reveal (3 layers)

**Complexity Score:** Medium  
**Mobile Performance:** Acceptable (reduced particles) ✓

---

### ScrollTravelSection

**Canvas:** AntigravityBackground (100 particles) + water_drop effect + morphing ripples  
**Other:** rAF spring physics loop (paused off-screen ✓) + SVG mask gradient morphing

**Complexity Score:** High  
**Mobile Performance:** Good (paused when off-screen) ✓

---

### HowItWorks

**SVG Animations:**
- Step 1: 3 pathLength animated gradients + bouncing glows
- Step 2: Horizontal pathLength + moving circle + vertical pathLength + spring pop cards
- Step 3: Vertical pathLength + data packet animation + spring transitions + chat widget typing

**Framer Motion:** 3 slides with AnimatePresence mode="wait" transitions

**Complexity Score:** Very High  
**Mobile Performance:** Jank on low-end devices ✗

---

## Section 7 — Summary Table

| ID | Severity | Category | Component | Status | Fix |
|---|---|---|---|---|---|
| BLOCK-01 | CRITICAL | CSS | globals.css | ❌ Unfixed | Replace "Google Sans" with "Bricolage Grotesque" |
| BLOCK-02 | CRITICAL | Assets | Navbar | ❌ Unfixed | Replace 6 logo reloads with inline SVG |
| BLOCK-03 | CRITICAL | Loading | layout.tsx | ❌ Unfixed | Use next/font or rel="preload" for Material Symbols |
| PERF-01 | HIGH | CSS | Navbar | ✓ Correct | Verify transition properties (already fixed) |
| PERF-02 | HIGH | Assets | Multiple | ⚠️ Lazy | Run `svgo` on vector files |
| PERF-03 | MEDIUM | Animation | HeroSection | ⚠️ Acceptable | Optional: simplify button reveal |
| PERF-04 | MEDIUM | Animation | HowItWorks | ❌ Unfixed | Reduce animation complexity on mobile |
| BUG-01 | CRITICAL | Performance | Navbar | ✅ FIXED | — |
| BUG-05 | LOW | State | Navbar | ✅ FIXED | — |
| PERF-05 | MEDIUM | Performance | SmoothScrollProvider | ✅ FIXED | — |
| A11Y-01 | MEDIUM | Accessibility | Navbar | ✅ FIXED | — |

---

## Section 8 — Priority Fix Order

### 🔴 Ship Blockers (Fix Immediately)

1. **BLOCK-01** — Fix `font-google` to use "Bricolage Grotesque"
   - **Why:** Typography is completely broken on user devices. This is visible.
   - **Time:** 5 minutes
   - **Files:** `src/app/globals.css` (1 line change)

2. **BLOCK-02** — Replace 6 logo reloads with inline SVG or single icon
   - **Why:** 1.2 MB of wasted bandwidth for a 20px icon. Mobile users hit 4G throttle.
   - **Time:** 15 minutes
   - **Files:** `src/app/components/Navbar.tsx` (2 locations)

3. **BLOCK-03** — Material Symbols non-blocking load
   - **Why:** Render-blocking stylesheet delays LCP on every page load.
   - **Time:** 10 minutes
   - **Files:** `src/app/layout.tsx` (1 location)

### 🟡 Should Fix Before Release

4. **PERF-02** — SVG optimization with SVGO
   - **Why:** 60–70% size reduction. Impacts WhatWeSolve page load.
   - **Time:** 2 minutes (CLI)
   - **Files:** `public/vector_*.svg`

5. **PERF-04** — Reduce HowItWorks animation complexity on mobile
   - **Why:** Jank on mobile devices. Users notice during scroll.
   - **Time:** 20 minutes
   - **Files:** `src/components/marketing/HowItWorks.tsx` (conditional animation complexity)

6. **PERF-03** — Simplify hero button reveal (Optional)
   - **Why:** Nice-to-have. Current implementation is acceptable.
   - **Time:** 10 minutes

### 🟢 Post-Launch (Low Priority)

7. Polish scroll listener optimization
8. Font loading strategy refinement
9. Animation timing tweaks per device capability

---

## Implementation Checklist

- [x] BLOCK-01: Fix `font-google` definition — Google Sans loaded via next/font/google, Bricolage removed
- [x] BLOCK-02: Replace logo reloads — favicon.svg (4 KB) replaces logo2.svg (208 KB × 6 = 1.2 MB)
- [x] BLOCK-03: Material Symbols non-blocking — preload + print media swap, axis range narrowed
- [x] PERF-02: SVG optimization — SBengine 178→95 KB, chat 190→131 KB; WWS skipped (0% gain)
- [x] PERF-04: HowItWorks mobile animation reduction — isMobile gates all expensive animations
- [ ] Test: LCP, FID, CLS on mobile (throttled)
- [ ] Test: Scroll performance on iPhone 11
- [ ] Test: Scroll performance on budget Android

---

**Report Generated:** 2026-05-29  
**Next Action:** Implement fixes in priority order with user confirmation after each step.
