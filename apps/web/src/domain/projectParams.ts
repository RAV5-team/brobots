import type { FacilityParameter, ParameterValue } from './facility'
import type { HandlingMethod } from './handling'
import type { Location } from './location'
import type { LocationProcess } from './locationProcess'
import type { OperationClass } from './operationClass'
import type { Process } from './process'

/**
 * Происхождение значения на шаге 1 (PRD 11.2): из файла организатора, указано пользователем, из профиля локации,
 * рассчитано, предварительно (формула с допущениями), допущение (по нормативу), нет данных.
 */
export type ValueOrigin = 'file' | 'specified' | 'location' | 'computed' | 'preliminary' | 'assumption' | 'missing'

/**
 * Что делает незаполненное значение с подбором (PRD 11.2, «Правила готовности к подбору»):
 * blocks — подбор недоступен; needs_check — решения получат «Требует проверки»; no_labor_saving — экономия труда не рассчитается.
 * Критичность должна задаваться справочником параметров процесса (9.2) — пока зашита в код (D-91).
 */
export type MissingImpact = 'blocks' | 'needs_check' | 'no_labor_saving'

/** Незаполненное значение: где его заполнить — в профиле локации (site) или в процессе на локации (process). */
export interface MissingValue {
  readonly code: string
  readonly scope: 'site' | 'process'
  readonly impact: MissingImpact
}

/** Группы параметров площадки для подбора (PRD 10.5, «полный состав»; D-92). */
export const SITE_GROUPS = ['aisles', 'floor', 'layout', 'operating', 'connectivity'] as const
export type SiteGroup = (typeof SITE_GROUPS)[number]

/** Параметр площадки для подбора (PRD 10.5, коды — 10.6 и датасет склада). */
export interface SiteParameterDef {
  readonly code: string
  /** Второе значение той же строки: температура «от … до» (`site_temp_max_c`). */
  readonly pairCode?: string
  readonly group: SiteGroup
  readonly name: string
  readonly unit: string
  /** Применим только к процессам с маршрутом (D-93): у упаковки скрыт. */
  readonly routeOnly: boolean
  /** Нет данных — подбор помечает зависящие решения «Требует проверки»; false — справочное значение (2D-схема, CAPEX). */
  readonly checkedByMatching: boolean
}

/** Процесс локации на шаге 1: копия на площадке, её шаблон и класс операции из справочника А8. */
export interface ParamsProcessEntry {
  readonly locationProcess: LocationProcess
  readonly process: Process
  readonly operationClass: OperationClass | null
}

/**
 * Снимок входных данных шага 1 (`GET /projects/{id}/snapshot` + процессы локации): значения показываются только для чтения,
 * меняются в профиле локации и процесса. Сохранённая оценка использует снимок на дату `versions.snapshotAt` (PRD 11.1).
 */
export interface ProjectParamsSnapshot {
  readonly location: Location
  /** Параметры типа объекта из датасета — для исполнителей и значений по умолчанию. */
  readonly facilityParameters: readonly FacilityParameter[]
  readonly siteParameters: readonly SiteParameterDef[]
  /** Значения параметров площадки по коду; нет кода — «нет данных». */
  readonly siteValues: Readonly<Record<string, ParameterValue>>
  readonly processes: readonly ParamsProcessEntry[]
  readonly handlingMethods: readonly HandlingMethod[]
  /** Решение из каталога («Проверить на объекте», D-57): подбор начнёт с него. */
  readonly pinnedSolution: { readonly id: string; readonly name: string } | null
  /** Норматив А5 `width_margin_m` на дату снимка: запас по ширине прохода, если у шаблона процесса своего нет. */
  readonly widthMarginM: number
}

/** Готовность процесса к подбору (PRD 11.2). */
export interface ParamsReadiness {
  /** false — не хватает значения, без которого не посчитать парк: кнопка подбора неактивна. */
  readonly canMatch: boolean
  readonly blocking: readonly MissingValue[]
  /** Параметры площадки без данных: решения, зависящие от них, получат «Требует проверки». */
  readonly siteChecks: readonly MissingValue[]
  readonly laborSaving: readonly MissingValue[]
  readonly missingCount: number
  readonly assumptionsCount: number
}

/** Правило готовности (PRD 11.2): блокирует только значение с impact «blocks», остальное — предупреждения. */
export function paramsReadiness(missing: readonly MissingValue[], assumptionsCount: number): ParamsReadiness {
  const blocking = missing.filter((m) => m.impact === 'blocks')
  return {
    canMatch: blocking.length === 0,
    blocking,
    siteChecks: missing.filter((m) => m.impact === 'needs_check'),
    laborSaving: missing.filter((m) => m.impact === 'no_labor_saving'),
    missingCount: missing.length,
    assumptionsCount,
  }
}
