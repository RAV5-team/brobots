import { Outlet, useLocation } from 'react-router'
import { NewProjectDialog } from '@/components/newProject/NewProjectDialog'
import { useRole } from '@/shared/auth/useRole'
import { activeNavKey } from './navigation'
import { Sidebar } from './Sidebar'
import { useShellData } from './useShellData'

/** Каркас кабинета: меню на всю высоту окна и область контента (D-01, D-04; экран 06). */
export function AppShell() {
  const role = useRole()
  const { pathname } = useLocation()
  const { counts, profile, dataVersion } = useShellData(role)

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} activeKey={activeNavKey(pathname)} counts={counts} profile={profile} dataVersion={dataVersion} />
      <main className="flex min-w-0 flex-1 flex-col gap-16 px-24 pt-24 pb-32">
        <Outlet />
      </main>
      {/* Окно A2 поверх любой страницы кабинета; у гостя его нет (D-84). */}
      {role !== 'guest' && <NewProjectDialog />}
    </div>
  )
}
