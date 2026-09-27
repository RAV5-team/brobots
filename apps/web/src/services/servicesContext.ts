import { createContext } from 'react'
import type { Services } from './index'

export const ServicesContext = createContext<Services | null>(null)
