import {
  parseLocationId, parseLocationProcessId, type Location, type LocationId, type LocationProcessId, type LocationSummary,
} from '@/domain'
import { formatDayOf, formatNumber, formatRubCompact } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.newProject

/**
 * Окно «Новый проект» живёт в адресе текущей страницы (D-84): `?new=1` открывает его поверх любой страницы,
 * `solution` — решение из каталога (D-57), `locationId` и `locationProcessId` — из карточки процесса (PRD 9.3).
 */
export const NEW_PROJECT_PARAMS = {
  open: 'new',
  solution: 'solution',
  location: 'locationId',
  locationProcess: 'locationProcessId',
} as const

export interface NewProjectContext {
  readonly solutionId?: string
  readonly locationId?: LocationId
  readonly locationProcessId?: LocationProcessId
}

export const isNewProjectOpen = (params: URLSearchParams): boolean => params.get(NEW_PROJECT_PARAMS.open) === '1'

/** Контекст из адреса; чужие значения отбрасываются — окно откроется без предвыбора. */
export function parseNewProjectContext(params: URLSearchParams): NewProjectContext {
  const solutionId = params.get(NEW_PROJECT_PARAMS.solution)?.trim()
  const locationId = parseLocationId(params.get(NEW_PROJECT_PARAMS.location))
  const locationProcessId = parseLocationProcessId(params.get(NEW_PROJECT_PARAMS.locationProcess))
  return {
    ...(solutionId ? { solutionId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(locationProcessId ? { locationProcessId } : {}),
  }
}

/** Адрес текущей страницы без параметров окна: так окно закрывается, а фильтры страницы остаются. */
export function withoutNewProject(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  Object.values(NEW_PROJECT_PARAMS).forEach((key) => { next.delete(key) })
  return next
}

/** `?…&new=1&solution=…` — открыть окно поверх текущей страницы, сохранив её параметры. */
export function withNewProject(params: URLSearchParams, context: NewProjectContext = {}): string {
  const next = withoutNewProject(params)
  next.set(NEW_PROJECT_PARAMS.open, '1')
  if (context.solutionId) next.set(NEW_PROJECT_PARAMS.solution, context.solutionId)
  if (context.locationId) next.set(NEW_PROJECT_PARAMS.location, context.locationId)
  if (context.locationProcessId) next.set(NEW_PROJECT_PARAMS.locationProcess, context.locationProcessId)
  return `?${next.toString()}`
}

export interface LocationChoice {
  readonly id: LocationId
  readonly name: string
  /** «склад · данные от 14.09.2026». */
  readonly caption: string
  readonly area: string
  readonly staff: string
  readonly labor: string
}

/**
 * Строки окна (16429:8). Площадь, персонал и ручной труд — из сводки локации, той же, что у дашборда
 * и карточек локаций: сумма четырёх строк = «Ручная работа на локациях» 591 млн ₽ (PRD 8.2, D-84).
 */
export function locationChoices(locations: readonly Location[], summaries: readonly LocationSummary[]): readonly LocationChoice[] {
  return locations.map((location) => {
    const summary = summaries.find((s) => s.locationId === location.id)
    const labor = summary && summary.processesCount > 0 ? summary.laborCostRubYear : null
    return {
      id: location.id,
      name: location.name,
      caption: t.caption(ru.facilityTypesLower[location.facilityType], formatDayOf(location.updatedAt)),
      area: summary?.totalAreaM2 == null ? t.noValue : t.area(formatNumber(summary.totalAreaM2)),
      staff: summary?.staffTotal == null ? t.noValue : t.staff(formatNumber(summary.staffTotal)),
      labor: labor === null ? t.noValue : formatRubCompact(labor, { perYear: true }),
    }
  })
}

/** Название черновика до выбора процесса на шаге 1 (D-84). */
export const draftName = (locationName: string): string => t.draftName(locationName)
