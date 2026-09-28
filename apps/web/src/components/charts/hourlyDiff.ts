import type { HourlyTableRow } from './HourlyTable'

/** Показатель таблицы по часам (3.5): заголовок, подпись-требование и строки по составам («Из подбора», «С изменениями»). */
export interface HourlyTableMetric {
  readonly key: string
  /** «Выполнено, рейсов». */
  readonly label: string
  /** «требование — вся потребность часа». */
  readonly requirement?: string
  readonly rows: readonly HourlyTableRow[]
}

/** Группа показателей: «Нагрузка на парк», «Результат». */
export interface HourlyTableGroup {
  readonly key: string
  readonly title: string
  readonly metrics: readonly HourlyTableMetric[]
}

/**
 * Составы различаются в показателе, если хоть в одном часе у строк разные значения (как показаны, после округления).
 * Одна строка — сравнивать не с чем, показатель различается (состав один — видно всё).
 */
export function isDiffering(metric: HourlyTableMetric): boolean {
  const [first, ...rest] = metric.rows
  if (!first || rest.length === 0) return true
  return rest.some((row) => row.cells.length !== first.cells.length || row.cells.some((cell, i) => cell.value !== first.cells[i]?.value))
}

/**
 * Фильтр «только различающиеся строки» (3.5, proposed): `hidden` — сколько показателей скрыл бы фильтр, считается
 * всегда (для «Показать все строки · N»); при `apply` показатели без различий убраны, пустые группы — тоже.
 */
export function filterDiffering(groups: readonly HourlyTableGroup[], apply: boolean): { readonly groups: readonly HourlyTableGroup[]; readonly hidden: number } {
  const hidden = groups.reduce((sum, g) => sum + g.metrics.filter((m) => !isDiffering(m)).length, 0)
  if (!apply) return { groups, hidden }
  const visible = groups.map((g) => ({ ...g, metrics: g.metrics.filter(isDiffering) })).filter((g) => g.metrics.length > 0)
  return { groups: visible, hidden }
}
