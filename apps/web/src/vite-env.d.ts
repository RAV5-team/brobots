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
  /** Источник данных экранов: 'api' — services/api, иначе — моки на фикстурах. */
  readonly VITE_SERVICES?: string
  /** Origin services/api; пусто — тот же origin (прокси dev-сервера или шлюза). */
  readonly VITE_API_BASE_URL?: string
  /** Realm Keycloak: `http://localhost/auth/realms/rav5`; пусто — вход без Keycloak (гость и dev-режим api). */
  readonly VITE_OIDC_URL?: string
  /** Публичный клиент Keycloak фронтенда; по умолчанию rav5-web. */
  readonly VITE_OIDC_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
