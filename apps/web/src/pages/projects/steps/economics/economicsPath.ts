import type { MatchingEvaluation, Project, ScenarioEconomics, SimulationRun } from '@/domain'
import { formatCount, formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { PathStep } from './PathCard'
import { fleetText, type ProcessFacts } from './economicsView'

const t = ru.project.economics.path
const plural = ru.plural

/**
 * Строки «Как мы к этому пришли» (16197:2072) — из данных шагов, а не с макета (D-13): параметры процесса и полнота
 * данных, отбор и место в рейтинге, прогон и принятый план.
 */
export function pathSteps(
  locationName: string,
  facts: ProcessFacts | null,
  matching: MatchingEvaluation,
  scenario: ScenarioEconomics,
  project: Project,
  run: SimulationRun | null,
): readonly PathStep[] {
  const params = facts
    ? [
      t.params(locationName, facts.volume, facts.peakFactor === null ? '—' : formatNumber(facts.peakFactor, 1), facts.shiftsText ?? '—'),
      facts.missingCount > 0 ? t.missing(formatCount(facts.missingCount, plural.values)) : t.complete,
    ].join(' · ')
    : locationName
  const { counts } = matching
  const criteria = matching.variants.find((v) => v.criteria.length > 0)?.criteria.length ?? 0
  const r = ru.project.economics.recommendation
  const rank = (scenario.rank === null ? r.outOfRank : r.rank(scenario.rank, matching.variants.filter((v) => v.rank !== null).length)).toLowerCase()
  const matchingText = t.matching(
    formatCount(counts.total, ru.project.matching.plural.solutions),
    counts.passed + counts.needsVerification,
    rank,
    formatCount(criteria, plural.criteriaBy),
  )
  const simulation = project.inputs.simulation
  const plan = simulation?.plan ?? run?.to ?? null
  const simulationText = run
    ? [
      t.simulation(
        run.id,
        formatNumber(run.peak.servedPerHour),
        formatNumber(run.peak.requiredPerHour),
        formatPercent(run.onTimeWorstDay, 1),
        plan ? fleetText(plan.robots, plan.stations) : '—',
      ),
      ...(simulation?.acceptRisk ? [t.withRisk] : []),
    ].join(' · ')
    : t.noRun
  return [
    { step: 'params', text: params },
    { step: 'matching', text: matchingText },
    { step: 'simulation', text: simulationText },
  ]
}
