import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton, ErrorState } from '@/components/ui/States'
import { formatDate } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { useRole } from '@/shared/auth/useRole'
import { ChecksBanner } from './ChecksBanner'
import { ContinuePanel } from './ContinuePanel'
import { DashboardKpis } from './DashboardKpis'
import { LocationsPanel } from './LocationsPanel'
import { useDashboard, type DashboardState } from './useDashboard'

const t = ru.dashboard

/** «Демо-организация · снимок данных 15.09.2026 · каталог v4 · модель 2.1» (PRD 8.1, ТЗ 3.1.5). */
function versionLine(state: Extract<DashboardState, { status: 'ready' }>): string {
  const organization = state.profile.organization ?? t.guestOrganization
  return [organization, t.snapshot(formatDate(state.dataVersion.snapshotDate)), ru.dataVersion.short(state.dataVersion)].join(' · ')
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-16" aria-busy="true">
      <div className="grid grid-cols-4 gap-16">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  )
}

/** Экран 06 «Дашборд» — первая страница после входа (PRD 8; 15935:115). */
export function DashboardPage() {
  const role = useRole()
  const { state, retry } = useDashboard(role)

  return (
    <>
      <PageHeader title={t.title} lead={state.status === 'ready' ? versionLine(state) : undefined} />

      {state.status === 'loading' && <DashboardSkeleton />}
      {state.status === 'error' && <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />}
      {state.status === 'ready' && (
        <>
          <DashboardKpis dashboard={state.dashboard} />
          <ChecksBanner checks={state.dashboard.checks} />
          <div className="flex items-stretch gap-16">
            <ContinuePanel projects={state.dashboard.recentProjects} />
            <LocationsPanel locations={state.dashboard.locations} canAdd={role !== 'guest'} />
          </div>
        </>
      )}
    </>
  )
}
