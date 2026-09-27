import { useState, type ReactNode } from 'react'
import type { Services } from './index'
import { createMockServices } from './mock'
import { ServicesContext } from './servicesContext'

interface ServicesProviderProps {
  /** Для тестов и будущего API-клиента; по умолчанию — моки на фикстурах. */
  readonly services?: Services
  readonly children: ReactNode
}

export function ServicesProvider({ services, children }: ServicesProviderProps) {
  const [value] = useState<Services>(() => services ?? createMockServices())
  return <ServicesContext value={value}>{children}</ServicesContext>
}
