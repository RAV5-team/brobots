import type { Characteristic } from './characteristic'
import type { RobotId } from './robot'

/**
 * Тип позиции каталога: вкладка и метка на карточке (глоссарий «Позиция каталога», D-55, D-56).
 * У робота тип всегда `robot`; поле `Robot.type` — «Тип» из файла организатора, это другое.
 */
export type CatalogItemType = 'robot' | 'infrastructure' | 'software' | 'service' | 'support'
export type LaunchItemType = Exclude<CatalogItemType, 'robot'>

/** Код позиции для запуска — как в `services/api/internal/seed/data/startup_items.yaml`. */
export type LaunchItemId = `SI-${string}`

/**
 * Обязательная часть конфигурации для запуска робота (PRD 7.7, D-63). На карточке каталога — только она;
 * позиции «в зависимости от объекта» сюда не входят.
 */
export type LaunchCategory = 'charging' | 'fleet' | 'commissioning' | 'wms'

/** Тип затрат позиции: разово (CAPEX) или ежегодно (OPEX, в год). */
export type CostType = 'capex' | 'opex-yearly'

/** Цена позиции: в рублях с НДС или процентом от CAPEX в год («Сервисный контракт — 10 % CAPEX в год»). */
export type LaunchItemPrice =
  | { readonly kind: 'rub'; readonly amountRub: number }
  | { readonly kind: 'percent-of-capex'; readonly percent: number }

/**
 * Характеристика позиции на карточке — общая модель `Characteristic` (D-76): значение, статус, источник.
 * `estimate` — серая плашка на К-1 и серая ячейка на К-3 (D-64).
 */
export type LaunchItemSpec = Characteristic & { readonly value: string }

/**
 * С чем позиция совместима. Ссылки — по id позиций каталога (D-65); робота или позиции нет в каталоге,
 * либо это группа («Все наземные роботы») — текстом без ссылки.
 */
export type CompatibilityRef =
  | { readonly kind: 'robot'; readonly id: RobotId }
  | { readonly kind: 'launch-item'; readonly id: LaunchItemId }
  | { readonly kind: 'text'; readonly text: string }

/** Позиция для запуска: инфраструктура, ПО, услуги внедрения и поддержка (PRD 7.5). Данные команды, не организатора. */
export interface LaunchItem {
  readonly id: LaunchItemId
  readonly type: LaunchItemType
  readonly name: string
  readonly supplier: string
  readonly specs: readonly LaunchItemSpec[]
  readonly price: LaunchItemPrice
  readonly costType: CostType
  /** Норма на объект: «1 станция на 4 рабочих робота». */
  readonly quantityNorm: string
  readonly compatibleWith: readonly CompatibilityRef[]
  /** Какую обязательную часть конфигурации закрывает позиция; нет — позиция «в зависимости от объекта». */
  readonly launchCategory?: LaunchCategory
  /** Источник и дата значения (ТЗ 3.3.4). */
  readonly source: string
}

const isCompatibleWithRobot = (item: LaunchItem, robotId: RobotId) =>
  item.compatibleWith.some((ref) => ref.kind === 'robot' && ref.id === robotId)

/**
 * Обязательная часть конфигурации по правилу D-63, id позиций для запуска (D-78): зарядная позиция, совместимая
 * с роботом по id; ПО управления парком, если совместимо; внедрение — всегда (позиция «Все конфигурации»).
 * Совместимость «Все наземные роботы» и другие группы текстом правило не учитывает.
 */
export function deriveLaunchRequired(robotId: RobotId, items: readonly LaunchItem[]): readonly LaunchItemId[] {
  const pick = (category: LaunchCategory, needsRobot: boolean) =>
    items.find((i) => i.launchCategory === category && (!needsRobot || isCompatibleWithRobot(i, robotId)))?.id
  const found = [pick('charging', true), pick('fleet', true), pick('commissioning', false)]
  return found.filter((id): id is LaunchItemId => id !== undefined)
}

/** «Обязательная часть конфигурации — от 3,9 млн ₽ на проект»: сумма цен в рублях; процент от CAPEX не суммируется (D-78). */
export function launchCostRub(ids: readonly LaunchItemId[], items: readonly LaunchItem[]): number {
  return ids.reduce((sum, id) => {
    const price = items.find((i) => i.id === id)?.price
    return price?.kind === 'rub' ? sum + price.amountRub : sum
  }, 0)
}
