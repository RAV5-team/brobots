import { Outlet } from 'react-router'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'

/** Корневой маршрут: роль сессии и сервисы данных доступны всем экранам. */
export function RootLayout() {
  return (
    <ServicesProvider>
      <RoleProvider>
        <Outlet />
      </RoleProvider>
    </ServicesProvider>
  )
}
