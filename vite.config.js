import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Mengizinkan akses dari network lokal
    allowedHosts: true, // Izinkan akses dari Cloudflare Tunnel, Ngrok, atau domain luar
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/covers': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/original': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
