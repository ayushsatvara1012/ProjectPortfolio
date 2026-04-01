/**
 * SaPyBase Widget — Bulletproof Isolated Mount
 *
 * Architecture:
 *  1. A fixed, pointer-events:none host <div> is appended to <body>.
 *  2. A Shadow DOM is attached to that host element (total CSS isolation).
 *  3. This file's own compiled CSS is captured via __INJECTED_CSS__ (set by
 *     vite.widget.config.js define block) and injected as a <style> tag
 *     directly inside the Shadow Root — host CSS cannot bleed in.
 *  4. Google Fonts are injected inside the Shadow Root with a <link> tag.
 *  5. A CSS reset (*) is written first to cancel any inherited values that
 *     browsers might propagate through the Shadow boundary.
 *  6. React is mounted onto a div *inside* the Shadow Root.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatWidget from './components/chatWidget';
import tailwindStyles from './index.css?inline';

// ─── 1. PREVENT DOUBLE-MOUNT ─────────────────────────────────────────────────
const CONTAINER_ID = 'sapybase-widget-root';
if (document.getElementById(CONTAINER_ID)) {
  // Already mounted — do nothing
} else {
  // ─── 2. CREATE THE FIXED HOST ELEMENT ──────────────────────────────────────
  const host = document.createElement('div');
  host.id = CONTAINER_ID;

  // The host element must never interfere with the page layout.
  // Everything visual lives INSIDE the Shadow DOM, not on this element.
  Object.assign(host.style, {
    position: 'fixed',
    bottom: '0',
    right: '0',
    width: '0',
    height: '0',
    zIndex: '2147483647',
    overflow: 'visible',
    border: 'none',
    padding: '0',
    margin: '0',
    background: 'transparent',
    pointerEvents: 'none',
  });
  document.body.appendChild(host);

  // ─── 3. ATTACH SHADOW DOM ──────────────────────────────────────────────────
  const shadow = host.attachShadow({ mode: 'open' });

  // ─── 4. INJECT GOOGLE FONTS INTO SHADOW ROOT ───────────────────────────────
  // Fonts specified in <head> don't propagate into Shadow DOM — we must inject them.
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Darker+Grotesque:wght@400;600;700;900&display=swap';
  shadow.appendChild(fontLink);

  // ─── 5. INJECT COMPILED TAILWIND CSS SYNCHRONOUSLY ──────────────────────────
  const styleTag = document.createElement('style');
  // Fix the Tailwind :root bug for Shadow DOMs
  styleTag.textContent = tailwindStyles.replace(/:root/g, ':host');
  shadow.appendChild(styleTag);

  // ─── 6. INJECT CSS RESET INSIDE SHADOW ROOT ───────────────────────────────
  // This kills any inherited CSS values from the host that browsers may
  // propagate through the Shadow boundary (e.g. font-size, line-height).
  const resetStyle = document.createElement('style');
  resetStyle.textContent = `
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-font-smoothing: antialiased;
      font-family: inherit;
      direction: ltr;
      text-align: left;
    }
    :host {
      all: initial;
      font-family: 'Darker Grotesque', 'Bricolage Grotesque', system-ui, sans-serif !important;
      font-size: 16px !important;
      line-height: 1.5 !important;
      color: #0f172a !important;
      direction: ltr !important;
      text-align: left !important;
      -webkit-text-size-adjust: 100% !important;
    }
  `;
  shadow.appendChild(resetStyle);

  // ─── 7. READ API KEY FROM SCRIPT TAG ───────────────────────────────────────
  const scriptTag =
    document.querySelector('script[src*="widget.js"][data-api-key]') ||
    document.querySelector('script[data-api-key]');
  const passedApiKey = scriptTag ? scriptTag.getAttribute('data-api-key') : null;

  // ─── 8. CREATE REACT MOUNT POINT ───────────────────────────────────────────
  const mountPoint = document.createElement('div');
  mountPoint.id = 'sapybase-react-root';
  // This inner div IS pointer-events:none so the background is clickable,
  // but children (like the chat window) will set pointer-events:auto.
  Object.assign(mountPoint.style, {
    position: 'fixed',
    bottom: '0',
    right: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483647',
    pointerEvents: 'none',
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  });
  shadow.appendChild(mountPoint);

  // ─── 9. RENDER REACT WIDGET ────────────────────────────────────────────────
  const root = ReactDOM.createRoot(mountPoint);
  root.render(<ChatWidget apiKey={passedApiKey} />);
}