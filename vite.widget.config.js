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
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
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