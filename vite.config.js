import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  base: '/',
  build: {
    // This ensures that the code is minified and optimized for production
    minify: 'terser', 
    terserOptions: {
      compress: {
        drop_console: true, // Removes console.logs for a clean production build
        drop_debugger: true,
      },
    },
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Manual chunking: Moves heavy libraries into separate files
        // to keep your main initial load as small as possible.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          animations: ['framer-motion'],
        },
      },
    },
  }
})
