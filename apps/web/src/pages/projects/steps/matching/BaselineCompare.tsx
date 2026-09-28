import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CompareTable, type CompareCell, type CompareColumn, type CompareGroup } from '@/components/ui/CompareTable'
import type { MatchBaseline, RankedVariant } from '@/domain'
import { formatCount, formatPercent, formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.matching
const b = t.baseline

interface BaselineCompareProps {
  readonly baseline: MatchBaseline
  /** Покупка и RaaS выбранного (или рекомендованного) решения. */
  readonly scenarios: readonly RankedVariant[]
  readonly horizonYears: number
}

type Value = (v: RankedVariant) => string

const money = (value: number | null): string => (value === null ? '—' : formatRubCompact(value, { fractionDigits: 1 }))

/** Изменение расходов к текущему: «−16,7 млн ₽ (−33 %)». */
function change(v: RankedVariant, baseline: MatchBaseline): string {
  const delta = v.opexRubPerYear - baseline.opexRubPerYear
  const sign = delta > 0 ? '+' : ''
  return b.change(`${sign}${formatRubCompact(delta, { fractionDigits: 1 })}`, formatPercent(delta / baseline.opexRubPerYear, 0, { signed: true }))
}

/**
 * «Сравнить с текущим процессом: без роботов, покупка, RaaS» (PRD 11.3): свёрнутый блок, база — текущий процесс,
 * в рейтинге не участвует. Макета нет — `CompareTable` в раскрывающемся блоке (D-86).
 */
export function BaselineCompare({ baseline, scenarios, horizonYears }: BaselineCompareProps) {
  const first = scenarios[0]
  if (!first) return null
  const horizon = formatCount(horizonYears, t.plural.years)
  const current = 'current'
  const columns: CompareColumn[] = [
    { key: current, label: b.current, header: <span className="px-12 type-body font-semibold text-text">{b.current}</span> },
    ...scenarios.map((v) => {
      const label = b.scenario(t.acquisition[v.acquisition], formatCount(v.robots, ru.plural.robots))
      return { key: v.acquisition, label, header: <span className="px-12 type-body font-semibold text-text">{label}</span> }
    }),
  ]
  const row = (key: string, label: string, base: string, value: Value): CompareGroup['rows'][number] => ({
    key,
    label,
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
      row('raas', b.rows.raas, '—', (v) => (v.acquisition === 'raas' ? money(v.raasMonthlyRub) : '—')),
      row('opex', b.rows.opex, formatRubCompact(baseline.opexRubPerYear, { fractionDigits: 1 }), (v) => money(v.opexRubPerYear)),
      row('change', b.rows.change, b.base, (v) => change(v, baseline)),
      row('labor', b.rows.labor, '—', (v) => money(v.laborSavingsRubPerYear)),
      row('effect', b.rows.effect, '—', (v) => money(v.annualEffectRub)),
      row('payback', b.rows.payback, '—', (v) => (v.paybackYears === null ? t.ranking.notPaying : formatYears(v.paybackYears))),
      row('roi', b.rows.roi(horizon), '—', (v) => (v.roi === null ? '—' : formatPercent(v.roi))),
      row('tco', b.rows.tco(horizon), money(baseline.tcoRub), (v) => money(v.tcoRub)),
    ],
  }]
  return (
    <Card as="section" padding={24} gap={12} aria-labelledby="matching-baseline-title">
      <details className="group flex flex-col gap-12">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-16">
          <span className="flex flex-col gap-4">
            <span id="matching-baseline-title" className="type-heading text-text">{b.title}</span>
            <span className="type-caption text-text-secondary">{b.lead(first.solutionName, horizon)}</span>
          </span>
          <ChevronDown aria-hidden size={20} className="shrink-0 text-text-secondary transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-12 pt-12">
          <CompareTable caption={b.caption} columns={columns} groups={groups} labelWidth="compact" />
          <p className="type-caption text-text-secondary">{b.note}</p>
        </div>
      </details>
    </Card>
  )
}
