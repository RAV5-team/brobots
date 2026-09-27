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
  readonly chargeTimeMin?: number
  readonly avgPowerKw?: number
  readonly loadTimeS?: number
  readonly unloadTimeS?: number
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
  /**
   * Пришёл из опроса источника и ещё не подтверждён администратором: метка «требует подтверждения»,
   * в подбор не идёт (PRD 6.1; правило метки — D-46, PRD 15 · №53).
   */
  readonly needsConfirmation: boolean
  /** Момент последнего изменения карточки, ISO 8601 (колонка «Обновлено» А1). */
  readonly updatedAt: string
  readonly testedByFcbas: boolean
  readonly inRegistry719: boolean
  /**
   * Фото карточки по порядку, первое — обложка (PRD 6.3, D-18). Пока только имена файлов:
   * эндпоинта загрузки нет, как у файла источника (D-51).
   */
  readonly photos?: readonly string[]
}

/**
 * Поля карточки А2 «Новый робот»: идентификатор присваивает система, остальное — сервер по токену и справочникам.
 * Производительности по классу в форме нет (D-09a) — `operationClasses` расширяемы без смены типа.
 */
export type NewRobot = Pick<
  Robot,
  'name' | 'manufacturer' | 'type' | 'subtype' | 'readiness' | 'trl' | 'priceRub' | 'operationClasses' | 'specs'
> & { readonly photos: readonly string[] }

const ROBOT_ID_PATTERN = /^RB-(\d+)$/
const ROBOT_ID_DIGITS = 4

/** Следующий свободный идентификатор RB-NNNN: максимум плюс один — код не переиспользуется (PRD 6.3). */
export function nextRobotId(ids: readonly string[]): RobotId {
  const max = ids.reduce((acc, id) => Math.max(acc, Number(ROBOT_ID_PATTERN.exec(id)?.[1] ?? 0)), 0)
  return `RB-${String(max + 1).padStart(ROBOT_ID_DIGITS, '0')}`
}

/**
 * Технические параметры карточки А2 (PRD 6.3, секция 3): по ним считается полнота ТТХ.
 * Габариты и загрузка / разгрузка — по одному параметру: поле в карточке одно.
 */
const SPEC_PARAMETERS: readonly (readonly (keyof RobotSpecs)[])[] = [
  ['payloadKg'],
  ['maxSpeedMps'],
  ['autonomyH'],
  ['chargeTimeMin'],
  ['lengthMm', 'widthMm', 'heightMm'],
  ['minTempC'],
  ['avgPowerKw'],
  ['loadTimeS', 'unloadTimeS'],
]

/** Полнота ТТХ, доля 0…1: заполненные технические параметры из восьми (D-46, PRD 15 · №16). */
export function specsCompleteness(specs: RobotSpecs): number {
  const filled = SPEC_PARAMETERS.filter((keys) => keys.every((key) => specs[key] !== undefined)).length
  return filled / SPEC_PARAMETERS.length
}

/** Название для сравнения: без регистра, лишних пробелов и различия «ё» / «е». */
const comparable = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е')

/** Тот же робот в каталоге: совпадают название и производитель — вторую строку не создаём (PRD 6.1). */
export function isSameRobot(a: Pick<Robot, 'name' | 'manufacturer'>, b: Pick<Robot, 'name' | 'manufacturer'>): boolean {
  return comparable(a.name) === comparable(b.name) && comparable(a.manufacturer) === comparable(b.manufacturer)
}
