/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    // This ensures that the code is minified and optimized for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        // Removes console.logs for a clean production build
        drop_debugger: true
      }
    },
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Manual chunking: Moves heavy libraries into separate lazy-loaded files.
        // Visitors only download what they need, keeping the initial load fast.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],          // ~140KB gzipped — split out
          clerk: ['@clerk/clerk-react'],       // ~100KB gzipped — split out
          query: ['@tanstack/react-query'],    // ~30KB gzipped — split out
        }
      }
    }
  },
  test: {
    // Vitest configuration
  }
});