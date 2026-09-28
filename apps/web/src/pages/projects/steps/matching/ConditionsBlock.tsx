import { ArrowLeft } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { MatchingEvaluation } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { conditionValue } from './matchingModel'

const t = ru.project.matching

interface ConditionsBlockProps {
  readonly evaluation: MatchingEvaluation
  /** Шаг «Параметры»: условия — производные его значений. */
  readonly paramsPath: string
}

/** «Условия отбора» (16197:750; PRD 11.3): шесть жёстких фильтров плитками 3 × 2 и счётчики прошедших и исключённых. */
export function ConditionsBlock({ evaluation, paramsPath }: ConditionsBlockProps) {
  const conditions = evaluation.conditions.filter((c) => c.applicable)
  const summary = t.conditions.summary(
    formatCount(conditions.length, t.plural.filters),
    formatCount(evaluation.variants.filter((v) => v.rank !== null).length, t.plural.variants),
    formatCount(evaluation.excluded.length, t.plural.solutions),
  )
  return (
    <Card as="section" padding={24} gap={16} aria-labelledby="matching-conditions-title">
      <div className="flex items-center justify-between gap-16">
        <div className="flex min-w-0 flex-col gap-4">
          <h2 id="matching-conditions-title" className="type-heading text-text">{t.conditions.title}</h2>
          <p className="type-caption text-text-secondary">{summary}</p>
        </div>
        <ButtonLink to={paramsPath} className="shrink-0">
          <ArrowLeft aria-hidden size={16} />
          {t.conditions.edit}
        </ButtonLink>
      </div>
      <ul className="grid grid-cols-3 gap-8">
        {conditions.map((c) => (
          <li key={c.code} className="flex flex-col gap-4 rounded-md bg-surface-sunken px-16 py-12">
            <span className="type-caption text-text-secondary">{c.label}</span>
            <span className="type-body font-semibold text-text">{conditionValue(c)}</span>
            {c.note && <span className="type-caption text-text-secondary">{c.note}</span>}
          </li>
        ))}
      </ul>
      <p className="type-caption text-text-secondary">{t.conditions.lead}</p>
    </Card>
  )
}
