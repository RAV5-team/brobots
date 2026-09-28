import type { ReactNode } from 'react'
import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { isReadOnly, type ProjectParamsSnapshot } from '@/domain'
import { numberParameter } from '@/pages/processes/locationStaffing'
import { formatCount, formatDate, formatNumber, formatTime } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ProjectStepLayout } from '../ProjectStepLayout'
import { useAdvanceStep } from '../useAdvanceStep'
import { AssumptionsBlock } from './AssumptionsBlock'
import { ParamsRail } from './ParamsRail'
import { paramsView } from './paramsModel'
import { ProcessBlock } from './ProcessBlock'
import { SiteBlock } from './SiteBlock'
import { useParamsStep } from './useParamsStep'
import type { ProjectStepProps } from '../stepProps'

const t = ru.project.params

/** «склад · 20 000 м² · 2 смены · 180 человек · снимок 15.09.2026»; неизвестные значения пропускаются. */
function objectLine(snapshot: ProjectParamsSnapshot, snapshotAt: string): string {
  const number = (code: string) => numberParameter(snapshot.location, snapshot.facilityParameters, code)
  const area = number('wh_total_area')
  const shifts = number('wh_shifts')
  const staff = number('wh_staff_total')
  return [
    ru.facilityTypesLower[snapshot.location.facilityType],
    area === null ? null : ru.locations.card.areaValue(formatNumber(area)),
    shifts === null ? null : formatCount(shifts, ru.plural.shifts),
    staff === null ? null : formatCount(staff, ru.plural.people),
    t.object.snapshot(formatDate(snapshotAt)),
  ].filter((part): part is string => part !== null).join(' · ')
}

function ObjectCard({ snapshot, snapshotAt }: { readonly snapshot: ProjectParamsSnapshot; readonly snapshotAt: string }) {
  return (
    <Card aria-labelledby="params-object-title" as="section">
      <div className="flex items-center justify-between gap-16">
        <div className="flex min-w-0 flex-col gap-4">
          <p className="type-overline font-medium text-text-muted">{t.object.overline}</p>
          <h2 id="params-object-title" className="type-title-md text-text">{snapshot.location.name}</h2>
          <p className="type-caption text-text-secondary">{objectLine(snapshot, snapshotAt)}</p>
        </div>
        <ButtonLink to={generatePath(ROUTE_PATHS.locationParams, { locationId: snapshot.location.id })}>{t.object.profile}</ButtonLink>
      </div>
    </Card>
  )
}

/**
 * Шаг 1 «Параметры проекта» (экран 02, 16197:367; PRD 11.2). Значения процесса и площадки — только чтение из снимка;
 * менять можно процесс и допущения. Гость — без сохранения (D-14), сохранённая оценка — только просмотр (D-17).
 */
export function ParamsStep({ project: initial, locationName, isGuest }: ProjectStepProps) {
  const readOnly = isReadOnly(initial)
  const persist = !isGuest && !readOnly
  const state = useParamsStep(initial, persist)
  const advance = useAdvanceStep(initial.id, persist)
  const { project, draft } = state

  const layout = (body: ReactNode, rail?: ReactNode) => (
    <ProjectStepLayout project={project} locationName={locationName} step="params" isGuest={isGuest} title={ru.projectStepTitles.params} lead={t.lead} rail={rail}>
      {body}
    </ProjectStepLayout>
  )

  if (state.snapshot.status === 'loading') return layout(<div aria-busy="true"><Skeleton className="h-(--rav-location-card-height)" /></div>)
  if (state.snapshot.status === 'error') {
    return layout(<ErrorState title={t.snapshotError.title} message={t.snapshotError.message} onRetry={state.retry} />)
  }

  const { snapshot } = state.snapshot
  const view = paramsView(snapshot, draft.processId, draft.overrides)
  const saveNote = isGuest
    ? { text: t.save.guest, isError: false }
    : readOnly
      ? { text: t.save.readOnly, isError: false }
      : state.saveError
        ? { text: state.saveError, isError: true }
        : state.savedAt
          ? { text: t.save.draftSaved(formatTime(state.savedAt)), isError: false }
          : null

  return layout(
    <>
      <ObjectCard snapshot={snapshot} snapshotAt={project.versions.snapshotAt} />
      <ProcessBlock view={view} onSelect={state.selectProcess} readOnly={readOnly} />
      <SiteBlock groups={view.siteGroups} locationId={snapshot.location.id} />
      {view.selected && <AssumptionsBlock rows={view.assumptions} readOnly={readOnly} onRefine={state.refine} />}
    </>,
    <ParamsRail
      project={project}
      snapshot={snapshot}
      processId={draft.processId}
      readiness={view.readiness}
      missing={view.missing}
      saveNote={saveNote}
      proceeding={advance.busy}
      proceedError={advance.error}
      onProceed={() => { void advance.go('matching') }}
    />,
  )
}
