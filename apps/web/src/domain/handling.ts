/** Способ обработки груза: сверяется между роботом и процессом (глоссарий, PRD 3.4). */
export type HandlingMethodCode = 'forks' | 'platform' | 'tow' | 'body' | 'manipulator' | 'brushes' | 'none'

export interface HandlingMethod {
  readonly code: HandlingMethodCode
  readonly name: string
  readonly hint: string
}
