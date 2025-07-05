import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    proxy: {
      '/api/pdf': {
        target: 'https://www.kansaigaidai.ac.jp',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pdf/, '')
      }
    }
  }
})
