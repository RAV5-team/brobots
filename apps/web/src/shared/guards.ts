/** Проверки вида для данных извне — черновиков из браузера и т. п.: что прочитали, то и проверили, без `as`. */
export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
export const isString = (value: unknown): value is string => typeof value === 'string'
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
export const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export const isArrayOf = <T>(value: unknown, isItem: (item: unknown) => item is T): value is readonly T[] =>
  Array.isArray(value) && value.every(isItem)

/** Значение — один из вариантов списка: для union-типов из констант. */
export const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  options.some((option) => option === value)
