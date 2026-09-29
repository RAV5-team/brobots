import { useSyncExternalStore } from 'react'
import { Outlet, useLocation } from 'react-router'
import { NewProjectDialog } from '@/components/newProject/NewProjectDialog'
import { apiGaps, subscribeApiGaps } from '@/services/api/missing'
import { useRole } from '@/shared/auth/useRole'
import { SERVICES_MODE } from '@/shared/config/api'
import { ru } from '@/shared/i18n/ru'
import { activeNavKey } from './navigation'
import { Sidebar } from './Sidebar'
import { useShellData } from './useShellData'

/** Список вызовов, которые экран сделал, а services/api их не отдаёт. */
function ApiGapBanner() {
  const gaps = useSyncExternalStore(subscribeApiGaps, apiGaps, apiGaps)
  if (SERVICES_MODE !== 'api' || gaps.length === 0) return null
  return (
    <p role="status" className="type-body-sm rounded-xl border border-danger-border bg-danger-bg px-16 py-12 text-text">
      {ru.integration.apiGap(gaps.join(', '))}
    </p>
  )
}

/** Каркас кабинета: меню на всю высоту окна и область контента (D-01, D-04; экран 06). */
export function AppShell() {
  const role = useRole()
  const { pathname } = useLocation()
  const { counts, profile, dataVersion } = useShellData(role)

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} activeKey={activeNavKey(pathname)} counts={counts} profile={profile} dataVersion={dataVersion} />
      <main className="flex min-w-0 flex-1 flex-col gap-16 px-24 pt-24 pb-32">
        <ApiGapBanner />
        <Outlet />
      </main>
      {/* Окно A2 поверх любой страницы кабинета; у гостя его нет (D-84). */}
      {role !== 'guest' && <NewProjectDialog />}
    </div>
  )
}
