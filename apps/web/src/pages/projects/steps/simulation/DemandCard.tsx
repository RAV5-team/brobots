import { BarChart } from '@/components/charts/BarChart'
import { ChartLegend } from '@/components/charts/ChartLegend'
import type { ChartSeries } from '@/components/charts/chartTones'
import { Card } from '@/components/ui/Card'
import { hourText } from '@/components/ui/hourText'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { calcMargin, heaviestHour, type DemandHour } from './hourlyDemand'

const t = ru.project.simulation.conditions.chart
const reference = ru.project.simulation.demand.reference

const SERIES: readonly ChartSeries[] = [{ key: 'trips', label: t.series, tone: 'muted' }]
/** Легенда тонов: обычный и пиковый час — одна серия, пик выделен тоном (D-102). */
const LEGEND: readonly ChartSeries[] = [
  { key: 'off-peak', label: t.offPeak, tone: 'muted' },
  { key: 'peak', label: t.peak, tone: 'strong' },
]
const BARS_HEIGHT = 150

interface DemandCardProps {
  readonly profile: readonly DemandHour[]
  /** Пиковая потребность, на которую рассчитан подбор; null — подбор её не посчитал. */
  readonly calcPeak: number | null
}

function summaryOf(calcPeak: number | null, heaviest: number): string {
  if (calcPeak === null) return t.noCalc
  const margin = calcMargin(calcPeak, heaviest)
  const calc = formatNumber(calcPeak)
  const top = formatNumber(heaviest)
  return margin >= 0 ? t.summary(calc, top, formatPercent(margin)) : t.summaryOver(calc, top, formatPercent(-margin))
}

/**
 * «Потребность по часам» (16197:1599; PRD 11.4): рейсы роботов по часам от начала смены, пиковые часы — тёмным,
 * пунктир — пик, на который рассчитан подбор. Числа — скрытой таблицей графика (D-87).
 */
export function DemandCard({ profile, calcPeak }: DemandCardProps) {
  const heaviest = heaviestHour(profile)
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="simulation-demand-title">
      <div className="flex items-center justify-between gap-16">
        <h2 id="simulation-demand-title" className="type-body font-medium text-text">{ru.project.simulation.demand.title}</h2>
        <div aria-hidden className="flex items-center gap-16">
          <ChartLegend series={LEGEND} />
          {calcPeak !== null && (
            <span className="flex items-center gap-6 type-caption text-text-secondary">
              <span className="w-12 border-t border-dashed border-border-control" />
              {reference}
            </span>
          )}
        </div>
      </div>
      <BarChart
        label={t.label}
        categoryLabel={t.category}
        series={SERIES}
        data={profile.map((h) => ({
          key: String(h.hour),
          label: t.hour(hourText(h.hour), h.isPeak, h.isWorking),
          values: [h.trips],
          highlight: h.isPeak,
        }))}
        formatValue={(v) => formatNumber(v)}
        height={BARS_HEIGHT}
        highlightTone="strong"
        showCategories={false}
        {...(calcPeak === null ? {} : { reference: { value: calcPeak, label: reference } })}
      />
      <p className="type-caption text-text-secondary">{summaryOf(calcPeak, heaviest)}</p>
    </Card>
  )
}
