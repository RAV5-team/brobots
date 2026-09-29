import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// Адрес dev-сервера фиксирован: на него опираются правила визуальной проверки (AGENTS.md).
const DEV_PORT = 5173
// services/api, запущенный локально (docs/api/README.md); другой адрес — API_PROXY_TARGET. В контейнере /api проксирует nginx.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    rolldownOptions: {
      // Стартовые модули (метка $initial) — одним чанком. Иначе rolldown выносит в отдельные предзагружаемые чанки то,
      // что ещё импортируют ленивые шаги (Field, chevron-down), и каждый лишний файл — байты gzip в бюджете (D-109).
      output: { codeSplitting: { groups: [{ name: 'index', tags: ['$initial'] }] } },
    },
  },
  server: {
    port: DEV_PORT,
    strictPort: true,
    proxy: { '/api': API_PROXY_TARGET },
    // Проверка словаря (dictionaryKeys.test.ts) читает и исходники темы входа Keycloak — они вне корня пакета.
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../keycloak-theme/src'] },
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
