import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    // Output the built file to a specific folder
    outDir: 'dist-widget',
    cssCodeSplit: false,
    lib: {
      entry: 'src/widget-entry.jsx',
      name: 'SaPyBaseWidget',
      fileName: () => 'widget.js',
      cssFileName: 'style',        // Emits dist-widget/style.css
      formats: ['iife'], // "Immediately Invoked Function Expression" - runs automatically in the browser
    },
    rollupOptions: {
      // We do NOT want external dependencies. We want React bundled INSIDE the widget file.
      external: [],
    }
  }
});