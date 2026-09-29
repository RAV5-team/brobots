import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Шрифты — в ресурсах темы: CSP Keycloak не пускает внешние источники. Набор как в apps/web (D-08).
import '@fontsource/onest/400.css'
import '@fontsource/onest/500.css'
import '@fontsource/onest/600.css'
import '@fontsource/unbounded/300.css'
import './main.css'
// Иконка общая с приложением. Из JS, а не из index.html: так keycloakify подставит путь к ресурсам темы.
import faviconUrl from '../../web/public/favicon.svg'
import { KcPage } from './kc.gen'

// В dev-сервере Keycloak нет: страница берётся из мока, ?page=register.ftl и ?demo=1 (login/mocks.ts).
if (import.meta.env.DEV && !window.kcContext) {
  const { mockFromSearch } = await import('./login/mocks')
  window.kcContext = mockFromSearch(window.location.search)
}

const icon = document.createElement('link')
icon.rel = 'icon'
icon.type = 'image/svg+xml'
icon.href = faviconUrl
document.head.append(icon)

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Не найден элемент #root в index.html')
const { kcContext } = window
if (!kcContext) throw new Error('Страница открыта не из Keycloak: нет kcContext')

createRoot(rootElement).render(
  <StrictMode>
    <KcPage kcContext={kcContext} />
  </StrictMode>,
)
