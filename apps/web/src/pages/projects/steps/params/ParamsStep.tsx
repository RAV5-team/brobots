import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { Chip } from '@/components/ui/Chip'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { isReadOnly } from '@/domain'
import { formatDayTime } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { useAdvanceStep } from '../useAdvanceStep'
import { ProjectStepLayout } from '../ProjectStepLayout'
import { AssumptionsBlock } from './AssumptionsBlock'
import { ParamsRail } from './ParamsRail'
import { paramsView, valueAnchor, type MissingItem, type ParamsView } from './paramsModel'
import { ProcessBlock } from './ProcessBlock'
import { SiteBlock } from './SiteBlock'
import { isParamsExpandedState, processGroupKey, siteGroupKey, useGroupReveal } from './useGroupReveal'
import { useParamsStep } from './useParamsStep'
import type { ProjectStepProps } from '../stepProps'

const t = ru.project.params

/** Группа, в которой лежит строка незаполненного значения: процесс или площадка. */
function groupOfAnchor(view: ParamsView, anchor: string): string | null {
  const process = view.groups.find((g) => g.rows.some((r) => r.anchor === anchor))
  if (process) return processGroupKey(process.key)
  // Исполнители и оклад — не строки группы, а таблица «Исполнители».
  if (anchor === valueAnchor('workers') || anchor === valueAnchor('salary')) return processGroupKey('workers')
  const site = view.siteGroups.find((g) => g.rows.some((r) => r.anchor === anchor))
  return site ? siteGroupKey(site.key) : null
}

/**
 * Шаг 1 «Параметры проекта» (доска 16325, экран 1.1 16969:10; PRD 11.2). Значения процесса и площадки — только чтение
 * из снимка; менять можно процесс. Гость — без сохранения (D-14), сохранённая оценка — только просмотр (D-17).
 */
export function ParamsStep({ project: initial, locationName, isGuest }: ProjectStepProps) {
  const readOnly = isReadOnly(initial)
  const advance = useAdvanceStep(initial.id, !isGuest && !readOnly)
  const state = useParamsStep(initial, !isGuest && !readOnly)
  // «Всё раскрыто» (16992:10) — состояние навигации из сценария /dev/screens.
  const navState: unknown = useLocation().state
  const expandedState = isParamsExpandedState(navState) ? navState : null
  const groups = useGroupReveal(expandedState !== null)
  const { project, draft } = state

  // Гостю и сохранённой оценке статус заменяют демо-плашка и «только просмотр» (ProjectStepLayout).
  const status = state.saveError
    ? <p role="alert" className="type-caption text-danger">{state.saveError}</p>
    : <p role="status"><Chip size="md">{t.save.draftSaved(formatDayTime(state.savedAt ?? project.updatedAt))}</Chip></p>

  const layout = (body: ReactNode, rail?: ReactNode) => (
    <ProjectStepLayout
      layout="board"
      project={project}
      locationName={locationName}
      step="params"
      isGuest={isGuest}
      title={ru.projectStepTitles.params}
      lead={t.lead}
      status={status}
      rail={rail}
    >
      {body}
    </ProjectStepLayout>
  )

  if (state.snapshot.status === 'loading') return layout(<div aria-busy="true"><Skeleton className="h-(--rav-location-card-height)" /></div>)
  if (state.snapshot.status === 'error') {
    return layout(<ErrorState title={t.snapshotError.title} message={t.snapshotError.message} onRetry={state.retry} />)
  }

  const { snapshot } = state.snapshot
  const view = paramsView(snapshot, draft.processId, draft.overrides)
  const reveal = (item: MissingItem) => {
    const anchor = valueAnchor(item.code)
    const group = groupOfAnchor(view, anchor)
    if (group) groups.reveal(group, anchor)
  }

  return layout(
    <>
      <ProcessBlock view={view} snapshot={snapshot} onSelect={state.selectProcess} readOnly={readOnly} groups={groups} onReveal={reveal} expanded={expandedState?.breakdown ?? false} />
      <SiteBlock groups={view.siteGroups} location={snapshot.location} reveal={groups} showAllInitially={expandedState?.siteAll ?? false} ownScheduleHours={view.ownScheduleHours} />
      {view.selected && <AssumptionsBlock rows={view.assumptions} snapshotAt={project.versions.snapshotAt} />}
    </>,
    <ParamsRail
      project={project}
      snapshot={snapshot}
      readiness={view.readiness}
      missing={view.missing}
      onRevealMissing={reveal}
      onProceed={() => { void advance.go('matching') }}
      proceeding={advance.busy}
      proceedError={advance.error}
    />,
  )
}
