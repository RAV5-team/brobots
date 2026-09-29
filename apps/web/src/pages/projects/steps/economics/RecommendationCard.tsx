import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import type { AcquisitionModel, EconomicsResult, ScenarioEconomics } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { StatTile } from '@/components/ui/StatTile'
import { Well } from '@/components/ui/Well'
import { acquisitionName, fleetText, summaryLine, tiles, type ConclusionView } from './economicsView'

const t = ru.project.economics

interface RecommendationCardProps {
  readonly economics: EconomicsResult
  readonly scenario: ScenarioEconomics
  readonly selected: AcquisitionModel
  readonly conclusion: ConclusionView
  /** Можно выбрать показанный сценарий: черновик или гость, и он ещё не выбран. */
  readonly canChoose: boolean
  readonly onChoose: (scenario: AcquisitionModel) => void
}

/**
 * «Карточка · рекомендация» (16197:2048; PRD 11.5): плашки рекомендации и выбора, название варианта, «Вывод» и
 * «Предлагаемый следующий шаг», пять показателей и строка «Стоимость операции · ROI · TCO».
 * Тёмная карточка — `Card variant="inverse"`, как вердикт 07 (D-104); плитки — вложенные плашки `inverse-well`.
 */
export function RecommendationCard({ economics, scenario, selected, conclusion, canChoose, onChoose }: RecommendationCardProps) {
  const r = t.recommendation
  const isSelected = scenario.acquisition === selected
  const isRecommended = economics.recommended === scenario.acquisition
  const rank = scenario.rank === null ? r.outOfRank : r.rank(scenario.rank, economics.rankedTotal)
  return (
    <Card as="section" variant="inverse" padding={24} gap={16} aria-labelledby="economics-recommendation-title">
      <div className="flex flex-wrap items-center gap-10">
        {isRecommended && <Chip tone="ready">{r.recommended}</Chip>}
        {isSelected && <Chip tone="neutral">{r.selected}</Chip>}
        <p className="type-caption text-text-disabled">{rank}</p>
      </div>
      <div className="flex flex-col gap-4">
        <h2 id="economics-recommendation-title" className="type-display-md text-bg">
          {r.name(economics.solutionName, acquisitionName(scenario.acquisition))}
        </h2>
        <p className="type-body text-text-disabled">{`${fleetText(scenario.robots, scenario.stations)} · ${economics.manufacturer}`}</p>
      </div>
      <div className="grid grid-cols-2 gap-8">
        <Well title={r.conclusion}>
          <p className="type-body font-semibold text-on-inverse">{conclusion.title}</p>
          <p className="type-body-sm text-bg">{conclusion.explanation}</p>
        </Well>
        <Well title={r.nextStep}>
          <p className="type-body font-semibold text-bg">{conclusion.nextStep}</p>
        </Well>
      </div>
      <ul aria-label={t.tiles.label} className="grid grid-cols-5 gap-8">
        {tiles(scenario, economics).map((tile) => (
          <StatTile key={tile.key} tone="inverse" label={tile.label} value={tile.value} caption={tile.caption} />
        ))}
      </ul>
      <p className="type-body-sm text-bg">{summaryLine(scenario, economics)}</p>
      <p className="type-caption text-text-disabled">{t.tiles.glossary}</p>
      {canChoose && !isSelected && (
        <div className="flex flex-wrap items-center gap-16">
          <Button variant="accent" onClick={() => { onChoose(scenario.acquisition) }}>{r.choose}</Button>
          <p className="type-caption text-text-disabled">{r.chooseHint(acquisitionName(selected))}</p>
        </div>
      )}
    </Card>
  )
}
