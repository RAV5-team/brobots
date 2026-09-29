import { Navigate, useParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { isDemoOpen, parseProjectId, type ProjectStep } from '@/domain'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import type { ProjectStepComponent } from './stepProps'
import { useProjectStep } from './useProjectStep'

const t = ru.project.page

/**
 * Шаг проекта `/projects/:projectId/<step>` (D-22): каркас шага на данных проекта.
 * Шаги 02–08: параметры, подбор, симуляция, итог и экономика. Компонент шага `Step` приходит от маршрута —
 * каждый шаг в своём чанке (router.tsx), каркас их не импортирует.
 */
export function ProjectStepPage({ step, Step }: { readonly step: ProjectStep; readonly Step: ProjectStepComponent }) {
  const projectId = parseProjectId(useParams().projectId)
  const role = useRole()
  const { state, retry } = useProjectStep(projectId, step)
  const title = ru.projectStepTitles[step]

  if (state.status === 'redirect') return <Navigate to={state.to} replace />
  if (state.status === 'loading') return <div aria-busy="true"><Skeleton className="h-(--rav-location-card-height)" /></div>
  if (state.status === 'error') return <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />
  if (state.status === 'notFound') {
    return (
      <EmptyState
        size="lg"
        title={t.notFound.title}
        description={t.notFound.description}
        action={<ButtonLink to={ROUTE_PATHS.projects}>{t.notFound.back}</ButtonLink>}
      />
    )
  }
  const isGuest = role === 'guest'
  if (isGuest && state.project.isDemo === true && !isDemoOpen(state.location.facilityType)) {
    // Демо-проект виден в списке, но ещё не проработан (ролевая модель, §5): прямая ссылка его не открывает.
    return (
      <EmptyState
        size="lg"
        title={t.demoClosed.title}
        description={t.demoClosed.description}
        action={<ButtonLink to={ROUTE_PATHS.projects}>{t.demoClosed.back}</ButtonLink>}
      />
    )
  }
  return (
    <>
      <title>{t.documentTitle(title, state.project.name)}</title>
      <Step project={state.project} locationName={state.location.name} isGuest={isGuest} />
    </>
  )
}
