/** Откуда экраны берут данные: services/api или моки на фикстурах (переключатель VITE_SERVICES). */
export type ServicesMode = 'api' | 'mock'

export const SERVICES_MODE: ServicesMode = import.meta.env.VITE_SERVICES === 'api' ? 'api' : 'mock'

/** Префикс API services/api; origin пустой — запросы идут в тот же origin через прокси. */
export const API_BASE_URL = `${(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')}/api/v1`
