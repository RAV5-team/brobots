import { toEconomics } from '@/api/mappers/economics'
import { toSimulationRun } from '@/api/mappers/simulation'
import { BarChart } from '@/components/charts/BarChart'
import { RangeBar } from '@/components/charts/RangeBar'
import { StackedBar } from '@/components/charts/StackedBar'
import type { ChartSeries } from '@/components/charts/chartTones'
import { cumulativeCashFlow, type HourlyStat, type SimulationRun } from '@/domain'
import { SENSITIVITY_LP01_RAAS } from '@/mocks/fixtures/projectEconomics'
import { EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { SIMULATION_RUNS } from '@/mocks/fixtures/simulationRuns.generated'
import { formatNumber, formatPercent, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ShowcaseSection } from './StateGrid'

const ps = ru.project.simulation
const pe = ru.project.economics
const M = 1_000_000
/** Цель «паллет в срок» по умолчанию (PRD 11.4, этап 2): ниже — нарушение часа. */
const ON_TIME_TARGET = 0.95

const run = (status: string): SimulationRun => {
  const dto = SIMULATION_RUNS.find((r) => r.status === status)
  if (!dto) throw new Error(`Фикстура прогона ${status} не найдена`)
  return toSimulationRun(dto)
}
const confirmed = run('confirmed')
const needMore = run('needs_additions')
const hourLabel = (h: HourlyStat) => String(h.hour).padStart(2, '0')

const TIME_SEGMENTS: readonly ChartSeries[] = [
  { key: 'working', label: ps.time.working, tone: 'strong' },
  { key: 'charging', label: ps.time.charging, tone: 'accent' },
  { key: 'waitingCharger', label: ps.time.waitingCharger, tone: 'danger' },
  { key: 'down', label: ps.time.down, tone: 'danger-soft' },
  { key: 'idle', label: ps.time.idle, tone: 'subtle' },
]

/** Робото-часы по состояниям за сутки — сумма почасовых средних. */
function timeRow(key: string, title: string, rows: readonly HourlyStat[], robots: number, stations: number) {
  const sum = (pick: (h: HourlyStat) => number) => rows.reduce((total, h) => total + pick(h), 0)
  const values = { working: sum((h) => h.working), charging: sum((h) => h.charging), waitingCharger: sum((h) => h.waitingCharger), down: sum((h) => h.down), idle: sum((h) => h.idle) }
  const total = Object.values(values).reduce((a, b) => a + b, 0)
  return { key, label: ps.time.row(title, robots, stations, formatPercent(values.working / total)), values }
}

const economics = toEconomics(EVALUATION_LP01, 'RB-0008', { sensitivity: SENSITIVITY_LP01_RAAS, conditions: [], operationsPerDay: 2000 })
const raas = economics.scenarios.find((s) => s.acquisition === 'raas')
const cashFlow = raas ? cumulativeCashFlow(raas, economics.horizonYears) : []

/** Графики шагов проекта (D-87) на фикстурах: 05, 07a, 08. Свой SVG на токенах, текстовая альтернатива — таблица. */
export function ChartsShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="BarChart · single (05)">
        <BarChart
          label={ps.demand.title}
          categoryLabel={ps.hourly.hour}
          series={[{ key: 'demand', label: ps.demand.series, tone: 'muted' }]}
          highlightTone="strong"
          data={confirmed.hourlyAfter.map((h) => ({ key: hourLabel(h), label: hourLabel(h), values: [h.demand], highlight: h.demand >= confirmed.peak.requiredPerHour }))}
          reference={{ value: confirmed.peak.requiredPerHour, label: ps.demand.reference }}
          formatValue={(v) => formatNumber(v)}
        />
      </ShowcaseSection>
      <ShowcaseSection title="BarChart · paired (07a)">
        <BarChart
          label={ps.load.title}
          categoryLabel={ps.hourly.hour}
          series={[{ key: 'demand', label: ps.load.demand, tone: 'muted' }, { key: 'done', label: ps.load.done, tone: 'strong' }]}
          data={needMore.hourlyBefore.map((h) => ({
            key: hourLabel(h),
            label: hourLabel(h),
            values: [h.demand, h.done],
            highlight: h.demand >= needMore.peak.requiredPerHour,
            violation: h.onTime !== null && h.onTime < ON_TIME_TARGET,
          }))}
          formatValue={(v) => formatNumber(v)}
          height={120}
          legend
        />
      </ShowcaseSection>
      <ShowcaseSection title="BarChart · negative (08)">
        <BarChart
          label={pe.cashFlow.title}
          categoryLabel={pe.cashFlow.yearHeader}
          series={[{ key: 'flow', label: pe.cashFlow.series, tone: 'strong' }]}
          data={cashFlow.map((v, year) => ({ key: String(year), label: pe.cashFlow.year(year), values: [v / M] }))}
          formatValue={(v) => formatNumber(v, 1, { fixed: true, signed: true })}
          showValues
          density="wide"
        />
      </ShowcaseSection>
      <ShowcaseSection title="StackedBar (07a)">
        <StackedBar
          label={ps.time.title}
          segments={TIME_SEGMENTS}
          formatShare={(s) => formatPercent(s)}
          rows={[
            timeRow('before', ps.time.fromMatching, needMore.hourlyBefore, needMore.from.robots, needMore.from.stations),
            timeRow('after', ps.time.recommended, needMore.hourlyAfter, needMore.to.robots, needMore.to.stations),
          ]}
        />
      </ShowcaseSection>
      <ShowcaseSection title="RangeBar (08)">
        <RangeBar
          label={pe.sensitivity.title}
          valueLabel={pe.sensitivity.valueLabel}
          rows={economics.sensitivity.map((row) => ({
            key: row.parameter,
            label: row.parameter,
            from: Math.min(row.paybackYears.minus20, row.paybackYears.plus20),
            to: Math.max(row.paybackYears.minus20, row.paybackYears.plus20),
            valueText: `${formatNumber(Math.min(row.paybackYears.minus20, row.paybackYears.plus20), 1)} — ${formatYears(Math.max(row.paybackYears.minus20, row.paybackYears.plus20))}`,
          }))}
        />
      </ShowcaseSection>
    </div>
  )
}
