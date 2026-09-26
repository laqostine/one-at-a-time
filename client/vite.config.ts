import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      // multi-page: host app + "Everyone joins" participant page + pitch landing
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        join: fileURLToPath(new URL('./join.html', import.meta.url)),
        landing: fileURLToPath(new URL('./landing.html', import.meta.url)),
      },
    },
  },
  preview: {
    port: 5174,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com', 'table.akilion.ai'],
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws/audio': { target: 'ws://localhost:8787', ws: true },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com', 'table.akilion.ai'], // bin/tunnel.sh
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws/audio': { target: 'ws://localhost:8787', ws: true },
    },
  },
})
