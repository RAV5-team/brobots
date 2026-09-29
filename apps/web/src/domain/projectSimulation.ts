import type { Fleet, SimulationConditions } from './projectInputs'

/**
 * Вердикт симуляции (PRD 11.4). В API симуляции — `confirmed | can_reduce | needs_additions | layout_bottleneck | not_achievable`.
 */
export type SimulationVerdict = 'confirmed' | 'can_reduce' | 'need_more' | 'layout_bottleneck' | 'unreachable'

/** Строка «Что происходило по часам» (PRD 11.4): рейсы, срок, состояния парка. */
export interface HourlyStat {
  /** Час на часах объекта, 0–23. */
  readonly hour: number
  /** Рейсов потребности за час. */
  readonly demand: number
  /** Рейсов выполнено. */
  readonly done: number
  /** Доля паллет в срок 0–1; null — потребности не было. */
  readonly onTime: number | null
  /** Паллета ждёт робота в среднем, мин; null — не было подборов. */
  readonly waitMeanMin: number | null
  /** Среднее число роботов в работе, на зарядке, в очереди к станции, в ремонте, свободных. */
  readonly working: number
  readonly charging: number
  readonly waitingCharger: number
  readonly down: number
  readonly idle: number
  /** Доля парка в работе 0–1. */
  readonly utilization: number
  readonly backlogMax: number
  /** Доля занятых станций 0–1. */
  readonly chargersBusy: number
}

/** Пиковая пропускная способность: требуется и вывезено рейсов в час. */
export interface PeakThroughput {
  readonly requiredPerHour: number
  readonly servedPerHour: number
}

/** Итоги прогона одного состава: пик, срок в худший день, загрузка в пик. */
export interface RunKpis {
  readonly peak: PeakThroughput
  /** Доля паллет в срок в худший смоделированный день 0–1. */
  readonly onTimeWorstDay: number
  /** Средняя загрузка парка в пиковые часы 0–1. */
  readonly utilizationPeak: number
  /** Доли времени парка по состояниям робота (в API — fleet_shares): «to_drop» → 0,19. Сумма — 1; пусто — нет данных. */
  readonly fleetShares: Readonly<Record<string, number>>
}

/**
 * Поправка методики по данным симуляции (в API — `adjusted_input_set.items`, 3.4 «Уточнить методику»):
 * норматив расчёта подбора против измеренного на модели. Какие принять — решает пользователь
 * (`SimulationInputs.calibration`, D-89); состав парка (`group: fleet`) заменяет результат формулы подбора.
 */
export interface SimulationAdjustment {
  readonly code: string
  readonly group: 'fleet' | 'coefficient'
  readonly label: string
  /** Значение расчёта подбора; null — расчёт его не дал. */
  readonly base: number | null
  /** Измерено в симуляции; null — не измерено. */
  readonly simulated: number | null
  readonly unit: string
  /** override — заменяет значение; calibration — уточняет коэффициент расчёта. */
  readonly apply: 'override' | 'calibration'
  readonly note: string
  /** (измерено − норматив) ÷ норматив; null — нет одного из значений. */
  readonly deltaRel: number | null
  /** Отклонение больше допуска прогона или изменился состав. */
  readonly significant: boolean
  /** Отмечена по умолчанию (у движка — только изменённый состав). */
  readonly defaultSelected: boolean
}

/** Прогон симуляции (в API — SimulationRun). */
export interface SimulationRun {
  readonly id: string
  readonly verdict: SimulationVerdict
  /** «обновлено по 2D-модели», если итоговый состав отличается от проверенного. */
  readonly label: string | null
  readonly title: string
  readonly lines: readonly string[]
  readonly justification: readonly string[]
  readonly risks: readonly string[]
  readonly diagnosis: readonly string[]
  /** Проверенный состав и итоговый (рекомендация симуляции). */
  readonly from: Fleet
  readonly to: Fleet
  readonly peak: PeakThroughput
  /** Доля паллет в срок в худший смоделированный день 0–1. */
  readonly onTimeWorstDay: number
  /** Средняя загрузка парка в пиковые часы 0–1. */
  readonly utilizationPeak: number
  /** Доли времени итогового состава по состояниям робота (kpis.fleet_shares). */
  readonly fleetShares: Readonly<Record<string, number>>
  /** Итоги проверенного состава `from` (в API — kpis_before); выше — итогового `to`. */
  readonly before: RunKpis
  readonly hourlyBefore: readonly HourlyStat[]
  readonly hourlyAfter: readonly HourlyStat[]
  readonly warnings: readonly string[]
  /** Предлагаемые поправки методики; пусто — поправок нет. */
  readonly adjustments: readonly SimulationAdjustment[]
}

/**
 * Что уходит в прогон (`POST /api/simulations`): состав этапа 1 и условия этапа 2. Передаётся явно, а не берётся
 * из сохранённого проекта: у гостя решения живут только на странице (D-14). Условий в API пока нет — api-contract.md, №13.
 */
export interface SimulationRequest {
  readonly fleet: Fleet
  readonly conditions: Partial<SimulationConditions>
}

/** Ход задания на прогон (этап 3). */
export interface SimulationJob {
  readonly id: string
  readonly status: 'queued' | 'running' | 'done' | 'error'
  /** Журнал прогона строками. */
  readonly log: readonly string[]
  readonly elapsedS: number
  /** Готовый прогон; null — ещё идёт или ошибка. */
  readonly runId: string | null
  readonly error: string | null
}

/** Переход к экономике закрыт при узком месте планировки и недостижимом составе (PRD 11.4). */
export function canProceedToEconomics(verdict: SimulationVerdict): boolean {
  return verdict !== 'layout_bottleneck' && verdict !== 'unreachable'
}
