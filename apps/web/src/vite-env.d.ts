/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true' — демо-сборка: плашки демо-доступа и ?as= (D-16). */
  readonly VITE_DEMO_MODE?: string
  /** Демо-учётки жюри для экрана входа 05 — читаются только при VITE_DEMO_MODE (D-16). */
  readonly VITE_DEMO_USER_EMAIL?: string
  readonly VITE_DEMO_USER_PASSWORD?: string
  readonly VITE_DEMO_ADMIN_EMAIL?: string
  readonly VITE_DEMO_ADMIN_PASSWORD?: string
  /** Адрес публичного сайта для ссылки «Публичный сайт RAV5» на экране входа (D-28). */
  readonly VITE_PUBLIC_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
