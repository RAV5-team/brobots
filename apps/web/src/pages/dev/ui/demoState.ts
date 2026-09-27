import { ru } from '@/shared/i18n/ru'

export type DemoState = keyof typeof ru.dev.states

export interface StateProps {
  /** data-demo-state для hover / active / focus; undefined — обычное состояние. */
  readonly 'data-demo-state'?: string
  readonly disabled?: boolean
}

/** Свойства, которые переводят контрол в нужное состояние витрины. */
export function stateProps(state: DemoState): StateProps {
  if (state === 'disabled') return { disabled: true }
  if (state === 'hover' || state === 'active' || state === 'focus') return { 'data-demo-state': state }
  return {}
}
