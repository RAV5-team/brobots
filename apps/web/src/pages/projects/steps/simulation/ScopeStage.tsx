import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardStat, CardTitle } from '@/components/ui/Card'
import { NumberStepper } from '@/components/ui/NumberStepper'
import type { Fleet, RankedVariant } from '@/domain'
import { formatCount, formatNumber, formatPercent, formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { StatTile } from '@/components/ui/StatTile'
import { FLEET_LIMITS, robotsPerStation, type CalcRow } from './simulationModel'

const s = ru.project.simulation
const t = s.scope

interface ScopeStageProps {
  readonly variant: RankedVariant
  readonly calc: readonly CalcRow[]
  /** Допуск расхождения с расчётом, доля 0–1. */
  readonly tolerance: number
  /** Состав для проверки и состав из подбора. */
  readonly fleet: Fleet
  readonly fromMatching: Fleet
  readonly canEdit: boolean
  readonly onFleet: (fleet: Fleet) => void
  readonly onNext: () => void
}

/** «Проверяем · из подбора»: вариант, плитки PRD 11.4 и допущения расчёта подбора. */
function SourceCard({ variant, calc }: Pick<ScopeStageProps, 'variant' | 'calc'>) {
  const x = t.source.tiles
  const name = ru.project.matching.variantName(variant.solutionName, ru.project.matching.acquisition[variant.acquisition])
  const tiles = [
    { key: 'robots', label: x.robots, value: formatNumber(variant.robots) },
    { key: 'stations', label: x.stations, value: variant.stations === null ? '—' : formatNumber(variant.stations) },
    { key: 'capex', label: x.capex, value: formatRubCompact(variant.capexRub, { fractionDigits: 1 }) },
    { key: 'payback', label: x.payback, value: variant.paybackYears === null ? x.noPayback : formatYears(variant.paybackYears) },
  ]
  return (
    <Card as="section" padding={20} gap={16} aria-labelledby="simulation-source-title">
      <div className="flex flex-col gap-8">
        <CardTitle as="h2">{t.source.title}</CardTitle>
        <p id="simulation-source-title" className="type-display-md text-text">{t.source.heading(name, formatCount(variant.robots, ru.plural.robots))}</p>
      </div>
      <ul className="grid grid-cols-4 gap-8">
        {tiles.map((tile) => <StatTile key={tile.key} label={tile.label} value={tile.value} />)}
      </ul>
      <div className="flex flex-col gap-4">
        <h3 className="type-body font-semibold text-text">{t.calc.title}</h3>
        <dl aria-label={t.calc.label}>
          {calc.map((row) => <CardStat key={row.key} label={row.label} value={row.value} />)}
        </dl>
        <p className="type-caption text-text-secondary">{t.calc.footer}</p>
      </div>
    </Card>
  )
}

/** «Что проверит симуляция»: четыре правила вердикта (PRD 11.4). */
function ChecksCard({ tolerance }: { readonly tolerance: number }) {
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="simulation-checks-title">
      <CardTitle as="h2" id="simulation-checks-title">{t.checks.title}</CardTitle>
      <ol className="flex flex-col gap-12">
        {t.checks.items(formatPercent(tolerance)).map((item, index) => (
          <li key={item} className="flex items-center gap-12 type-body text-text-secondary">
            <span aria-hidden className="flex size-24 shrink-0 items-center justify-center rounded-full bg-surface-sunken type-caption font-semibold text-text">{index + 1}</span>
            {item}
          </li>
        ))}
      </ol>
    </Card>
  )
}

/** «Состав для проверки»: степперы, по умолчанию как в подборе; изменённое значение показывает «было N · из подбора». */
function FleetCard({ variant, fleet, fromMatching, canEdit, onFleet }: Pick<ScopeStageProps, 'variant' | 'fleet' | 'fromMatching' | 'canEdit' | 'onFleet'>) {
  const f = s.fleet
  const previous = (key: keyof Fleet) => (fleet[key] === fromMatching[key] ? {} : { previous: f.previous(fromMatching[key]) })
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="simulation-fleet-title">
      <CardTitle as="h2" id="simulation-fleet-title">{f.title}</CardTitle>
      <NumberStepper
        label={f.robots}
        value={fleet.robots}
        {...FLEET_LIMITS.robots}
        disabled={!canEdit}
        description={ru.project.matching.variantName(variant.solutionName, ru.project.matching.acquisition[variant.acquisition])}
        {...previous('robots')}
        onChange={(robots) => { onFleet({ ...fleet, robots }) }}
      />
      <NumberStepper
        label={f.stations}
        value={fleet.stations}
        {...FLEET_LIMITS.stations}
        disabled={!canEdit}
        description={f.perStation(robotsPerStation(fleet))}
        {...previous('stations')}
        onChange={(stations) => { onFleet({ ...fleet, stations }) }}
      />
      <p className="type-caption text-text-secondary">{f.note}</p>
    </Card>
  )
}

/** Этап 1 «Что проверяем» (экран 04, 16197:1114; PRD 11.4). Кнопка — «Задать параметры симуляции» (PRD 15 · №86). */
export function ScopeStage(props: ScopeStageProps) {
  return (
    <>
      <SourceCard variant={props.variant} calc={props.calc} />
      <ChecksCard tolerance={props.tolerance} />
      <FleetCard {...props} />
      <Button variant="primary" className="self-end" onClick={props.onNext}>
        {t.next}
        <ArrowRight aria-hidden size={16} />
      </Button>
    </>
  )
}
