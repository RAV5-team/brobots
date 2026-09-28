import { defineConfig, devices } from '@playwright/test'

// Свой порт, чтобы не попасть на dev-сервер соседнего worktree (5173 и 5180 бывают заняты).
const PORT = Number(process.env.E2E_PORT ?? 5199)
const BASE_URL = `http://127.0.0.1:${String(PORT)}`

/**
 * e2e — готовые маршруты у своих ролей (`npm run test:e2e`, локально).
 * visual — эталоны готовых экранов (`npm run test:visual`, только в Docker-образе Playwright: шрифты и рендер одинаковы у всех).
 */
export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    viewport: { width: 1366, height: 768 },
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixels: 0 },
  },
  projects: [
    { name: 'e2e', testMatch: /.*\.e2e\.ts$/ },
    { name: 'visual', testMatch: /.*\.visual\.ts$/ },
  ],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    // Чужой сервер на порту не переиспользуем: тест упадёт явно, а не проверит другую сборку.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
