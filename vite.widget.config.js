/**
 * vite.widget.config.js — Production Build for the Embeddable Widget
 *
 * Goal: Produce a SINGLE self-contained `widget.js` file.
 *  - All compiled CSS is injected INSIDE the Shadow DOM (not into <head>).
 *  - React + all dependencies bundled in (no external imports needed on client).
 *  - Output goes to /public so Vercel serves it as a static asset.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    cssInjectedByJs({
      // Instead of injecting into <head>, we inject into the shadow root.
      // The plugin exposes this via a custom injector function.
      // cssAssetsFilterFunction: undefined, // inject ALL css
      injectCode: (cssCode) => {
        // This runs at runtime in the browser.
        // We inject the CSS as a <style> tag into the shadow root's <head>-equiv.
        // We use a globally shared registry to pass the shadow root reference.
        return `
          (function() {
            try {
              var styleEl = document.createElement('style');
              styleEl.setAttribute('data-sapybase-widget', 'true');
              styleEl.textContent = ${cssCode};
              // Try to inject directly into shadow root if it exists
              var shadowHost = document.getElementById('sapybase-widget-root');
              if (shadowHost && shadowHost.shadowRoot) {
                shadowHost.shadowRoot.appendChild(styleEl);
              } else {
                // Fallback: inject into head (widget-entry.jsx will pick it up via MutationObserver)
                document.head.appendChild(styleEl);
              }
            } catch (e) {
              console.error('[SaPyBase Widget] Style injection failed:', e);
            }
          })();
        `;
      },
    }),
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  publicDir: false,
  build: {
    outDir: 'public',
    emptyOutDir: false,
    cssCodeSplit: false,
    minify: 'terser',
    lib: {
      entry: 'src/widget-entry.jsx',
      name: 'SaPyBaseWidget',
      fileName: () => 'widget.js',
      formats: ['iife'],
    },
    rollupOptions: {
      external: [],
      output: {
        // Inline all dynamic imports into the single bundle
        inlineDynamicImports: true,
      },
    },
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging; flip to true for final prod
        passes: 2,
      },
    },
  },
});