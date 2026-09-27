import { specsCompleteness, type OperationClassCode, type Robot, type RobotId } from '@/domain'
import { ROUTE_PATHS } from '@/app/routePaths'
import { formatCount, formatDateOf, formatNumber, formatPercent, formatRubMillions } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.adminCatalog

/** «Сейчас» в колонке «Обновлено» — изменение не старше минуты (PRD 6.2, экран А3). */
const JUST_NOW_MS = 60_000

/** Строка таблицы А1: всё, что показывается, уже отформатировано; производные значения посчитаны (D-13). */
export interface CatalogRow {
  readonly id: RobotId
  readonly name: string
  /** «ООО «Морос» · Мобильные роботы». */
  readonly meta: string
  readonly needsConfirmation: boolean
  readonly operationClasses: readonly OperationClassCode[]
  /** «до 1 500 кг»; null — грузоподъёмности в ТТХ нет. */
  readonly payload: string | null
  /** «2,70 млн ₽»; null — цены нет. */
  readonly price: string | null
  readonly updated: string
  readonly completeness: string
  /** Для поиска: название и производитель (PRD 6.2). */
  readonly searchText: string
}

/** Поиск без учёта регистра и различия «е» / «ё». */
function normalize(text: string): string {
  return text.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim()
}

export function formatUpdated(iso: string, now: number): string {
  return Math.abs(now - Date.parse(iso)) < JUST_NOW_MS ? t.updatedNow : formatDateOf(iso)
}

function toRow(robot: Robot, now: number): CatalogRow {
  const { payloadKg } = robot.specs
  return {
    id: robot.id,
    name: robot.name,
    meta: `${robot.manufacturer} · ${robot.type}`,
    needsConfirmation: robot.needsConfirmation,
    operationClasses: robot.operationClasses.map((c) => c.code),
    payload: payloadKg === undefined ? null : t.payload(formatNumber(payloadKg)),
    price: robot.priceRub === null ? null : formatRubMillions(robot.priceRub),
    updated: formatUpdated(robot.updatedAt, now),
    completeness: formatPercent(specsCompleteness(robot.specs)),
    searchText: normalize(`${robot.name} ${robot.manufacturer}`),
  }
}

/** Параметр адреса состояния А3 «Робот добавлен»: список А1 с плашкой «Каталог обновлён» (D-22). */
export const ADDED_PARAM = 'added'

/** Куда вернуться после «Сохранить робота» на А2 (PRD 6.1). */
export function adminCatalogAddedPath(robotId: RobotId): string {
  return `${ROUTE_PATHS.adminCatalog}?${new URLSearchParams({ [ADDED_PARAM]: robotId }).toString()}`
}

/** Место в очереди: ждущие подтверждения → только что сохранённое решение (А3, 15966:6325) → остальные. */
function rank(robot: Robot, addedId: RobotId | null): number {
  if (robot.needsConfirmation) return 0
  return robot.id === addedId ? 1 : 2
}

/**
 * Строки каталога: сначала решения, которые ждут подтверждения, — это очередь работы администратора
 * (PRD 6.2, предложение «фильтры»), затем сохранённое на А2 решение (А3), дальше по идентификатору RB-NNNN, как в макете (D-36).
 */
export function buildCatalogRows(robots: readonly Robot[], now: number, addedId: RobotId | null = null): readonly CatalogRow[] {
  return [...robots]
    .sort((a, b) => rank(a, addedId) - rank(b, addedId) || a.id.localeCompare(b.id))
    .map((robot) => toRow(robot, now))
}

/** Поиск «Найти решение или производителя» — по названию и производителю (PRD 6.2). */
export function filterCatalogRows(rows: readonly CatalogRow[], query: string): readonly CatalogRow[] {
  const needle = normalize(query)
  return needle === '' ? rows : rows.filter((row) => row.searchText.includes(needle))
}

/** «Показаны 12 из 20 решений» — счётчик выдачи и полного объёма каталога. */
export function shownLabel(shown: number, total: number): string {
  return t.shown(shown, formatCount(total, ru.plural.solutionsOf))
}
