/** Откуда взято значение: организатор, пользователь, допущение команды или расчёт. */
export type ValueSource = 'organizer' | 'user' | 'assumption' | 'computed'

/** Подтверждённость данных: подтверждено, частично (по аналогам), не подтверждено. */
export type DataConfidence = 'confirmed' | 'partial' | 'unconfirmed'

/** Дата-время в ISO 8601 (UTC). */
export type IsoDateTime = string
