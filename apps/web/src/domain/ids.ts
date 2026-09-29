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

function isId<P extends string>(prefix: P, value: RawId): value is `${P}-${string}` {
  return typeof value === 'string' && value.startsWith(`${prefix}-`) && ID_TAIL.test(value.slice(prefix.length + 1))
}

export const parseProjectId = (value: RawId): ProjectId | null => (isId('PJ', value) ? value : null)
export const parseLocationId = (value: RawId): LocationId | null => (isId('LOC', value) ? value : null)
export const parseLocationProcessId = (value: RawId): LocationProcessId | null => (isId('LP', value) ? value : null)
export const parseProcessCode = (value: RawId): ProcessCode | null => (isId('PR', value) ? value : null)
export const parseRobotId = (value: RawId): RobotId | null => (isId('RB', value) ? value : null)

/** Код класса операции из сохранённых данных (черновик формы): `OP-…`. */
export const isOperationClassCode = (value: unknown): value is OperationClassCode => typeof value === 'string' && isId('OP', value)
