import type { Location, LocationId, Project, ProjectStep } from '@/domain'
import { ru } from '@/shared/i18n/ru'

/** Вкладки A1: все, черновики, готовые оценки (PRD 11.1). */
export type ProjectsTab = 'all' | 'draft' | 'saved'
export const PROJECTS_TABS: readonly ProjectsTab[] = ['all', 'draft', 'saved']

/** Вкладка и поиск — в адресе, выборкой можно поделиться (D-83). */
export interface ProjectsFilter {
  readonly tab: ProjectsTab
  readonly query: string
}

export const EMPTY_FILTER: ProjectsFilter = { tab: 'all', query: '' }

export interface ProjectRow {
  readonly project: Project
  readonly locationName: string
}

/** Короткое название стадии черновика: «остановились на: Итог» (PRD 11.1). */
const STAGE_LABELS: Record<ProjectStep, string> = {
  params: ru.projectStages.parameters,
  matching: ru.projectStages.selection,
  simulation: ru.projectStages.simulation,
  economics: ru.projectStages.result,
}

export const stageLabel = (step: ProjectStep): string => STAGE_LABELS[step]

const isTab = (value: string | null): value is ProjectsTab => PROJECTS_TABS.includes(value as ProjectsTab)

export function parseProjectsSearch(params: URLSearchParams): ProjectsFilter {
  const tab = params.get('tab')
  return { tab: isTab(tab) ? tab : 'all', query: params.get('q') ?? '' }
}

/** Пустые значения в адрес не пишутся: «/projects» — все проекты без поиска. */
export function toProjectsSearch({ tab, query }: ProjectsFilter): URLSearchParams {
  const params = new URLSearchParams()
  if (tab !== 'all') params.set('tab', tab)
  if (query.trim() !== '') params.set('q', query)
  return params
}

export function isFilterActive(filter: ProjectsFilter): boolean {
  return filter.tab !== EMPTY_FILTER.tab || filter.query.trim() !== ''
}

/** Строки таблицы в порядке сервиса (сначала недавно изменённые) с названием объекта. */
export function buildRows(projects: readonly Project[], locations: readonly Location[]): readonly ProjectRow[] {
  const names = new Map<LocationId, string>(locations.map((l) => [l.id, l.name]))
  return projects.map((project) => ({ project, locationName: names.get(project.locationId) ?? '' }))
}

/** Счётчики вкладок — по всем проектам, без учёта поиска: как на макете «Все 7 · Черновики 3 · Готовые оценки 4». */
export function countByTab(projects: readonly Project[]): Record<ProjectsTab, number> {
  const drafts = projects.filter((p) => p.status === 'draft').length
  return { all: projects.length, draft: drafts, saved: projects.length - drafts }
}

const normalize = (text: string): string => text.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim()

/** Вкладка и поиск по названию проекта и объекту (без учёта регистра и «ё»). */
export function filterRows(rows: readonly ProjectRow[], { tab, query }: ProjectsFilter): readonly ProjectRow[] {
  const needle = normalize(query)
  return rows.filter(
    ({ project, locationName }) =>
      (tab === 'all' || project.status === tab) &&
      (needle === '' || normalize(project.name).includes(needle) || normalize(locationName).includes(needle)),
  )
}
