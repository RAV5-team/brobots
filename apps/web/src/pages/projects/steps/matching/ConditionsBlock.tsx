import { Card } from '@/components/ui/Card'
import { Disclosure } from '@/components/ui/Disclosure'
import type { MatchingEvaluation } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { conditionValue } from './matchingModel'

const t = ru.project.matching

interface ConditionsBlockProps {
  readonly evaluation: MatchingEvaluation
}

/**
 * «Условия отбора» во всю ширину (16624:178; PRD 11.3): раскрывающаяся секция, по умолчанию открыта; шесть жёстких
 * фильтров парами «подпись — значение» на вдавленной плашке 3 × 2, примечание — в скобках при значении.
 */
export function ConditionsBlock({ evaluation }: ConditionsBlockProps) {
  const conditions = evaluation.conditions.filter((c) => c.applicable)
  const summary = t.conditions.summary(
    formatCount(conditions.length, t.plural.filters),
    formatCount(evaluation.variants.filter((v) => v.rank !== null).length, t.plural.variants),
    formatCount(evaluation.excluded.length, t.plural.solutions),
  )
  return (
    <Card as="section" padding={28} gap={20} aria-label={t.conditions.title}>
      <Disclosure title={t.conditions.title} caption={summary} headingLevel={2} defaultOpen>
        <Card as="div" variant="well" padding={16} className="px-20">
          <dl className="grid grid-cols-3 gap-x-20 gap-y-12">
            {conditions.map((c) => (
              <div key={c.code} className="flex flex-col gap-4">
                <dt className="type-caption text-text-secondary">{c.label}</dt>
                <dd className="type-body font-semibold text-text">
                  {c.note === null || c.note === '' ? conditionValue(c) : `${conditionValue(c)} (${c.note})`}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </Disclosure>
    </Card>
  )
}
