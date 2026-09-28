import type { components as ApiComponents } from './generated/api'
import type { components as SimulationComponents } from './generated/simulation'

/** Схемы ответов services/api (packages/contracts/openapi/api.yaml). */
export type ApiSchemas = ApiComponents['schemas']
/** Схемы ответов services/simulation (services/simulation/docs/openapi.json). */
export type SimulationSchemas = SimulationComponents['schemas']

/** Ответ API не соответствует тому, что ждёт экран: нет обязательного поля или значение вне перечня. */
export class ContractError extends Error {
  override readonly name = 'ContractError'
}

/**
 * Обязательное поле ответа. В api.yaml у схем нет `required` (контракт генерируется из Go-структур),
 * поэтому обязательность проверяем здесь — с понятной ошибкой вместо `undefined` в интерфейсе.
 */
export function required<T extends object, K extends keyof T>(dto: T, key: K, entity: string): NonNullable<T[K]> {
  const value = dto[key]
  if (value === undefined || value === null) {
    throw new ContractError(`${entity}: в ответе API нет обязательного поля «${String(key)}»`)
  }
  return value
}

/** Необязательное поле: `undefined` и `null` → `null`. */
export const optional = <T>(value: T | null | undefined): T | null => value ?? null

/** Значение из перечня; иначе — ошибка контракта. */
export function oneOf<T extends string>(value: string, allowed: readonly T[], entity: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new ContractError(`${entity}: значение «${value}» не входит в перечень ${allowed.join(' | ')}`)
}
