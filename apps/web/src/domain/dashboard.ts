import type { LocationId } from './location'

/** Годовая стоимость ручной работы на локации, ₽ — до экономической модели приходит готовой (PRD 8.2). */
export interface LocationLaborCost {
  readonly locationId: LocationId
  readonly annualRub: number
}

/** «Уточнения и проверки»: сколько пунктов всего и первые из них для строки-анонса (PRD 8.3). */
export interface DashboardChecks {
  readonly total: number
  readonly preview: readonly string[]
}

/** Данные дашборда, которых нет в других сервисах. Счётчики и суммы экран считает сам (D-13). */
export interface DashboardInputs {
  readonly laborCosts: readonly LocationLaborCost[]
  readonly checks: DashboardChecks
}
