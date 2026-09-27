import { Outlet } from 'react-router'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { CompareProvider } from '@/shared/compare/CompareProvider'

/** Корневой маршрут: роль сессии, сервисы данных и набор сравнения каталога доступны всем экранам. */
export function RootLayout() {
  return (
    <ServicesProvider>
      <RoleProvider>
        <CompareProvider>
          <Outlet />
        </CompareProvider>
      </RoleProvider>
    </ServicesProvider>
  )
}
