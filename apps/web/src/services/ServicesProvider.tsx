import { useState, type ReactNode } from 'react'
import { OIDC_ENABLED } from '@/shared/auth/oidc'
import { SERVICES_MODE } from '@/shared/config/api'
import { createApiServices } from './api'
import { withOidcSession } from './api/session'
import type { Services } from './index'
import { createMockServices } from './mock'
import { ServicesContext } from './servicesContext'

interface ServicesProviderProps {
  /** Для тестов; по умолчанию — по VITE_SERVICES: services/api или моки на фикстурах. */
  readonly services?: Services
  readonly children: ReactNode
}

function createDefaultServices(): Services {
  const services = SERVICES_MODE === 'api' ? createApiServices() : createMockServices()
  return OIDC_ENABLED ? withOidcSession(services) : services
}

export function ServicesProvider({ services, children }: ServicesProviderProps) {
  const [value] = useState<Services>(() => services ?? createDefaultServices())
  return <ServicesContext value={value}>{children}</ServicesContext>
}
