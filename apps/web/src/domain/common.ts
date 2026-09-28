/** Откуда взято значение: организатор, пользователь, допущение команды или расчёт. */
export type ValueSource = 'organizer' | 'user' | 'assumption' | 'computed'

/** Подтверждённость данных: подтверждено, частично (по аналогам), не подтверждено. */
export type DataConfidence = 'confirmed' | 'partial' | 'unconfirmed'

/** Дата-время в ISO 8601 (UTC). */
export type IsoDateTime = string

const ENTITY_ID = /^[\w-]{3,64}$/u

/** Похоже на id сущности из адреса: UUID API или код фикстуры (LOC-02, RB-0008); остальное — чужое значение. */
export const isEntityId = (value: string | null | undefined): value is string => value != null && ENTITY_ID.test(value)
