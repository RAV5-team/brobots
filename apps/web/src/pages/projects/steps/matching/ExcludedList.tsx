import { Button } from '@/components/ui/Button'
import { Disclosure } from '@/components/ui/Disclosure'
import type { ExcludedSolution, Robot } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { shortReasonsText, solutionLine } from './matchingModel'

const x = ru.project.matching.excluded

interface ExcludedListProps {
  readonly excluded: readonly ExcludedSolution[]
  readonly robots: ReadonlyMap<string, Robot>
  /** Уже добавленные вручную: у них «Убрать». */
  readonly manualIds: readonly string[]
  /** Сохранённая оценка — только просмотр (D-17). */
  readonly canEdit: boolean
  readonly onAdd: (solutionId: string) => void
  readonly onRemove: (solutionId: string) => void
}

/**
 * «Исключённые решения» внутри карточки рейтинга (16742:183; PRD 11.3): чип «4 не прошли фильтры» раскрывает список —
 * решение, короткая причина красным, «Добавить вручную» (строка в конце рейтинга, вне рейтинга; ТЗ 3.4.4).
 * «Убрать» у добавленного — повторным нажатием: в макете кнопки нет, а снять добавленное нужно (PRD 11.3).
 */
export function ExcludedList({ excluded, robots, manualIds, canEdit, onAdd, onRemove }: ExcludedListProps) {
  if (excluded.length === 0) return null
  return (
    // Заголовок слева на одной строке с чипом справа: список под ними во всю ширину (16742:184).
    <section aria-labelledby="matching-excluded-title" className="relative border-t border-border pt-16">
      <h3 id="matching-excluded-title" className="absolute top-16 left-12 type-body font-semibold text-text">{x.title}</h3>
      <Disclosure variant="chip" tone="danger" title={x.count(excluded.length)} defaultOpen className="[&>button]:mr-12 [&>button]:self-end">
        <ul className="flex flex-col">
          {excluded.map((solution) => {
            const added = manualIds.includes(solution.solutionId)
            return (
              <li key={solution.solutionId} className="flex items-center gap-16 border-b border-border p-12 last:border-b-0">
                <div className="flex w-(--rav-excluded-name-width) shrink-0 flex-col gap-2">
                  <span className="type-body font-semibold text-text">{solution.solutionName}</span>
                  <span className="type-caption text-text-secondary">{solutionLine(solution.manufacturer, robots.get(solution.solutionId))}</span>
                </div>
                <p className="min-w-0 flex-1 type-body text-danger">
                  <span className="sr-only">{x.reasonsLabel}: </span>
                  {shortReasonsText(solution)}
                </p>
                {canEdit && (added
                  ? <Button className="shrink-0" aria-label={x.removeLabel(solution.solutionName)} onClick={() => { onRemove(solution.solutionId) }}>{x.remove}</Button>
                  : <Button className="shrink-0" aria-label={x.addLabel(solution.solutionName)} onClick={() => { onAdd(solution.solutionId) }}>{x.add}</Button>)}
              </li>
            )
          })}
        </ul>
      </Disclosure>
    </section>
  )
}
