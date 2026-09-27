import { useContext } from 'react'
import { CompareContext, type CompareState } from './compareContext'

/** Набор сравнения каталога (D-58, D-69). */
export function useCompare(): CompareState {
  const state = useContext(CompareContext)
  if (state === null) throw new Error('useCompare вызван вне CompareProvider')
  return state
}
