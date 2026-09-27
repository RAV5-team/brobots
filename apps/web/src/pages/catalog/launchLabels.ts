import type { LaunchItem, LaunchItemId } from '@/domain'
import { ru } from '@/shared/i18n/ru'

type LabelSet = Readonly<Record<NonNullable<LaunchItem['launchCategory']>, string>>

/**
 * Подписи состава запуска робота по id позиций (D-78): у позиции с категорией — подпись категории
 * («зарядка» на К-1, «Зарядная станция» на К-3), без категории — название позиции.
 */
export function launchLabels(ids: readonly LaunchItemId[], items: readonly LaunchItem[], labels: LabelSet): readonly string[] {
  return ids.map((id) => {
    const item = items.find((i) => i.id === id)
    if (!item) return id
    return item.launchCategory ? labels[item.launchCategory] : item.name
  })
}

export const CARD_LAUNCH_LABELS: LabelSet = ru.catalog.launchCategory
export const COMPARE_LAUNCH_LABELS: LabelSet = ru.catalog.comparePage.launchInfrastructure
