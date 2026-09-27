import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { hasEntry, type CompareEntry } from '@/domain'
import { useServices } from '@/services/useServices'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { CompareContext, type CompareState } from './compareContext'

const errorText = (error: unknown) => (error instanceof Error ? error.message : ru.catalog.compare.failed)

/**
 * Набор сравнения на уровне приложения (D-58): счётчик «Сравнить (N)» и кнопки карточек видят одно состояние.
 * Хранение — только через CompareService (D-69); при смене роли набор перечитывается.
 */
export function CompareProvider({ children }: { children: ReactNode }) {
  const { compare } = useServices()
  const role = useRole()
  const [entries, setEntries] = useState<readonly CompareEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    compare.list(role).then(
      (list) => { if (active) setEntries(list) },
      (e: unknown) => { if (active) setError(errorText(e)) },
    )
    return () => { active = false }
  }, [compare, role])

  const run = useCallback((operation: Promise<readonly CompareEntry[]>) => {
    operation.then(
      (list) => { setEntries(list); setError(null) },
      (e: unknown) => { setError(errorText(e)) },
    )
  }, [])

  const toggle = useCallback((entry: CompareEntry) => {
    run(hasEntry(entries, entry) ? compare.remove(role, entry) : compare.add(role, entry))
  }, [compare, entries, role, run])

  const clear = useCallback(() => { run(compare.clear(role)) }, [compare, role, run])

  const value = useMemo<CompareState>(() => ({ entries, error, toggle, clear }), [entries, error, toggle, clear])
  return <CompareContext value={value}>{children}</CompareContext>
}
