import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import type { ExcludedSolution } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { reasonsText } from './matchingModel'

const m = ru.project.matching.manual

interface ManualBlockProps {
  readonly entries: readonly ExcludedSolution[]
  readonly canEdit: boolean
  readonly onRemove: (solutionId: string) => void
}

/**
 * Решения, добавленные вручную (PRD 11.3, ТЗ 3.4.4): вне рейтинга, с предупреждением «Критическое несоответствие»
 * и «Убрать». Они же — колонки сравнения. Макета нет — собрано из готовых (D-86).
 */
export function ManualBlock({ entries, canEdit, onRemove }: ManualBlockProps) {
  if (entries.length === 0) return null
  return (
    <Card as="section" variant="sunken" padding={20} gap={12} aria-labelledby="matching-manual-title">
      <h2 id="matching-manual-title" className="type-heading text-text">{m.title}</h2>
      <ul className="flex flex-col gap-12">
        {entries.map((e) => (
          <li key={e.solutionId} className="flex items-start gap-16">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <span className="flex flex-wrap items-center gap-8">
                <span className="type-body font-semibold text-text">{e.solutionName}</span>
                <Chip tone="unconfirmed" size="xs">{m.badge}</Chip>
              </span>
              <span className="flex items-start gap-4 type-caption font-medium text-danger">
                <TriangleAlert aria-hidden size={14} className="mt-2 shrink-0" />
                {m.critical(reasonsText(e))}
              </span>
            </div>
            {canEdit && <Button size="sm" className="shrink-0" aria-label={m.removeLabel(e.solutionName)} onClick={() => { onRemove(e.solutionId) }}>{m.remove}</Button>}
          </li>
        ))}
      </ul>
    </Card>
  )
}
