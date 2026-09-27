import { useContext } from 'react'
import type { Services } from './index'
import { ServicesContext } from './servicesContext'

/** Единственный способ экрана получить данные (замена моков на API — в ServicesProvider). */
export function useServices(): Services {
  const services = useContext(ServicesContext)
  if (services === null) throw new Error('useServices вызван вне ServicesProvider')
  return services
}
