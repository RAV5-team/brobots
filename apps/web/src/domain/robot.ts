import type { LaunchItemId } from './catalogItem'
import type { Characteristic } from './characteristic'
import type { DataConfidence } from './common'
import type { HandlingMethodCode } from './handling'
import type { OperationClassCode } from './operationClass'
import type { RobotCharacteristicKey } from './robotCharacteristics'

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
  /** Откуда привязка класса, если её сделали не по данным робота: «привязка администратора (демо), по макету К-1» (D-61). */
  readonly source?: string
}

/** Статус готовности из каталога организатора. */
export type RobotReadiness = 'operation' | 'pilot' | 'rnd' | 'unknown'

export interface RobotSpecs {
  readonly payloadKg?: number
  /** Собственная масса без груза, кг (окно 2.1а, «Технические»); в К-4 масса — только в тексте «Габариты». */
  readonly massKg?: number
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
  /** Регион производителя из файла организатора (колонка «Регион»): строка «Регион» сравнения К-3 (PRD 7.6). */
  readonly region?: string
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
  /** Короткое «Назначение» (окно 2.1а, «Идентификация»): «Перемещение паллет и тележек». Нет — показывают `description`. */
  readonly purpose?: string
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
  /**
   * Фото карточки каталога К-1: путь в `apps/web/public` и источник (D-62). Нет — на карточке плашка с меткой типа.
   * Не путать с `photos`: там имена файлов, загруженных в карточку А2.
   */
  readonly photo?: RobotPhoto
  /**
   * Состав запуска (PRD 7.7, D-78) — id позиций для запуска: обязательная часть (плашки «Для запуска» на К-1,
   * сумма «от X млн ₽ на проект» на К-4) и позиции «в зависимости от объекта».
   */
  readonly launchRequired: readonly LaunchItemId[]
  readonly launchConditional: readonly LaunchItemId[]
  /** Кейсы внедрения из файла организатора (колонка «Кейсы»): строка «Реализованные кейсы» К-4. */
  readonly cases?: string
  /**
   * Характеристики, которых нет в полях робота: значение, статус, источник (D-76). Остальные строки К-4 выводятся
   * из полей; нет ни там, ни тут — «нет данных». Сейчас заполнено только у AMR 800 (`provenance`).
   */
  readonly characteristics?: RobotCharacteristics
}

export interface RobotCharacteristics {
  /** Откуда вся запись: «по макету К-4, данные команды». */
  readonly provenance: string
  readonly values: Readonly<Partial<Record<RobotCharacteristicKey, Characteristic>>>
}

export interface RobotPhoto {
  /** Путь от корня сайта: `/catalog/rb-0007.webp`. */
  readonly path: string
  readonly source: string
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
