import { useContext } from 'react'
import { FieldContext, type FieldControl } from './fieldContext'

/** Контрол внутри Field получает id, описание и признак ошибки; вне Field — null. */
export function useFieldControl(): FieldControl | null {
  return useContext(FieldContext)
}
