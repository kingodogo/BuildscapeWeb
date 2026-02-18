import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Check if running in Netlify dev mode
const isNetlifyDev = process.env.NETLIFY_DEV === 'true' || process.env.NETLIFY_DEV

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    proxy: {
      '/api': {
        // In Netlify dev mode, proxy to Netlify dev server (port 8888)
        // Otherwise, proxy to Vercel dev server (port 3000)
        target: process.env.NETLIFY_DEV ? 'http://localhost:8888' : 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
})