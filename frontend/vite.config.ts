import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// npm run build         — версия для сервера FastAPI (адреса от корня сайта)
// npm run build:static  — статический сайт для GitHub Pages: прогресс хранится на устройстве,
//                         относительные пути (сайт живёт в подпапке), маршруты через #
export default defineConfig(({ mode }) => ({
  base: mode === 'static' ? './' : '/',
  plugins: [react()],
  define: { 'import.meta.env.VITE_STATIC': JSON.stringify(mode === 'static' ? '1' : '0') },
  build: {
    outDir: mode === 'static' ? 'dist-static' : 'dist',
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    // Host не подменяем: сервер сверяет его с Origin (защита от CSRF)
    proxy: { '/api': { target: 'http://127.0.0.1:8765', changeOrigin: false } },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}))
