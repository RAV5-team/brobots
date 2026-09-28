import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
// Шрифты раздаются локально (D-08): Onest 400/500/600, Unbounded 300.
// Браузер скачивает только нужные подмножества по unicode-range: кириллица и латиница,
// latin-ext — лишь когда на странице есть ₽ (U+20BD лежит в этом подмножестве).
import '@fontsource/onest/400.css'
import '@fontsource/onest/500.css'
import '@fontsource/onest/600.css'
import '@fontsource/unbounded/300.css'
import '@/styles/global.css'
import { initAuth } from '@/shared/auth/oidc'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Не найден элемент #root в index.html')
const root = rootElement

// Роль и токен нужны первому же запросу экрана: рендер — после проверки сессии Keycloak (без Keycloak — сразу).
void initAuth().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
