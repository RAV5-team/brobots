import { BarChart } from '@/components/charts/BarChart'
import { ChartLegend, type LegendItem } from '@/components/charts/ChartLegend'
import type { ChartSeries } from '@/components/charts/chartTones'
import { Card, CardTitle } from '@/components/ui/Card'
import { hourText } from '@/components/ui/hourText'
import { formatCount, formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { calcMargin, heaviestHour, type DemandHour } from './hourlyDemand'

const t = ru.project.simulation.conditions.chart
const peaks = ru.project.simulation.conditions.peaks
const reference = ru.project.simulation.demand.reference

/** Стопка «приёмка + отгрузка» (3.2): высота столбца — сумма, сравнение с пунктиром пика подбора честное. */
const SERIES: readonly ChartSeries[] = [
  { key: 'inbound', label: peaks.inbound.toLocaleLowerCase('ru'), tone: 'strong' },
  { key: 'outbound', label: peaks.outbound.toLocaleLowerCase('ru'), tone: 'secondary' },
]
const LEGEND: readonly LegendItem[] = [
  ...SERIES.map((s) => ({ ...s, marker: 'dot' as const })),
  { key: 'reference', label: reference, tone: 'danger', marker: 'dash' },
]
const BARS_HEIGHT = 120
/** Подпись каждого шестого часа и последнего: 07 · 13 · 19 · 01 · 06. */
const AXIS_STEP = 6

const trips = (n: number): string => formatCount(Math.round(n), t.trips)

function heaviestText(calcPeak: number | null, heaviest: number): string {
  if (calcPeak === null) return trips(heaviest)
  const margin = calcMargin(calcPeak, heaviest)
  return margin >= 0 ? trips(heaviest) : t.over(trips(heaviest), formatPercent(-margin))
}

interface DemandCardProps {
  readonly profile: readonly DemandHour[]
  /** Пиковая потребность, на которую рассчитан подбор; null — подбор её не посчитал. */
  readonly calcPeak: number | null
}

/**
 * «Потребность по часам» в правой колонке 3.2 (16404:1782; PRD 11.4): рейсы роботов по часам от начала смены стопкой
 * «приёмка + отгрузка», красный пунктир — пик подбора; под графиком — пик подбора и самый тяжёлый час сценария.
 * Числа — скрытой таблицей графика (D-87).
 */
export function DemandCard({ profile, calcPeak }: DemandCardProps) {
  const heaviest = heaviestHour(profile)
  const last = profile.length - 1
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="simulation-demand-title">
      <CardTitle as="h2" id="simulation-demand-title">{ru.project.simulation.demand.title}</CardTitle>
      <BarChart
        label={t.label}
        categoryLabel={t.category}
        series={SERIES}
        stacked
        data={profile.map((h, i) => ({
          key: String(h.hour),
          label: t.hour(hourText(h.hour), h.isPeak, h.isWorking),
          axisLabel: i % AXIS_STEP === 0 || i === last ? hourText(h.hour) : '',
          values: [h.inbound, h.outbound],
        }))}
        formatValue={(v) => formatNumber(v)}
        height={BARS_HEIGHT}
        {...(calcPeak === null ? {} : { reference: { value: calcPeak, label: reference, tone: 'danger' as const } })}
      />
      <ChartLegend series={calcPeak === null ? LEGEND.slice(0, SERIES.length) : LEGEND} shape="dot" className="gap-x-12 gap-y-4" />
      <dl className="flex flex-col gap-12 border-t border-border pt-12">
        <div className="flex flex-col gap-4">
          <dt className="type-caption text-text-secondary">{t.calc}</dt>
          <dd className="type-body font-semibold text-text">{calcPeak === null ? t.noCalc : t.calcValue(trips(calcPeak))}</dd>
        </div>
        <div className="flex flex-col gap-4">
          <dt className="type-caption text-text-secondary">{t.heaviest}</dt>
          <dd className="type-body font-semibold text-text">{heaviestText(calcPeak, heaviest)}</dd>
        </div>
      </dl>
    </Card>
  )
}
