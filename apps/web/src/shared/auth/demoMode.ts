import type { Role } from '@/domain'

/** Демо-сборка (D-16). В Vite флаг окружения обязан начинаться с VITE_. */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

/**
 * ?as=guest|user|admin — только в dev-режиме без Keycloak (e2e, vitest, /dev/screens). С Keycloak и в любой сборке
 * роль берётся только из токена: нет токена — гость (ролевая модель, §2).
 */
export const ALLOW_URL_ROLE = import.meta.env.DEV && !import.meta.env.VITE_OIDC_URL

/**
 * Демо-заполнение форм (имя «РЦ Химки», пример процесса 09а) — в dev-режиме и демо-сборке. В рабочей сборке формы
 * стартуют без этих текстов: предложенное имя при сохранении дало бы дубль (аудит 2026-09-28, §6).
 */
export const DEMO_FILL = import.meta.env.DEV || DEMO_MODE

/** Роль без входа (D-24): с Keycloak и в сборке — гость; в dev без Keycloak — пользователь. */
export const FALLBACK_ROLE: Role = import.meta.env.DEV && !import.meta.env.VITE_OIDC_URL ? 'user' : 'guest'

export const ROLE_STORAGE_KEY = 'rav5.role'
