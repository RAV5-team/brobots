import { BarChart } from '@/components/charts/BarChart'
import type { ChartSeries } from '@/components/charts/chartTones'
import { breakEvenYear } from '@/domain'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { cashFlowMillions } from '../../steps/economics/economicsTables'
import { acquisitionName } from '../../steps/economics/economicsView'
import type { ReportContext } from '../reportModel'
import { ReportSection } from '../ReportSection'

const t = ru.report.cashFlow
const c = ru.project.economics.cashFlow

/**
 * 8. Денежный поток (PRD 11.6): накопленный поток обоих сценариев по годам — `BarChart wide` парами (D-87),
 * те же числа, что над столбцами итога 08 (`cashFlowMillions`); выбранный сценарий — тёмной серией.
 */
export function CashFlowSection({ ctx }: { readonly ctx: ReportContext }) {
  const { scenarios, economics } = ctx
  const flows = scenarios.map((s) => cashFlowMillions(s, economics.horizonYears))
  const series: readonly ChartSeries[] = scenarios.map((s) => ({
    key: s.acquisition,
    label: acquisitionName(s.acquisition),
    tone: s.acquisition === ctx.selected ? 'strong' : 'muted',
  }))
  const years = Array.from({ length: economics.horizonYears + 1 }, (_, i) => i)
  return (
    <ReportSection n={8} sectionKey="cashFlow" lead={t.lead(ctx.horizon)}>
      <div className="flex flex-col gap-12 break-inside-avoid">
        <BarChart
          label={t.label}
          categoryLabel={c.yearHeader}
          series={series}
          data={years.map((year) => ({ key: String(year), label: c.year(year), values: flows.map((flow) => flow[year] ?? 0) }))}
          formatValue={(value) => formatNumber(value, 1, { signed: true, fixed: true })}
          density="wide"
          showValues
          legend
        />
      </div>
      <ul className="flex flex-col gap-4">
        {scenarios.map((s) => {
          const year = breakEvenYear(s.paybackYears)
          return (
            <li key={s.acquisition} className="type-body-sm text-text-secondary">
              {t.breakEven(acquisitionName(s.acquisition), year !== null && year <= economics.horizonYears ? c.breakEven(year) : c.never)}
            </li>
          )
        })}
      </ul>
    </ReportSection>
  )
}
