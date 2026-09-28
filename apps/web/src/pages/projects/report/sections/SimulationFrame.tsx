import { ChartLegend } from '@/components/charts/ChartLegend'
import { robotLegend } from '@/components/charts/robotGroups'
import { SimPlayer2D } from '@/components/charts/SimPlayer2D'
import { traceDuration, type SimulationRun } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { clockOf, fleetCaption, initialTime, type ChartFleet } from '../../steps/simulation/charts/chartsModel'
import { useRunTraces } from '../../steps/simulation/charts/useRunTraces'

const t = ru.report.simulation
const player = ru.project.simulation.player
const LEGEND = robotLegend(player.groups)

/**
 * Кадр 2D-схемы (PRD 15 · №132, ТЗ 3.7.4; D-107): те же `SimPlayer2D`, что на 07a, на паузе в первом пиковом часе —
 * для обоих составов в один момент. Кадр — на границе часа, поэтому хватает почасового среза трасс (около 50 КБ
 * вместо 1,6–1,8 МБ записи): позиции в нём те же, что в полной трассе. Без трасс раздел остаётся без кадра.
 */
export function SimulationFrame({ run, fleets }: { readonly run: SimulationRun; readonly fleets: readonly ChartFleet[] }) {
  const { load } = useRunTraces(run.id, 'hourly')
  if (load.status === 'loading') return <p aria-busy="true" className="type-body-sm text-text-secondary">{t.frameLoading}</p>
  if (load.status === 'error') return <p className="type-body-sm text-text-secondary">{t.frameError}</p>
  const pairs = fleets.flatMap((fleet, i) => {
    const trace = load.traces.find((tr) => tr.robots === fleet.fleet.robots && tr.chargers === fleet.fleet.stations) ?? load.traces[i]
    return trace ? [{ fleet, trace }] : []
  })
  const first = pairs[0]
  if (!first) return <p className="type-body-sm text-text-secondary">{t.frameError}</p>
  const duration = Math.max(...pairs.map((p) => traceDuration(p.trace)))
  const time = initialTime(first.trace.clockOffsetH, first.fleet.hours, run, duration)
  const clock = clockOf(first.trace.clockOffsetH, time)
  return (
    <div className="flex flex-col gap-12 break-inside-avoid">
      <p className="type-body-sm text-text-secondary">{t.frameCaption(clock.label)}</p>
      <div className="flex gap-16">
        {pairs.map(({ fleet, trace }) => (
          <SimPlayer2D
            key={fleet.key}
            trace={trace}
            t={time}
            title={fleetCaption(fleet)}
            zones={{ inbound: player.zones.inbound, outbound: player.zones.outbound, chargers: player.zones.chargers(trace.chargers) }}
            renderStats={() => null}
          />
        ))}
      </div>
      <ChartLegend series={LEGEND} shape="dot" />
    </div>
  )
}
