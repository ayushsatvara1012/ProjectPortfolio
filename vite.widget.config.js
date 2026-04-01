import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [
    tailwindcss(), 
    react(),
    cssInjectedByJs(), // <-- THIS INJECTS CSS DIRECTLY INTO widget.js
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  publicDir: false,
  build: {
    outDir: 'public',
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: 'src/widget-entry.jsx',
      name: 'SaPyBaseWidget',
      fileName: () => 'widget.js',
      formats: ['iife'],
    },
    rollupOptions: {
      external: [],
    }
  }
});