import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { DemoBanner } from '@/components/shell/DemoBanner'
import { ButtonLink } from '@/components/ui/Button'
import { MergedButton } from '@/components/ui/MergedButton'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { TextLink } from '@/components/ui/TextLink'
import { parseProcessCode } from '@/domain'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { LocationsSection } from './LocationsSection'
import { ProcessDetailRail } from './ProcessDetailRail'
import { AutomationSection, RequirementsSection } from './ProcessDetailSections'
import { RobotsSection } from './RobotsSection'
import { facilityNames, locationUsages, robotSummary } from './processDetailModel'
import { useProcessDetail, type ProcessDetailData } from './useProcessDetail'

const t = ru.processCard

function ProcessDetailSkeleton() {
  return (
    <div className="flex flex-col gap-16" aria-busy="true">
      <Skeleton className="h-48 w-1/2" />
      <div className="flex gap-16">
        <Skeleton className="h-48 flex-1" />
        <Skeleton className="h-48 w-(--rav-form-rail-width)" />
      </div>
    </div>
  )
}

function ProcessDetail({ data, isGuest }: { readonly data: ProcessDetailData; readonly isGuest: boolean }) {
  const { process, operationClass } = data
  const facilities = facilityNames(process, data.facilityTypes)
  const classLabel = ru.processes.classOption(process.operationClass, operationClass?.name ?? '')
  return (
    <article className="flex flex-col gap-16" aria-labelledby="process-title">
      <header className="flex items-start justify-between gap-24">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center gap-16">
            <TextLink to={ROUTE_PATHS.processes} icon={ArrowLeft}>{t.back}</TextLink>
            {isGuest && <DemoBanner />}
          </div>
          <h1 id="process-title" className="type-display-lg text-text">{process.name}</h1>
          <p className="type-body text-text-secondary">{t.meta(process.operationClass, operationClass?.name ?? '', facilities.join(' · '))}</p>
          <p className="type-body text-text">{process.description}</p>
        </div>
        <div className="flex w-(--rav-form-rail-width) shrink-0 flex-col items-end gap-8">
          {/* D-33: формы правки шаблона ещё нет — действие видно, но недоступно с объяснением. Гостю правки нет вовсе. */}
          {!isGuest && (
            <>
              <MergedButton label={t.edit} icon={ArrowRight} disabled aria-describedby="edit-note" />
              <p id="edit-note" className="type-caption text-right text-text-muted">{t.editSoon}</p>
            </>
          )}
        </div>
      </header>
      <div className="flex items-start gap-16">
        <div className="flex min-w-0 flex-1 flex-col gap-24">
          <AutomationSection process={process} operationClass={operationClass} facilities={facilities} />
          <RequirementsSection process={process} requirements={data.requirements} />
          <RobotsSection classCode={process.operationClass} summary={robotSummary(data.robots)} />
          <LocationsSection usages={locationUsages(data)} />
        </div>
        <ProcessDetailRail classCode={process.operationClass} classLabel={classLabel} />
      </div>
    </article>
  )
}

/**
 * Экран 11 «Процессы · карточка процесса» (PRD 9.3; 15935:1369): что автоматизируем, какие данные нужны для подбора,
 * сколько роботов подходит по классу и на каких локациях процесс уже используется.
 */
export function ProcessDetailPage() {
  const processCode = parseProcessCode(useParams().processId)
  const role = useRole()
  const { state, retry } = useProcessDetail(processCode)

  if (state.status === 'loading') return <ProcessDetailSkeleton />
  if (state.status === 'error') return <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />
  if (state.status === 'notFound') {
    return (
      <EmptyState
        title={t.notFound.title}
        description={t.notFound.description}
        action={<ButtonLink to={ROUTE_PATHS.processes}>{t.notFound.back}</ButtonLink>}
      />
    )
  }
  return <ProcessDetail data={state} isGuest={role === 'guest'} />
}
