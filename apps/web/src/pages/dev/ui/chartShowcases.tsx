import { toEconomics } from '@/api/mappers/economics'
import { toSimulationRun } from '@/api/mappers/simulation'
import { BarChart } from '@/components/charts/BarChart'
import { RangeBar } from '@/components/charts/RangeBar'
import { StackedBar } from '@/components/charts/StackedBar'
import { cumulativeCashFlow, DEFAULT_MODEL_NORMS, type HourlyStat, type SimulationRun } from '@/domain'
import { EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { SIMULATION_RUNS } from '@/mocks/fixtures/simulationRuns.generated'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { sensitivityView } from '@/pages/projects/steps/economics/economicsTables'
import { sensitivityStep } from '@/pages/projects/steps/economics/economicsView'
import { TIME_SEGMENTS, timeSegments, tripShare } from '@/pages/projects/steps/simulation/charts/chartsModel'
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

/** Полоса времени парка по долям состояний прогона (kpis.fleet_shares) — как на вкладке 07a. */
function timeRow(key: string, title: string, shares: SimulationRun['fleetShares'], robots: number, stations: number) {
  const segments = timeSegments(shares)
  return { key, label: ps.time.row(`${title}: ${String(robots)}/${String(stations)}`, formatPercent(segments ? tripShare(segments) : 0)), values: segments ?? {} }
}

const economics = toEconomics(EVALUATION_LP01, 'RB-0008', { conditions: [], operationsPerDay: 2000 })
const raas = economics.scenarios.find((s) => s.acquisition === 'raas')
const cashFlow = raas ? cumulativeCashFlow(raas, economics.horizonYears) : []
const sensitivityRows = raas ? sensitivityView(raas, economics.scenarios.filter((s) => s !== raas), economics, null, DEFAULT_MODEL_NORMS).map((row) => row.range) : []

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
            timeRow('before', ps.charts.from.matching, needMore.before.fleetShares, needMore.from.robots, needMore.from.stations),
            timeRow('after', ps.charts.to.need_more, needMore.fleetShares, needMore.to.robots, needMore.to.stations),
          ]}
        />
      </ShowcaseSection>
      <ShowcaseSection title="RangeBar (08)">
        <RangeBar
          label={pe.sensitivity.title(sensitivityStep(DEFAULT_MODEL_NORMS.sensitivityShift))}
          valueLabel={pe.sensitivity.valueLabel}
          rows={sensitivityRows}
        />
      </ShowcaseSection>
    </div>
  )
}
