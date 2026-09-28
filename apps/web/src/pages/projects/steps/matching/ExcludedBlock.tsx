import { Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import type { ExcludedSolution, Robot } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { reasonsText, solutionLine } from './matchingModel'

const t = ru.project.matching
const x = t.excluded

interface ExcludedBlockProps {
  readonly excluded: readonly ExcludedSolution[]
  readonly robots: ReadonlyMap<string, Robot>
  readonly manualIds: readonly string[]
  /** Сохранённая оценка — только просмотр (D-17). */
  readonly canEdit: boolean
  /** Мест в сравнении не осталось: кнопка неактивна. */
  readonly compareFull: boolean
  readonly onAdd: (solutionId: string) => void
}

/**
 * «Исключённые решения» (16197:990; PRD 11.3): решение, причина с ✕ и «Добавить вручную» — в сравнение,
 * не в рейтинг (ТЗ 3.4.4).
 */
export function ExcludedBlock({ excluded, robots, manualIds, canEdit, compareFull, onAdd }: ExcludedBlockProps) {
  if (excluded.length === 0) return null
  return (
    <Card as="section" padding={24} gap={12} aria-labelledby="matching-excluded-title">
      <div className="flex flex-wrap items-center gap-8">
        <h2 id="matching-excluded-title" className="type-heading text-text">{x.title}</h2>
        <Chip tone="muted" size="xs">{x.count(formatCount(excluded.length, t.plural.solutions))}</Chip>
      </div>
      <p className="type-caption text-text-secondary">{x.lead}</p>
      <ul className="flex flex-col">
        {excluded.map((solution) => {
          const added = manualIds.includes(solution.solutionId)
          return (
            <li key={solution.solutionId} className="flex items-start gap-16 border-t border-border py-16 first:border-t-0">
              <div className="flex w-(--rav-excluded-name-width) shrink-0 flex-col gap-4">
                <span className="type-body font-semibold text-text">{solution.solutionName}</span>
                <span className="type-caption text-text-secondary">{solutionLine(solution.manufacturer, robots.get(solution.solutionId))}</span>
              </div>
              <p className="flex min-w-0 flex-1 items-start gap-4 type-caption text-danger">
                <X aria-hidden size={14} className="mt-2 shrink-0" />
                <span><span className="sr-only">{x.reasonsLabel}: </span>{reasonsText(solution)}</span>
              </p>
              {canEdit && (added
                ? (
                    <span className="inline-flex h-44 shrink-0 items-center gap-4 type-caption font-semibold text-on-accent">
                      <Check aria-hidden size={14} />
                      {x.added}
                    </span>
                  )
                : (
                    <Button size="sm" className="shrink-0" disabled={compareFull} aria-label={x.addLabel(solution.solutionName)} onClick={() => { onAdd(solution.solutionId) }}>
                      <Plus aria-hidden size={16} />
                      {x.add}
                    </Button>
                  ))}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
