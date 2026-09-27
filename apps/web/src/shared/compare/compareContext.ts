import { createContext } from 'react'
import type { CompareEntry } from '@/domain'

export interface CompareState {
  readonly entries: readonly CompareEntry[]
  /** Сообщение последней неудачной операции: набор полон, сервис недоступен. */
  readonly error: string | null
  readonly toggle: (entry: CompareEntry) => void
  readonly clear: () => void
}

export const CompareContext = createContext<CompareState | null>(null)
