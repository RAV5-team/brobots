import { useCallback, useEffect, useState } from 'react'
import type { Norm, NormChange } from '@/domain'
import { useServices } from '@/services/useServices'

export type NormsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly norms: readonly Norm[] }

export type SaveState =
  | { readonly status: 'idle' }
  | { readonly status: 'saving' }
  | { readonly status: 'saved'; readonly count: number }
  | { readonly status: 'error' }

/** Данные экрана А5: справочник нормативов и его сохранение одной версией (PRD 6, 6.8). */
export function useNorms(): {
  readonly state: NormsState
  readonly saveState: SaveState
  readonly retry: () => void
  /** Сохранить правки; true — справочник обновлён. */
  readonly save: (changes: readonly NormChange[]) => Promise<boolean>
} {
  const services = useServices()
  const [state, setState] = useState<NormsState>({ status: 'loading' })
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    services.admin.listNorms()
      .then((norms) => {
        if (!cancelled) setState({ status: 'ready', norms })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить нормативы', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const save = useCallback(async (changes: readonly NormChange[]) => {
    setSaveState({ status: 'saving' })
    try {
      const norms = await services.admin.saveNorms(changes)
      setState({ status: 'ready', norms })
      setSaveState({ status: 'saved', count: changes.length })
      return true
    } catch (error: unknown) {
      console.error('Не удалось сохранить нормативы', error)
      setSaveState({ status: 'error' })
      return false
    }
  }, [services])

  return { state, saveState, retry, save }
}
