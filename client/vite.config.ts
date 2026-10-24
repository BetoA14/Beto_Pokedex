import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Enable React support and configure the local development server.
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward browser /api requests to Express during development.
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
})
