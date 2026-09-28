import type { ConditionRow, HourlyStat, ScenarioEconomics } from '@/domain'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { ColumnKey, ScenarioRow } from './economicsTables'
import { money } from './economicsView'

const t = ru.project.economics

/**
 * «Таблицы CSV» (PRD 11.6; ТЗ 3.7.3): сценарии, состав CAPEX и OPEX, условия — секциями одного файла
 * с теми же числами, что на экране.
 */
export function tablesCsv(
  columns: readonly { readonly key: ColumnKey; readonly label: string }[],
  rows: readonly ScenarioRow[],
  scenario: ScenarioEconomics,
  conditions: readonly ConditionRow[],
): readonly (readonly string[])[] {
  const c = t.conditions.columns
  return [
    [t.csv.sections.scenarios],
    ['', ...columns.map((col) => col.label)],
    ...rows.map((row) => [row.label, ...columns.map((col) => row.values[col.key])]),
    [],
    [t.csv.sections.items],
    [t.costs.itemsColumns.item, t.costs.itemsColumns.amount],
    [t.costs.capexGroup],
    ...scenario.capexItems.map((item) => [item.label, money(item.amountRub)]),
    [t.costs.opexGroup],
    ...scenario.opexItems.map((item) => [item.label, money(item.amountRub)]),
    [],
    [t.csv.sections.conditions],
    [c.parameter, c.value, c.status, c.impact, c.confirm],
    ...conditions.map((row) => [row.parameter, row.value, `${t.conditions.statuses[row.status]} · ${row.source}`, row.impact, row.howToConfirm]),
  ]
}

const share = (value: number | null): string => (value === null ? '' : formatNumber(value * 100, 1))

/** «Данные симуляции» (PRD 11.6; ТЗ 3.7.4): итоговый состав прогона по часам. */
export function hourlyCsv(hours: readonly HourlyStat[]): readonly (readonly string[])[] {
  return [
    t.csv.hourly,
    ...hours.map((h) => [
      String(h.hour).padStart(2, '0'),
      formatNumber(h.demand, 1),
      formatNumber(h.done, 1),
      share(h.onTime),
      h.waitMeanMin === null ? '' : formatNumber(h.waitMeanMin, 1),
      formatNumber(h.working, 1),
      formatNumber(h.charging, 1),
      formatNumber(h.waitingCharger, 1),
      formatNumber(h.down, 1),
      formatNumber(h.idle, 1),
      share(h.utilization),
    ]),
  ]
}
