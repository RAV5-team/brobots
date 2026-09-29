import { ArrowRight, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { MergedButton } from '@/components/ui/MergedButton'
import type { Project } from '@/domain'
import { formatCount, formatDate } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.matching
const r = t.rail

interface MatchingRailProps {
  readonly project: Project
  /** Рекомендация системы (16828:3); null — рейтинг пуст. */
  readonly recommendation: ReactNode
  /** «Выбрано: AMR 800 · RaaS · 18 роботов · 6 зарядных станций» (PRD 11.3, «Переход к симуляции»); null — не выбран. */
  readonly selection: string | null
  readonly stale: boolean
  /** Сколько «Параметров расчёта» изменено; null — панели нет (исходных значений нет или только просмотр). */
  readonly changedParams: number | null
  readonly onOpenParams: () => void
  /** «Перейти к симуляции»: записать следующий шаг и перейти. */
  readonly onProceed: () => void
  readonly proceeding: boolean
  readonly proceedError: string | null
}

/**
 * Правая колонка шага 2 (16828:2): рекомендация системы, «Перейти к симуляции» с пояснением, «Изменить параметры расчёта»
 * (нет в макете, PRD 11.3 — D-97) и версии данных.
 */
export function MatchingRail({ project, recommendation, selection, stale, changedParams, onOpenParams, onProceed, proceeding, proceedError }: MatchingRailProps) {
  const hasSelection = selection !== null
  const handoff = !hasSelection ? r.noneHint : stale ? r.staleBlocked : r.handoff
  return (
    <>
      {recommendation}
      <MergedButton
        block
        label={r.toSimulation}
        icon={ArrowRight}
        disabled={!hasSelection || stale || proceeding}
        aria-describedby="matching-handoff"
        onClick={onProceed}
      />
      {proceedError && <p role="alert" className="type-caption text-danger">{proceedError}</p>}
      <div id="matching-handoff" className="flex flex-col gap-4 type-caption text-text-secondary">
        {selection && <p className="font-semibold text-text">{r.selected(selection)}</p>}
        <p>{handoff}</p>
      </div>
      {changedParams !== null && (
        <div className="flex flex-col gap-4">
          <Button aria-describedby={changedParams > 0 ? 'matching-params-changed' : undefined} onClick={onOpenParams}>
            <SlidersHorizontal aria-hidden size={16} />
            {t.params.open}
          </Button>
          {changedParams > 0 && (
            <p id="matching-params-changed" className="text-center type-caption text-text-secondary">{t.params.changed(formatCount(changedParams, ru.plural.parameters))}</p>
          )}
        </div>
      )}
      <p className="type-caption text-text-secondary">
        {ru.project.params.readiness.versions(formatDate(project.versions.snapshotAt), project.versions.catalog, project.versions.model)}
      </p>
    </>
  )
}
