import type { CompatibilityRef, LaunchItem, LaunchItemType, Robot } from '@/domain'
import { Chip } from '@/components/ui/Chip'
import { ChipList, type ChipListItem } from '@/components/ui/ChipList'
import { formatRubMillions } from '@/shared/format/money'
import { ru } from '@/shared/i18n/ru'
import { CardSection, CatalogCardFrame } from './CatalogCardFrame'
import { catalogItemPath } from './catalogModel'

const t = ru.catalog.card

/** Метка типа на плашке карточки (D-56). */
const TYPE_LABEL: Record<LaunchItemType, string> = { infrastructure: 'INF', software: 'SW', service: 'SRV', support: 'SUP' }

/** Сколько совместимых позиций показать; остальные — «ещё N» (D-65). */
const MAX_COMPATIBLE = 2

interface CatalogLaunchItemCardProps {
  readonly item: LaunchItem
  readonly robots: readonly Robot[]
  readonly items: readonly LaunchItem[]
  readonly inCompare: boolean
  readonly compareFull: boolean
  readonly onCompare: () => void
}

/** Совместимость по id — ссылка на позицию; нет в каталоге или группа — текст без ссылки (D-65). */
function compatibilityItem(ref: CompatibilityRef, robots: readonly Robot[], items: readonly LaunchItem[]): ChipListItem {
  if (ref.kind === 'text') return { key: ref.text, label: ref.text }
  const name = ref.kind === 'robot' ? robots.find((r) => r.id === ref.id)?.name : items.find((i) => i.id === ref.id)?.name
  return name ? { key: ref.id, label: name, to: catalogItemPath(ref.id) } : { key: ref.id, label: ref.id }
}

/** Карточка позиции для запуска К-1 (PRD 7.5; 16642:1090, 1549, 1757, 1924). */
export function CatalogLaunchItemCard({ item, robots, items, inCompare, compareFull, onCompare }: CatalogLaunchItemCardProps) {
  const price = item.price.kind === 'rub' ? formatRubMillions(item.price.amountRub) : t.percentOfCapex(item.price.percent)
  return (
    <CatalogCardFrame
      id={item.id}
      name={item.name}
      typeLabel={TYPE_LABEL[item.type]}
      subtitle={item.supplier}
      inCompare={inCompare}
      compareFull={compareFull}
      onCompare={onCompare}
    >
      <ChipList items={item.specs.map((spec) => ({ key: spec.value, label: spec.value, unconfirmed: spec.status !== 'confirmed' }))} />
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <p className="type-title-md text-text">{price}</p>
        <Chip>{t.costType[item.costType]}</Chip>
      </div>
      <div className="flex flex-col gap-8">
        <p className="type-caption text-text-secondary">{item.quantityNorm}</p>
        {item.compatibleWith.length > 0 && (
          <CardSection
            title={t.compatible}
            items={item.compatibleWith.map((ref) => compatibilityItem(ref, robots, items))}
            max={MAX_COMPATIBLE}
          />
        )}
      </div>
    </CatalogCardFrame>
  )
}
