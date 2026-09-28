import { BarChart } from '@/components/charts/BarChart'
import { Card } from '@/components/ui/Card'
import { breakEvenYear, type ScenarioEconomics } from '@/domain'
import { formatCount, formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { cashFlowMillions } from './economicsTables'
import { acquisitionName } from './economicsView'

const t = ru.project.economics.cashFlow
const YEARS = ru.project.matching.plural.years

/**
 * «Денежный поток, накопленный» (16197:2186; PRD 11.5): год 0 — минус вложения, дальше + годовой эффект,
 * без дисконтирования. `BarChart` с отрицательными значениями (D-87); точка окупаемости — строкой под графиком.
 */
export function CashFlowCard({ scenario, horizonYears }: { readonly scenario: ScenarioEconomics; readonly horizonYears: number }) {
  const flow = cashFlowMillions(scenario, horizonYears)
  const year = breakEvenYear(scenario.paybackYears)
  return (
    <Card as="section" padding={24} gap={12} aria-labelledby="economics-cashflow-title">
      <div className="flex items-baseline justify-between gap-16">
        <h2 id="economics-cashflow-title" className="type-heading text-text">{t.title}</h2>
        <p className="type-caption text-text-secondary">{t.caption(formatCount(horizonYears, YEARS))}</p>
      </div>
      <BarChart
        label={t.label(acquisitionName(scenario.acquisition))}
        categoryLabel={t.yearHeader}
        series={[{ key: 'flow', label: t.series, tone: 'strong' }]}
        data={flow.map((value, index) => ({ key: String(index), label: t.year(index), values: [value] }))}
        formatValue={(value) => formatNumber(value, 1, { signed: true, fixed: true })}
        density="wide"
        showValues
      />
      <p className="type-caption text-text-secondary">{year !== null && year <= horizonYears ? t.breakEven(year) : t.never}</p>
    </Card>
  )
}
