import { useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_MODEL_NORMS, modelNormsFrom, type ModelNorms } from '@/domain'
import { useServices } from '@/services/useServices'
import { ModelNormsContext } from './modelNormsContext'

/**
 * Справочник нормативов А5 на уровне приложения: расчёты экранов берут значения отсюда (аудит 2026-09-28, §3).
 * Пока справочник загружается или не загрузился — значения по умолчанию, экран не ждёт и не падает.
 */
export function ModelNormsProvider({ children }: { readonly children: ReactNode }) {
  const { admin } = useServices()
  const [norms, setNorms] = useState<ModelNorms>(DEFAULT_MODEL_NORMS)

  useEffect(() => {
    let active = true
    admin.listNorms().then(
      (list) => { if (active) setNorms(modelNormsFrom(list)) },
      (error: unknown) => { console.error('Не удалось загрузить нормативы — расчёт по значениям по умолчанию', error) },
    )
    return () => { active = false }
  }, [admin])

  return <ModelNormsContext value={norms}>{children}</ModelNormsContext>
}
