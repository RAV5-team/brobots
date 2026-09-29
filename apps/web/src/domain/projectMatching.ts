import type { AcquisitionModel, CalcParams } from './projectInputs'

/** Откуда условие отбора: задача (процесс локации), формула, правка в проекте, правило подбора. */
export type MatchConditionSource = 'task' | 'formula' | 'project' | 'rule'

/** Жёсткое условие отбора (PRD 11.3): класс операции, способ обработки, грузоподъёмность, ширина, среда, цена. */
export interface MatchCondition {
  readonly code: string
  readonly label: string
  readonly number: number | null
  readonly unit: string | null
  readonly text: string | null
  readonly list: readonly string[]
  readonly source: MatchConditionSource
  readonly note: string | null
  readonly applicable: boolean
}

/** Результат проверки условия у решения. */
export type CheckStatus = 'pass' | 'fail' | 'unknown' | 'not_applicable'

export interface SolutionCheck {
  readonly code: string
  readonly label: string
  readonly status: CheckStatus
  readonly message: string | null
}

/** Как решение прошло отбор: прошло, требует проверки площадки, добавлено вручную вне рейтинга. */
export type VariantStatus = 'passed' | 'needs_verification' | 'manual'

/** Вклад критерия в балл рейтинга (вкладка «Обзор» карточки, PRD 11.3). */
export interface ScoreContribution {
  readonly code: string
  readonly label: string
  /** Вес, доля 0–1. */
  readonly weight: number
  /** Вклад в балл 0–1; null — нет данных. */
  readonly contribution: number | null
}

/** Вариант рейтинга — пара «решение × способ приобретения» (PRD 11.3). */
export interface RankedVariant {
  readonly solutionId: string
  readonly solutionName: string
  readonly manufacturer: string
  readonly acquisition: AcquisitionModel
  /** Место в рейтинге; null — вне рейтинга (добавлено вручную, не посчитано). */
  readonly rank: number | null
  readonly score: number | null
  readonly status: VariantStatus
  readonly robots: number
  readonly stations: number | null
  readonly capexRub: number
  readonly raasMonthlyRub: number | null
  readonly opexRubPerYear: number
  readonly annualEffectRub: number
  readonly laborSavingsRubPerYear: number | null
  /** null — не окупается. */
  readonly paybackYears: number | null
  readonly roi: number | null
  readonly tcoRub: number | null
  readonly criteria: readonly ScoreContribution[]
  /** Цикл рейса, с; null — расчёт не отдал (панель «Как рассчитано», 03a). */
  readonly cycleTimeS: number | null
  /** Загрузка парка, доля 0–1. */
  readonly fleetUtilization: number | null
  /** Статьи CAPEX и OPEX в год — из чего сложились итоги; пусто — расчёт не отдал разложение. */
  readonly capexItems: readonly CostItem[]
  readonly opexItems: readonly CostItem[]
  /** Подписи-флаги строки: «Чистый эффект отрицательный», «Статус поставки не подтверждён». */
  readonly warnings: readonly string[]
  readonly checks: readonly SolutionCheck[]

  // Окно 2.1а «Подробнее о решении» (доска 16325). Поля необязательные: нет — «нет данных» на вкладке.
  /** Полный разбор балла по 8 критериям для строки рейтинга и «Обзора» 2.1а; `criteria` — то, что показывает рейтинг 03. */
  readonly scoreBreakdown?: readonly ScoreContribution[]
  /** «Почему подходит» и «Недостающие данные» (вкладка «Обзор»). */
  readonly reasons?: VariantReasons
  /** Ограничения решения в проекте — коды `Candidate.risks`: specs_unconfirmed, throughput_unknown, hypothesis_only. */
  readonly limitations?: readonly string[]
  /** Краткое пояснение подбора (`Candidate.summary`). */
  readonly summary?: string
  /** Предложение из каталога, по которому посчитан вариант (`Candidate.offerId`). */
  readonly offerId?: string
  /** Шаги расчёта с формулами и входами (`CalcResult.trace`) — «Как рассчитано» на вкладке «Экономика». */
  readonly calcTrace?: readonly CalcTraceStep[]
  /** Цена единицы с источником (вкладка «Экономика», «Цена и источник»). */
  readonly priceOffer?: PriceOffer
  /** ПО, внедрение, обслуживание и срок службы — с признаком допущения. */
  readonly ownership?: OwnershipCosts
  /** Чистый эффект в год по статьям: экономия ФОТ, иные эффекты, новые расходы. Сумма — `annualEffectRub`. */
  readonly netEffectItems?: readonly EffectItem[]
  /** Условия RaaS — только у варианта `raas`. */
  readonly raasTerms?: RaasTerms
  /** Вспомогательное оборудование — результат расчёта (вкладка «Инфраструктура»). */
  readonly auxEquipment?: AuxEquipment
  /** Эффективная производительность для процесса с пояснением (вкладка «Технические»). */
  readonly effectiveProductivity?: EffectiveProductivity
}

/** Прошедшие проверки («✓») и проверки без данных («?»). */
export interface VariantReasons {
  readonly fits: readonly SolutionCheck[]
  readonly missing: readonly SolutionCheck[]
}

