import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { keycloakify } from 'keycloakify/vite-plugin'
import { defineConfig } from 'vite'

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * Переменные окружения Keycloak, которые тема читает в рантайме (kcContext.properties).
 * Keycloakify кладёт их в данные КАЖДОЙ страницы входа — секреты сюда нельзя. Демо-пароли передаются, только если
 * заданы DEMO_PLATES_* в .env (docker-compose.yml): тогда их и так показывают плашки.
 */
const THEME_ENV = [
  'RAV5_DEMO_USER_EMAIL',
  'RAV5_DEMO_USER_PASSWORD',
  'RAV5_DEMO_ADMIN_EMAIL',
  'RAV5_DEMO_ADMIN_PASSWORD',
  'RAV5_PUBLIC_SITE_URL',
  // Адрес приложения: «Открыть демо», «Вернуться в RAV5». docker-compose задаёт его всегда (APP_URL или PUBLIC_URL).
  'RAV5_APP_URL',
] as const

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    keycloakify({
      themeName: 'rav5',
      accountThemeImplementation: 'none',
      // Стенд — Keycloak 26: jar для 22–25 не собирается.
      keycloakVersionTargets: { '22-to-25': false, 'all-other-versions': 'rav5-theme.jar' },
      environmentVariables: THEME_ENV.map((name) => ({ name, default: '' })),
    }),
  ],
  resolve: {
    // @ — UI-kit и тексты apps/web, ~ — код темы.
    alias: { '@': src('../web/src'), '~': src('./src') },
    // Компоненты из apps/web должны брать зависимости отсюда: иначе в бандле окажутся две копии React.
    // react-router — только ради модулей UI-kit, где рядом с кнопкой лежит ссылка роутера; в бандл он не попадает.
    dedupe: ['react', 'react-dom', 'react-router', 'clsx', 'lucide-react', '@radix-ui/react-checkbox'],
  },
  server: {
    port: 5174,
    strictPort: true,
    // Vite по умолчанию не раздаёт файлы вне корня пакета.
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx и kc.gen.tsx — точка входа и сгенерированный код.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/kc.gen.tsx', 'src/login/mocks.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
