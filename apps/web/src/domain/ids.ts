import type { LocationId } from './location'
import type { LocationProcessId } from './locationProcess'
import type { OperationClassCode } from './operationClass'
import type { ProcessCode } from './process'
import type { ProjectId } from './project'
import type { RobotId } from './robot'

/**
 * Идентификаторы из внешних строк — параметров адреса, `location.state`, сохранённого выбора.
 * Строка чужого вида — null: экран покажет «не найдено», а не отправит в сервис что попало.
 */
type RawId = string | null | undefined

const ID_TAIL = /^[\w-]+$/u
/** UUID сервиса API. Коды фикстур (PJ-01, LOC-02) остаются отдельной формой. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isId<P extends string>(prefix: P, value: RawId): value is `${P}-${string}` {
  return typeof value === 'string' && value.startsWith(`${prefix}-`) && ID_TAIL.test(value.slice(prefix.length + 1))
}

const isUuid = (value: RawId): value is string => typeof value === 'string' && UUID.test(value)

export const parseProjectId = (value: RawId): ProjectId | null => (isId('PJ', value) || isUuid(value) ? value : null)
export const parseLocationId = (value: RawId): LocationId | null => (isId('LOC', value) || isUuid(value) ? value : null)
export const parseLocationProcessId = (value: RawId): LocationProcessId | null => (isId('LP', value) || isUuid(value) ? value : null)
export const parseProcessCode = (value: RawId): ProcessCode | null => (isId('PR', value) ? value : null)
export const parseRobotId = (value: RawId): RobotId | null => (isId('RB', value) || isUuid(value) ? value : null)

/** Код класса операции из сохранённых данных (черновик формы): `OP-…`. */
export const isOperationClassCode = (value: unknown): value is OperationClassCode => typeof value === 'string' && isId('OP', value)
