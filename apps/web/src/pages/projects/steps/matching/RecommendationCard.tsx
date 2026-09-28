import { ArrowUpRight, Check, CircleHelp } from 'lucide-react'
import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { TextLink } from '@/components/ui/TextLink'
import { specsCompleteness, type MatchBaseline, type RankedVariant, type Robot } from '@/domain'
import { formatCount, formatPercent, formatRub, formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { StatTile } from '@/components/ui/StatTile'
import { contributionsText, formatScore, solutionLine } from './matchingModel'

const t = ru.project.matching
const r = t.recommendation

interface RecommendationCardProps {
  readonly variant: RankedVariant
  readonly robot: Robot | undefined
  /** «OP-01 · Перемещение грузов» — условие класса операции. */
  readonly operationClass: string | null
  readonly baseline: MatchBaseline | null
  /** Бюджет CAPEX локации, ₽; null — не задан. */
  readonly budgetRub: number | null
  /** Параметры площадки без данных, которые сверяются с роботом (шаг 1, D-91). */
  readonly siteChecks: readonly string[]
  readonly selected: boolean
  readonly canSelect: boolean
  readonly onSelect: () => void
  readonly onHowRanked: () => void
}

function tiles(v: RankedVariant, baseline: MatchBaseline | null, budgetRub: number | null) {
  const x = r.tiles
  const budget = budgetRub === null ? null : formatRubCompact(budgetRub, { fractionDigits: 1 })
  const perRobot = v.raasMonthlyRub === null ? null : formatRub(Math.round(v.raasMonthlyRub / v.robots))
  return [
    { key: 'robots', label: x.robots, value: String(v.robots), caption: v.stations === null ? '' : x.robotsCaption(formatCount(v.stations, t.plural.stations)) },
    { key: 'capex', label: x.capex, value: formatRubCompact(v.capexRub, { fractionDigits: 1 }), caption: budget === null || budgetRub === null ? '' : v.capexRub <= budgetRub ? x.capexWithin(budget) : x.capexOver(budget) },
    { key: 'raas', label: x.raas, value: v.raasMonthlyRub === null ? '—' : formatRubCompact(v.raasMonthlyRub, { fractionDigits: 1 }), caption: perRobot === null ? x.purchaseNoRaas : x.raasCaption(perRobot) },
    { key: 'opex', label: x.opex, value: formatRubCompact(v.opexRubPerYear, { fractionDigits: 1 }), caption: baseline ? x.opexCaption(formatRubCompact(baseline.opexRubPerYear, { fractionDigits: 1 })) : '' },
    { key: 'effect', label: x.effect, value: formatRubCompact(v.annualEffectRub, { fractionDigits: 1 }), caption: v.laborSavingsRubPerYear === null ? '' : x.effectCaption(formatRubCompact(v.laborSavingsRubPerYear, { fractionDigits: 1 })) },
    { key: 'payback', label: x.payback, value: v.paybackYears === null ? x.noPayback : formatYears(v.paybackYears), caption: x.paybackCaption },
  ]
}

/**
 * «Рекомендация системы · место 1» (16197:783; PRD 11.3): название варианта, шесть плиток PRD, вклад критериев,
 * ограничения и недостающие данные. Вывод о целесообразности — только на итоге (PRD 15 · №135).
 */
export function RecommendationCard({ variant, robot, operationClass, baseline, budgetRub, siteChecks, selected, canSelect, onSelect, onHowRanked }: RecommendationCardProps) {
  const unchecked = siteChecks.length === 0 ? r.allChecked : r.unchecked(formatCount(siteChecks.length, ru.plural.parameters))
  const contributions = contributionsText(variant.criteria)
  const name = t.variantName(variant.solutionName, t.acquisition[variant.acquisition])
  return (
    <Card as="section" padding={24} gap={20} aria-labelledby="matching-recommendation-title" className="outline-1 -outline-offset-1 outline-inverse">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-8">
          <Chip tone="muted" size="xs">{r.overline}</Chip>
          {operationClass && <Chip size="xs">{operationClass}</Chip>}
        </div>
        {robot && (
          <p className="type-caption text-text-secondary">
            {r.dataLine(formatPercent(specsCompleteness(robot.specs)), ru.catalog.comparePage.confidence[robot.specs.confidence], unchecked)}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-16">
        <div className="flex min-w-0 flex-col gap-8">
          <h2 id="matching-recommendation-title" className="type-display-lg text-text">{name}</h2>
          <p className="flex flex-wrap items-center gap-x-12 gap-y-4 type-caption text-text-secondary">
            {solutionLine(variant.manufacturer, robot)}
            <TextLink to={generatePath(ROUTE_PATHS.catalogItem, { itemId: variant.solutionId })} icon={ArrowUpRight}>{r.details}</TextLink>
          </p>
        </div>
        <Button className="shrink-0" onClick={onHowRanked}>
          <CircleHelp aria-hidden size={16} />
          {r.howRanked}
        </Button>
      </div>
      <ul className="grid grid-cols-3 gap-8">
        {tiles(variant, baseline, budgetRub).map((tile) => <StatTile key={tile.key} label={tile.label} value={tile.value} caption={tile.caption} />)}
      </ul>
      <div className="flex flex-col gap-8">
        <p className="type-caption font-medium text-text">
          {r.contributions}
          {': '}
          {contributions === '' || variant.score === null ? r.noContributions : r.contributionsLine(contributions, formatScore(variant.score))}
        </p>
        {variant.warnings.length > 0 && <p className="type-caption font-medium text-danger">{r.warnings(variant.warnings.join('; '))}</p>}
        <p className="type-caption text-text-secondary">{siteChecks.length === 0 ? r.noMissing : r.missingData(siteChecks.join(', '))}</p>
      </div>
      {(selected || canSelect) && (
        selected
          ? (
              <p role="status" className="flex items-center gap-8 type-body font-semibold text-on-accent">
                <Check aria-hidden size={16} />
                {t.ranking.selected}
              </p>
            )
          : <Button variant="primary" className="self-start" onClick={onSelect}>{r.select}</Button>
      )}
    </Card>
  )
}
