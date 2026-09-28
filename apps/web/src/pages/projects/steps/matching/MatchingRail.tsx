import { ArrowRight, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardStat } from '@/components/ui/Card'
import { MergedButton } from '@/components/ui/MergedButton'
import type { Project, RankedVariant } from '@/domain'
import { formatCount, formatDate, formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.matching
const r = t.rail

interface MatchingRailProps {
  readonly project: Project
  readonly selected: RankedVariant | null
  readonly stale: boolean
  /** Параметры площадки без данных: «Уточните в первую очередь». */
  readonly siteChecks: readonly string[]
  /** Сколько «Параметров расчёта» изменено; null — панели нет (исходных значений нет или только просмотр). */
  readonly changedParams: number | null
  readonly onOpenParams: () => void
  readonly saveNote: { readonly text: string; readonly isError: boolean } | null
  readonly proceeding: boolean
  readonly proceedError: string | null
  readonly onProceed: () => void
}

/** Правая колонка шага 2 (16197:1025): выбранный вариант, что уточнить, «Перейти к симуляции», параметры и версии. */
export function MatchingRail({
  project, selected, stale, siteChecks, changedParams, onOpenParams, saveNote, proceeding, proceedError, onProceed,
}: MatchingRailProps) {
  const canProceed = selected !== null && !stale
  return (
    <>
      <Card padding={20} gap={8} as="section" aria-labelledby="matching-selected">
        <h2 id="matching-selected" className="type-overline text-text-muted">{r.overline}</h2>
        {selected
          ? (
              <>
                <p className="type-title-md text-text">{t.variantName(selected.solutionName, t.acquisition[selected.acquisition])}</p>
                <dl className="flex flex-col">
                  <CardStat label={r.payback} value={selected.paybackYears === null ? t.ranking.notPaying : formatYears(selected.paybackYears)} />
                  <CardStat label={r.capex} value={formatRubCompact(selected.capexRub, { fractionDigits: 1 })} />
                  <CardStat label={r.effect} value={formatRubCompact(selected.annualEffectRub, { perYear: true, fractionDigits: 1 })} />
                  <CardStat label={r.robots} value={r.robotsValue(selected.robots, selected.stations)} />
                </dl>
              </>
            )
          : (
              <>
                <p className="type-title-md text-text">{r.none}</p>
                <p className="type-caption text-text-secondary">{r.noneHint}</p>
              </>
            )}
      </Card>
      {siteChecks.length > 0 && (
        <Card padding={20} gap={12} as="section" aria-labelledby="matching-checks">
          <h2 id="matching-checks" className="type-overline text-text-muted">{r.checksTitle}</h2>
          <ol className="flex list-inside list-decimal flex-col gap-8 type-body font-semibold text-text">
            {siteChecks.map((label) => (
              <li key={label}>
                {label.charAt(0).toLocaleUpperCase('ru') + label.slice(1)}
                <span className="block pl-16 type-caption font-normal text-text-secondary">{r.checkCaption}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
      <MergedButton
        block
        label={r.toSimulation}
        icon={ArrowRight}
        disabled={!canProceed || proceeding}
        aria-describedby="matching-handoff"
        onClick={onProceed}
      />
      {proceedError && <p role="alert" className="type-caption text-danger">{proceedError}</p>}
      <p id="matching-handoff" className="type-caption text-text-secondary">{stale && selected ? r.staleBlocked : r.handoff}</p>
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
      {saveNote && (
        <p role={saveNote.isError ? 'alert' : 'status'} className={saveNote.isError ? 'type-caption text-danger' : 'type-caption text-text-secondary'}>
          {saveNote.text}
        </p>
      )}
    </>
  )
}
