import type { LocationId } from './location'
import type { ProcessCode, ProcessDefaults, ProcessHandling, ProcessTemplate } from './process'

/** В API — UUID задачи (`Task`), в фикстурах — LP-NN. */
export type LocationProcessId = string

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
  /** Поля формы 16 сверх значений по умолчанию, переопределённые на площадке (маршрут, среда, затраты). */
  readonly templateOverrides?: Partial<ProcessTemplate>
  /** Способы обработки груза и коэффициенты замещения на площадке; нет — как у шаблона. */
  readonly handling?: readonly ProcessHandling[] | undefined
  readonly workers: readonly ProcessWorkers[]
}

/**
 * Значения копии из формы 16 — `PATCH /tasks/{id}`. Класс операции и шаблон не входят:
 * класс наследуется из справочника и на локации не меняется (PRD 10.4).
 */
export type LocationProcessUpdate = Pick<LocationProcess, 'name' | 'overrides' | 'templateOverrides' | 'handling' | 'workers'>
