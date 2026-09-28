import { Navigate, useParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import type { ProjectId, ProjectStep } from '@/domain'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { EconomicsStep } from './economics/EconomicsStep'
import { MatchingStep } from './matching/MatchingStep'
import { ParamsStep } from './params/ParamsStep'
import { SimulationStep } from './simulation/SimulationStep'
import { useProjectStep } from './useProjectStep'

const t = ru.project.page

/**
 * Шаг проекта `/projects/:projectId/<step>` (D-22): каркас шага на данных проекта.
 * Шаги 02–08: параметры, подбор, симуляция, итог и экономика.
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
  const isGuest = role === 'guest'
  return (
    <>
      <title>{t.documentTitle(title, state.project.name)}</title>
      {step === 'params' && <ParamsStep project={state.project} locationName={state.location.name} isGuest={isGuest} />}
      {step === 'matching' && <MatchingStep project={state.project} locationName={state.location.name} isGuest={isGuest} />}
      {step === 'simulation' && <SimulationStep project={state.project} locationName={state.location.name} isGuest={isGuest} />}
      {step === 'economics' && <EconomicsStep project={state.project} locationName={state.location.name} isGuest={isGuest} />}
    </>
  )
}
