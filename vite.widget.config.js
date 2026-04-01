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
        return `
          (function() {
            try {
              var styleEl = document.createElement('style');
              styleEl.setAttribute('data-sapybase-widget', 'true');
              // Tailwind attaches variables to :root, but inside Shadow DOM we need :host.
              var css = ${cssCode}.replace(/:root/g, ':host');
              styleEl.textContent = css;
              
              var shadowHost = document.getElementById('sapybase-widget-root');
              if (shadowHost && shadowHost.shadowRoot) {
                shadowHost.shadowRoot.appendChild(styleEl);
              } else {
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
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    'import.meta.env.VITE_SAPYBASE_API_KEY': 'undefined',
    'import.meta.env.VITE_API_URL': 'undefined',
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