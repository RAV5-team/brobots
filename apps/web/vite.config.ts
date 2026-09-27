import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Адрес dev-сервера фиксирован: на него опираются правила визуальной проверки (AGENTS.md).
const DEV_PORT = 5173
// services/api, запущенный локально (docs/api/README.md). В контейнере /api проксирует nginx.
const API_PROXY_TARGET = 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    port: DEV_PORT,
    strictPort: true,
    proxy: { '/api': API_PROXY_TARGET },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { include: [/\.css\?raw$/] },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Типы домена не исполняются; точка входа и настройка тестов не тестируются.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts', 'src/domain/**'],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
