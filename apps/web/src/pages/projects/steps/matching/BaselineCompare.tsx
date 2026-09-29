import { Card } from '@/components/ui/Card'
import { CompareTable, type CompareCell, type CompareColumn, type CompareGroup } from '@/components/ui/CompareTable'
import { Disclosure } from '@/components/ui/Disclosure'
import type { MatchBaseline, RankedVariant } from '@/domain'
import { formatCount, formatNumber, formatPercent, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { PeakDemand } from '../params/paramsModel'
import { rubMillions } from './matchingModel'

const t = ru.project.matching
const b = t.baseline

interface BaselineCompareProps {
  readonly baseline: MatchBaseline
  /** Покупка и RaaS выбранного (или рекомендованного) решения. */
  readonly scenarios: readonly RankedVariant[]
  readonly horizonYears: number
  /** Объём процесса в сутки — в подписи «2 000 паллет/сутки»; null — не посчитан. */
  readonly demand: PeakDemand | null
}

type Value = (v: RankedVariant) => string

const money = (value: number | null, digits = 1): string => rubMillions(value, digits)

/** Изменение расходов к текущему: «−16,7 млн ₽ (−33 %)». */
function change(v: RankedVariant, baseline: MatchBaseline): string {
  const delta = v.opexRubPerYear - baseline.opexRubPerYear
  const sign = delta > 0 ? '+' : ''
  return b.change(`${sign}${money(delta)}`, formatPercent(delta / baseline.opexRubPerYear, 0, { signed: true }))
}

/**
 * «Сравнение с текущим процессом» (16743:2; PRD 11.3): раскрыто по умолчанию; колонки — текущий процесс (база, в рейтинге
 * не участвует), покупка и RaaS решения; у показателя и колонки — подпись второй строкой.
 */
export function BaselineCompare({ baseline, scenarios, horizonYears, demand }: BaselineCompareProps) {
  const first = scenarios[0]
  if (!first) return null
  const horizon = formatCount(horizonYears, t.plural.years)
  const current = 'current'
  const header = (label: string) => <span className="px-12 type-overline text-text-muted">{label}</span>
  const columns: CompareColumn[] = [
    { key: current, label: b.current, header: header(b.current), caption: b.currentCaption },
    ...scenarios.map((v): CompareColumn => {
      const label = v.acquisition === 'raas' ? b.raas : b.purchase
      return { key: v.acquisition, label, header: header(label), caption: v.acquisition === 'raas' ? b.raasCaption : formatCount(v.robots, ru.plural.robots) }
    }),
  ]
  const row = (key: string, [label, caption]: readonly [string, string?], base: string, value: Value): CompareGroup['rows'][number] => ({
    key,
    label,
    ...(caption === undefined ? {} : { caption }),
    cells: [
      { key: current, tone: 'panel', content: base },
      ...scenarios.map((v): CompareCell => ({ key: v.acquisition, content: value(v) })),
    ],
  })
  const groups: CompareGroup[] = [{
    key: 'baseline',
    title: first.solutionName,
    rows: [
      row('capex', b.rows.capex, '—', (v) => money(v.capexRub)),
      row('raas', b.rows.raas, '—', (v) => (v.acquisition === 'raas' ? money(v.raasMonthlyRub, 2) : '—')),
      row('opex', b.rows.opex, money(baseline.opexRubPerYear), (v) => money(v.opexRubPerYear)),
      row('change', b.rows.change, b.base, (v) => change(v, baseline)),
      row('labor', b.rows.labor, '—', (v) => money(v.laborSavingsRubPerYear)),
      row('effect', b.rows.effect, '—', (v) => money(v.annualEffectRub)),
      row('payback', b.rows.payback, '—', (v) => (v.paybackYears === null ? t.ranking.notPaying : formatYears(v.paybackYears))),
      row('roi', [b.rows.roi(horizon)], '—', (v) => (v.roi === null ? '—' : formatPercent(v.roi))),
      row('tco', [b.rows.tco(horizon)], money(baseline.tcoRub), (v) => money(v.tcoRub)),
    ],
  }]
  const lead = [first.solutionName, demand === null ? null : b.perDay(formatNumber(demand.perDay), demand.unit), b.horizon(horizon)]
    .filter((part): part is string => part !== null)
    .join(' · ')
  return (
    <Card as="section" padding={28} gap={20} aria-label={b.title}>
      <Disclosure title={b.title} caption={b.lead(lead)} headingLevel={2} defaultOpen>
        <div className="flex flex-col gap-12">
          <CompareTable caption={b.caption} columns={columns} groups={groups} labelWidth="compact" />
          <p className="type-caption text-text-secondary">{b.note}</p>
        </div>
      </Disclosure>
    </Card>
  )
}
