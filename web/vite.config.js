import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Accept any Host header — Vite 5 rejects unknown hosts by default which
    // breaks deploys where the service runs behind a proxy (Render, Cloudflare
    // tunnels, ngrok, etc) on a hostname the dev server doesn't know about.
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  preview: {
    port: 5173,
    allowedHosts: true,
  },
})
