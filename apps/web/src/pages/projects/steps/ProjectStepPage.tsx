import { Navigate, useParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import type { ProjectId, ProjectStep } from '@/domain'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { ProjectStepLayout } from './ProjectStepLayout'
import { useProjectStep } from './useProjectStep'

const t = ru.project.page

/**
 * Шаг проекта `/projects/:projectId/<step>` (D-22): каркас шага на данных проекта.
 * Содержание шагов 02–08 — экраны пункта 6 плана; до них — плашка «собирается».
 */
export function ProjectStepPage({ step }: { readonly step: ProjectStep }) {
  const { projectId = '' } = useParams()
  const role = useRole()
  const { state, retry } = useProjectStep(projectId as ProjectId, step)
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
  return (
    <>
      <title>{t.documentTitle(title, state.project.name)}</title>
      <ProjectStepLayout project={state.project} locationName={state.location.name} step={step} isGuest={role === 'guest'} title={title}>
        <EmptyState title={t.pending.title} description={t.pending.description} />
      </ProjectStepLayout>
    </>
  )
}
