import type { LaunchItemType } from '@/domain'
import { ROUTE_PATHS } from '@/app/routePaths'
import { entryRef, type CatalogEntry } from '../catalogModel'

/** Метка типа в шапке колонки (D-56): у робота — подтип из данных, у позиции — INF · SW · SRV · SUP. */
const ITEM_TYPE_LABEL: Record<LaunchItemType, string> = { infrastructure: 'INF', software: 'SW', service: 'SRV', support: 'SUP' }

export const typeLabelOf = (entry: CatalogEntry): string =>
  entry.kind === 'robot' ? entry.robot.subtype : ITEM_TYPE_LABEL[entry.item.type]

/**
 * «Проверить на объекте» → окно «Новый проект» с выбранным решением (PRD 7.6, D-57). Окна A2 ещё нет:
 * адрес `/projects?new=1&solution=<id>` откроет его, когда экран проектов появится (D-75).
 */
export function checkOnSitePath(entry: CatalogEntry): string {
  const params = new URLSearchParams({ new: '1', solution: entryRef(entry).id })
  return `${ROUTE_PATHS.projects}?${params.toString()}`
}

/** Состояние перехода из каталога: выборка, к которой ведёт «← Назад к результатам». */
export interface CompareLocationState {
  readonly catalogSearch?: string
}

export function backToCatalogPath(state: unknown): string {
  const search = (state as CompareLocationState | null)?.catalogSearch
  return typeof search === 'string' && search.startsWith('?') ? `${ROUTE_PATHS.catalog}${search}` : ROUTE_PATHS.catalog
}
