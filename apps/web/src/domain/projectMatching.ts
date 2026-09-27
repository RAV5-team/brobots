import type { AcquisitionModel } from './projectInputs'

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
  /** Подписи-флаги строки: «Чистый эффект отрицательный», «Статус поставки не подтверждён». */
  readonly warnings: readonly string[]
  readonly checks: readonly SolutionCheck[]
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
}
