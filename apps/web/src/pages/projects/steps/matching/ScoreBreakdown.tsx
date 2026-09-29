import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import type { ScoreContribution } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { barPercent, formatScore } from './matchingModel'

const k = ru.project.matching.ranking

interface ScoreBreakdownProps {
  readonly id: string
  /** Балл строки; null — вне рейтинга. */
  readonly score: number | null
  readonly criteria: readonly ScoreContribution[]
}

/**
 * «Из чего складывается балл · шкала 0–1» под строкой рейтинга (16828:86; замена 2.2 «Как посчитан подбор», D-54).
 * Полоса — вклад как доля веса: веса видны только для чтения, в имени полосы — «вклад 0,09 из 0,10».
 * Ждёт D-88 (open): веса подбора и итога расходятся, у покупок вклад эффекта больше веса — полоса упирается в 100 %.
 */
export function ScoreBreakdown({ id, score, criteria }: ScoreBreakdownProps) {
  const complete = criteria.length > 0 && criteria.every((c) => c.contribution !== null)
  return (
    <Card as="div" variant="inset" padding={12} gap={8} className="px-16" id={id}>
      <p className="type-caption text-text-secondary">{score === null ? k.noBreakdown : k.breakdown(formatScore(score))}</p>
      {complete && (
        <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-12 gap-y-8">
          {criteria.map((c) => {
            const contribution = formatScore(c.contribution ?? 0)
            return (
              <div key={c.code} className="col-span-3 grid grid-cols-subgrid items-center">
                <dt className="type-caption text-text-secondary">{c.label}</dt>
                <dd className="contents">
                  <Progress label={k.bar(c.label, contribution, formatScore(c.weight))} value={barPercent(c)} track="strong" tone="inverse" />
                  <span className="text-right type-caption font-semibold text-text">{contribution}</span>
                </dd>
              </div>
            )
          })}
        </dl>
      )}
      {!complete && score !== null && <p className="type-caption text-text-secondary">{k.noBreakdown}</p>}
    </Card>
  )
}
