import { use } from 'react'
import type { ModelNorms } from '@/domain'
import { ModelNormsContext } from './modelNormsContext'

/** Нормативы А5 для расчётов экрана (PRD 6.8). */
export function useModelNorms(): ModelNorms {
  return use(ModelNormsContext)
}
