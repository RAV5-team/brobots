import { Button } from '@/components/ui/Button'
import { Card, CardStat } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { specsCompleteness, type MatchBaseline, type RankedVariant, type Robot } from '@/domain'
import { formatCount, formatPercent, formatRub, formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { brandOf, formatScore, inline, rubMillions } from './matchingModel'
import { fitsOf } from './variantDetailsModel'

const t = ru.project.matching
const r = t.recommendation

interface RecommendationCardProps {
  readonly variant: RankedVariant
  readonly robot: Robot | undefined
  readonly baseline: MatchBaseline | null
  /** Бюджет CAPEX локации, ₽; null — не задан. */
  readonly budgetRub: number | null
  /** Параметры площадки без данных, которые сверяются с роботом (шаг 1, D-91, D-99). */
  readonly siteChecks: readonly string[]
  /** «Подробнее о решении» — окно 2.1а поверх шага. */
  readonly onDetails: () => void
}

const rub = (value: number): string => rubMillions(value)

/** «6 зарядных станций, 4 точки Wi-Fi» — вспомогательное оборудование из расчёта. */
function equipment(v: RankedVariant): string | undefined {
  const parts = [
    v.stations === null ? null : formatCount(v.stations, t.plural.stations),
    v.auxEquipment?.wifiPoints == null ? null : formatCount(v.auxEquipment.wifiPoints, t.plural.wifiPoints),
  ].filter((part): part is string => part !== null)
  return parts.length === 0 ? undefined : r.rows.robotsCaption(parts.join(', '))
}

/** Шесть строк PRD 11.3: значение и пояснение. Вывод о целесообразности — только на итоге (PRD 15 · №135, D-96). */
function stats(v: RankedVariant, baseline: MatchBaseline | null, budgetRub: number | null) {
  const x = r.rows
  const budget = budgetRub === null ? null : formatRubCompact(budgetRub, { fractionDigits: 1 })
  const perRobot = v.raasMonthlyRub === null ? null : formatRub(Math.round(v.raasMonthlyRub / v.robots))
  return [
    { key: 'robots', label: x.robots, value: String(v.robots), caption: equipment(v) },
    { key: 'capex', label: x.capex, value: rub(v.capexRub), caption: budget === null || budgetRub === null ? undefined : v.capexRub <= budgetRub ? x.capexWithin(budget) : x.capexOver(budget) },
    { key: 'raas', label: x.raas, value: rubMillions(v.raasMonthlyRub, 2), caption: perRobot === null ? x.purchaseNoRaas : x.raasCaption(perRobot) },
    { key: 'opex', label: x.opex, value: rub(v.opexRubPerYear), caption: baseline ? x.opexCaption(rub(baseline.opexRubPerYear)) : undefined },
    { key: 'effect', label: x.effect, value: rub(v.annualEffectRub), caption: v.laborSavingsRubPerYear === null ? undefined : x.effectCaption(rub(v.laborSavingsRubPerYear)) },
    { key: 'payback', label: x.payback, value: v.paybackYears === null ? x.noPayback : formatYears(v.paybackYears), caption: x.paybackCaption },
  ]
}

/**
 * «Рекомендация системы · место 1» в правой колонке (16828:3; PRD 11.3): название, строка качества данных (D-99),
 * шесть строк с пояснениями, «Почему / Ограничения / Не хватает данных» и «Подробнее о решении».
 * «Подробнее о решении» открывает окно 2.1а.
 */
export function RecommendationCard({ variant, robot, baseline, budgetRub, siteChecks, onDetails }: RecommendationCardProps) {
  const unchecked = siteChecks.length === 0 ? r.allChecked : r.unchecked(formatCount(siteChecks.length, ru.plural.parameters))
  const name = t.variantName(variant.solutionName, t.acquisition[variant.acquisition])
  const subtitle = [brandOf(variant.manufacturer), robot?.subtype, robot?.purpose].filter(Boolean).join(' · ')
  const fits = fitsOf(variant).map(inline)
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="matching-recommendation-title">
      <div className="flex items-start gap-8">
        <p className="flex-1 type-overline text-text-muted">{r.overline}</p>
        {variant.score !== null && <Chip tone="ready" size="xs">{r.score(formatScore(variant.score))}</Chip>}
      </div>
      <div className="flex flex-col gap-4">
        <h2 id="matching-recommendation-title" className="type-title-md text-text">{name}</h2>
        {subtitle !== '' && <p className="type-caption text-text-secondary">{subtitle}</p>}
      </div>
      {robot && (
        <p className="type-caption text-text-muted">
          {r.dataLine(formatPercent(specsCompleteness(robot.specs)), ru.catalog.comparePage.confidence[robot.specs.confidence], unchecked)}
        </p>
      )}
      <dl className="flex flex-col divide-y divide-border border-t border-border">
        {stats(variant, baseline, budgetRub).map((s) => <CardStat key={s.key} label={s.label} value={s.value} caption={s.caption} />)}
      </dl>
      <Card as="div" variant="well" padding={16} gap={4} className="px-20 type-body text-text">
        {fits.length > 0 && <p><span className="font-semibold">{r.why}</span> {fits.join('; ')}.</p>}
        {variant.warnings.length > 0 && <p><span className="font-semibold">{r.limits}</span> {variant.warnings.join('; ')}.</p>}
        {siteChecks.length === 0
          ? <p>{r.noMissing}</p>
          : <p><span className="font-semibold">{r.missing}</span> {r.missingTail(siteChecks.join(', '))}</p>}
      </Card>
      <Button className="w-full justify-center" onClick={onDetails}>{r.details}</Button>
    </Card>
  )
}
