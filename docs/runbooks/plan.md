# Implementation Plan: Mobile Keyboard & Viewport Fix

This plan outlines the steps to fix the mobile layout issues where the keyboard causes the chatbot to shift, cut off, or allow the host page background to bleed through.

## Phase 1: Host-Side Synchronization (`sapybase-loader.js`)

The loader script is responsible for the iframe container. It must move from a static CSS layout to a dynamic, viewport-aware layout on mobile.

### 1.1 Add Visual Viewport Sync Logic
*   **Goal**: Ensure the iframe container (`.iframe-wrap`) perfectly matches the visible area of the screen, even when the keyboard is open.
*   **Implementation**:
    *   Add a `_syncVisualViewport()` method to the `SapybaseWidget` class.
    *   This method will read `window.visualViewport.height`, `width`, `offsetTop`, and `offsetLeft`.
    *   It will apply these as inline styles (`height`, `top`, `left`) to `this._wrap`.
    *   **Edge Case**: Only apply this on mobile (e.g., `window.innerWidth < 480`).

### 1.2 Event Listeners
*   **Goal**: React instantly to keyboard toggles and orientation changes.
*   **Implementation**:
    *   Attach listeners to `window.visualViewport` for `resize` and `scroll` events when the widget is expanded.
    *   Remove listeners when the widget is closed to save battery/performance.

### 1.3 Host Body Scroll Locking
*   **Goal**: Prevent the browser from "helping" by scrolling the host page to find the input, which causes the layout to break.
*   **Implementation**:
    *   Create `_lockScroll()` and `_unlockScroll()` methods.
    *   Locking: Set `document.documentElement` and `document.body` to `overflow: hidden` and `height: 100%`.
    *   Unlocking: Restore original styles.

---

## Phase 2: Embed-Side Configuration (`src/app/layout.tsx`)

Help the browser understand how we want the viewport to behave.

### 2.1 Update Viewport Meta Tag
*   **Goal**: Optimize Android Chrome's keyboard behavior.
*   **Implementation**:
    *   Update the `viewport` object in `Metadata` to include `interactiveWidget: 'resizes-content'`.
    *   This ensures the viewport physically shrinks on Android instead of just overlaying.

---

## Phase 3: Internal UI Resilience (`ChatWidget.tsx`)

Ensure the chatbot's internal flexbox layout can handle extreme height reductions.

### 3.1 Validate Flex Layout
*   **Goal**: Ensure the header stays at the top and the input stays at the bottom, while the message list shrinks.
*   **Implementation**:
    *   The main container should be `flex flex-col h-full`.
    *   The message list container should have `flex-grow: 1` and `overflow-y: auto`.

### 3.2 Smooth Keyboard Transition
*   **Goal**: Prevent "jumps" when the keyboard opens.
*   **Implementation**:
    *   The existing `--sapy-vh` logic in `ChatWidget.tsx` is good, but ensure it's applied to the outermost wrapper of the component to keep everything contained.

---

## Phase 4: Edge Case Handling

| Edge Case | Solution |
| :--- | :--- |
| **iOS Accessory Bar** | The Visual Viewport API naturally subtracts this bar's height from `vv.height`. |
| **iPhone Notches** | Ensure `padding-bottom: env(safe-area-inset-bottom)` is only applied when the keyboard is **closed**. |
| **Tabbing between inputs** | `visualViewport` scroll events will catch the browser's "auto-scroll" and re-center the widget. |
| **Orientation Change** | The `resize` event on `visualViewport` triggers a full recalculation of the bounds. |

---

## Verification Steps

1.  **iOS Safari**: Open chat, tap input. Verify no background is visible at the bottom and the header is still on screen.
2.  **Android Chrome**: Open chat, tap input. Verify the "Powered by" and input area are correctly positioned above the keyboard.
3.  **Rotation**: Open keyboard, rotate phone. Verify the UI adapts without floating or becoming unscrollable.
4.  **Host Scroll**: Try to swipe the host page background while the mobile chat is open; it should be locked.
