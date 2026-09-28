import { createContext } from 'react'
import { DEFAULT_MODEL_NORMS, type ModelNorms } from '@/domain'

/** Без провайдера (тесты отдельных компонентов, витрины) — значения справочника по умолчанию. */
export const ModelNormsContext = createContext<ModelNorms>(DEFAULT_MODEL_NORMS)