/** Шаг расчёта: формула, входы, результат (в API — TraceItem). */
export interface CalcTraceStep {
  readonly code: string
  readonly label: string
  readonly formula: string | null
  readonly value: number | null
  readonly unit: string | null
  /** Нечисловой результат шага: интерпретация. */
  readonly text: string | null
  readonly source: 'task' | 'location' | 'robot' | 'norm' | 'derived' | null
  readonly inputs: readonly { readonly name: string; readonly value: number | null; readonly text: string | null }[]
}

/** Откуда значение и на какую дату: «Файл цен организатора · 01.09.2026». */
export interface ValueSourceRef {
  readonly source: string
  /** `YYYY-MM-DD`; нет — дата неизвестна. */
  readonly date?: string
}

/** Цена единицы в расчёте варианта (может отличаться от цены каталога — PRD 15 · №107). */
export interface PriceOffer extends ValueSourceRef {
  readonly unitPriceRub: number
  readonly currency: 'RUB'
  /** НДС включён в цену — повторно не начисляется. null — неизвестно. */
  readonly vatIncluded: boolean | null
  readonly included: readonly string[]
  readonly excluded: readonly string[]
  /** «AMR 800 · базовая комплектация». */
  readonly offerName: string
}

/** Сумма с признаком «оценка, допущение модели». */
export interface AssumedAmount {
  readonly value: number
  readonly assumption: boolean
  readonly note?: string
}

export interface OwnershipCosts {
  readonly softwareOneOffRub: number | null
  readonly softwareRubPerYear: number | null
  readonly implementationRub: AssumedAmount | null
  /** Обслуживание парка в год (покупка); у RaaS входит в тариф. */
  readonly serviceRubPerYear: number | null
  readonly serviceLifeYears: AssumedAmount | null
}

/** Статья чистого эффекта: labor — экономия ФОТ, other — иные эффекты, new_costs — новые расходы (со знаком минус). */
export interface EffectItem {
  readonly code: string
  readonly kind: 'labor' | 'other' | 'new_costs'
  readonly label: string
  readonly amountRub: number
}

/** Условия RaaS (вкладка «Экономика», 12 строк). Платёж в месяц за парк выводится: ставка × роботов. */
export interface RaasTerms extends ValueSourceRef {
  readonly tariffStructure: 'fixed' | 'usage' | 'mixed'
  /** База начисления: «за робота в месяц». */
  readonly billingBase: string
  readonly rateRub: number
  /** Как объём использования влияет на платёж: «не влияет на платёж». */
  readonly usageNote: string | null
  readonly monthlyFleetRub: number
  readonly includedServices: readonly string[]
  readonly extraCosts: readonly string[]
  readonly contractMonths: number | null
  /** Условия продления; null — неизвестны. */
  readonly renewal: string | null
  /** Условия выкупа; null — не представлены. */
  readonly buyout: string | null
  /** Индексация платежей, доля в год. */
  readonly indexationPerYear: number | null
  /** Что принято допущением: «продление по тому же тарифу», «индексация 5 %». */
  readonly assumptions: readonly string[]
}

/** Количество — результат расчёта; null — расчёт не отдал. */
export interface AuxEquipment {
  readonly stations: number | null
  readonly adapters: number | null
  readonly wifiPoints: number | null
}

/** Эффективная производительность: 3 600 ÷ цикл × загрузка (как в движке симуляции, `eff_prod`). */
export interface EffectiveProductivity {
  readonly tripsPerHour: number
  readonly cycleTimeS: number | null
  readonly loadTimeS: number | null
  readonly utilization: number | null
  /** Доля времени на зарядке. */
  readonly chargingShare: number | null
}

/** Статья затрат расчёта: «Зарядная инфраструктура · 3,1 млн ₽». */
export interface CostItem {
  readonly code: string
  readonly label: string
  readonly amountRub: number
}

/** Решение, не прошедшее жёсткие фильтры, с причинами (PRD 11.3). */
export interface ExcludedSolution {
  readonly solutionId: string
  readonly solutionName: string
  readonly manufacturer: string
  /** Непройденные проверки: что требуется и что у решения. */
  readonly reasons: readonly SolutionCheck[]
}

export interface MatchCounts {
  readonly total: number
  readonly passed: number
  readonly needsVerification: number
  readonly excluded: number
  readonly manual: number
}

/** Расчёт подбора проекта (в API — Evaluation). */
export interface MatchingEvaluation {
  readonly id: string
  /** Параметры проекта изменились после расчёта — нужен новый расчёт. */
  readonly stale: boolean
  readonly conditions: readonly MatchCondition[]
  /** Сначала по месту в рейтинге, затем вне рейтинга. */
  readonly variants: readonly RankedVariant[]
  readonly excluded: readonly ExcludedSolution[]
  readonly counts: MatchCounts
  /** Рекомендация системы — первое место рейтинга. */
  readonly recommended: { readonly solutionId: string; readonly acquisition: AcquisitionModel } | null
  readonly horizonYears: number
  readonly modelVersion: string
  /** Текущий процесс без роботов — база «Сравнить с текущим процессом» (PRD 11.3); null — не посчитан. */
  readonly baseline: MatchBaseline | null
  /** Исходные значения «Параметров расчёта» (PRD 11.3): пустое поле панели — это значение; null — сервис не прислал. */
  readonly calcDefaults: CalcParams | null
}

/** Текущий процесс: расходы в год и TCO за горизонт расчёта. */
export interface MatchBaseline {
  readonly opexRubPerYear: number
  readonly tcoRub: number | null
}
