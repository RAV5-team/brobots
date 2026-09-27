import type { Role } from '@/domain'

/** Демо-сборка (D-16). В Vite флаг окружения обязан начинаться с VITE_. */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

/** ?as=guest|user|admin работает только в dev-режиме или демо-сборке (D-16). */
export const ALLOW_URL_ROLE = import.meta.env.DEV || DEMO_MODE

/** Роль по умолчанию до подключения авторизации (D-24). */
export const FALLBACK_ROLE: Role = import.meta.env.DEV ? 'user' : 'guest'

export const ROLE_STORAGE_KEY = 'rav5.role'
