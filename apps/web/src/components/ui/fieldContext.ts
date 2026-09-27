import { createContext } from 'react'

export interface FieldControl {
  readonly id: string
  readonly describedBy: string | undefined
  readonly invalid: boolean
  readonly required: boolean
}

export const FieldContext = createContext<FieldControl | null>(null)
