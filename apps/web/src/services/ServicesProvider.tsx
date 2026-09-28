import { useState, type ReactNode } from 'react'
import { SERVICES_MODE } from '@/shared/config/api'
import { createApiServices } from './api'
import type { Services } from './index'
import { createMockServices } from './mock'
import { ServicesContext } from './servicesContext'

interface ServicesProviderProps {
  /** Для тестов; по умолчанию — по VITE_SERVICES: services/api или моки на фикстурах. */
  readonly services?: Services
  readonly children: ReactNode
}

export function ServicesProvider({ services, children }: ServicesProviderProps) {
  const [value] = useState<Services>(() => services ?? (SERVICES_MODE === 'api' ? createApiServices() : createMockServices()))
  return <ServicesContext value={value}>{children}</ServicesContext>
}
