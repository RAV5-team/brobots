import { Outlet } from 'react-router'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { CompareProvider } from '@/shared/compare/CompareProvider'
import { ModelNormsProvider } from '@/shared/norms/ModelNormsProvider'

/** Корневой маршрут: роль сессии, сервисы данных, нормативы расчёта и набор сравнения каталога доступны всем экранам. */
export function RootLayout() {
  return (
    <ServicesProvider>
      <RoleProvider>
        <ModelNormsProvider>
          <CompareProvider>
            <Outlet />
          </CompareProvider>
        </ModelNormsProvider>
      </RoleProvider>
    </ServicesProvider>
  )
}
