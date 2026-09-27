import type { DataConfidence } from './common'
import type { HandlingMethodCode } from './handling'
import type { OperationClassCode } from './operationClass'

/** Идентификатор робота в каталоге: RB-NNNN, не меняется (глоссарий). */
export type RobotId = `RB-${string}`

/**
 * Класс операции робота. Производительность необязательна: в макете А2 её нет,
 * а подбору она нужна (D-09a) — тип расширяем без миграции интерфейса.
 */
export interface RobotOperationClass {
  readonly code: OperationClassCode
  readonly productivityPerHour?: number
  readonly unit?: string
  /** Исходная запись диапазона: «40–60 паллет/ч». В расчёт идёт нижняя граница. */
  readonly productivityText?: string
}

/** Статус готовности из каталога организатора. */
export type RobotReadiness = 'operation' | 'pilot' | 'rnd' | 'unknown'

export interface RobotSpecs {
  readonly payloadKg?: number
  readonly lengthMm?: number
  readonly widthMm?: number
  readonly heightMm?: number
  readonly maxSpeedMps?: number
  readonly autonomyH?: number
  readonly minTempC?: number
  readonly maxTempC?: number
  readonly handlingMethod?: HandlingMethodCode
  readonly indoor?: boolean
  readonly outdoor?: boolean
  readonly confidence: DataConfidence
  readonly sourceText?: string
}

export interface Robot {
  readonly id: RobotId
  readonly name: string
  readonly manufacturer: string
  readonly country?: string
  /** Тип и подтип каталога: «Мобильные роботы» · «AMR». */
  readonly type: string
  readonly subtype: string
  readonly readiness: RobotReadiness
  /** Уровень готовности технологии (УГТ) по файлу организатора. */
  readonly trl: number | null
  /** Цена изделия с НДС, ₽; первая из предложений — по умолчанию. null — цены нет. */
  readonly priceRub: number | null
  readonly alternativePricesRub: readonly number[]
  readonly industries: readonly string[]
  readonly scenarios: readonly string[]
  readonly description: string
  readonly operationClasses: readonly RobotOperationClass[]
  readonly specs: RobotSpecs
  readonly testedByFcbas: boolean
  readonly inRegistry719: boolean
}
