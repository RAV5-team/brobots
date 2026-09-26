import type { LocationId } from './location'
import type { ProcessCode, ProcessDefaults } from './process'

export type LocationProcessId = `LP-${string}`

/** Исполнители процесса на площадке и доля их времени на процессе. */
export interface ProcessWorkers {
  readonly role: string
  readonly timeShare: number
}

/**
 * Процесс в локации — копия шаблона, привязанная к локации (D-11).
 * Правка и удаление не меняют шаблон и другие локации.
 */
export interface LocationProcess {
  readonly id: LocationProcessId
  readonly locationId: LocationId
  readonly processCode: ProcessCode
  /** Название на площадке, если отличается от шаблона. */
  readonly name: string | null
  /** Значения, переопределённые на площадке. */
  readonly overrides: Partial<ProcessDefaults>
  readonly workers: readonly ProcessWorkers[]
}
