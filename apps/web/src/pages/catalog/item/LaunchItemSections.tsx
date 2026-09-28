import { Card } from '@/components/ui/Card'
import { CharacteristicRow } from '@/components/ui/CharacteristicRow'
import { ChipList, type ChipListItem } from '@/components/ui/ChipList'
import type { CompatibilityRef, LaunchItem, Robot } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { catalogItemPath, launchItemPrice } from '../catalogModel'

const t = ru.catalog.item

/**
 * Характеристики позиции для запуска на её странице (D-79): сведения о позиции — данные команды («оценка», источник
 * позиции), идентификатор и тип — из записи; характеристики — со своими статусами, подпись по порядку в данных
 * (в данных у характеристик позиции подписей нет — только значения).
 */
export function LaunchItemCharacteristics({ item }: { readonly item: LaunchItem }) {
  const estimate = (label: string, value: string) => (
    <CharacteristicRow key={label} label={label} value={value} status="estimate" source={item.source} />
  )
  return (
    <Card as="section" padding={20} gap={8} aria-labelledby="item-specs-title">
      <h2 id="item-specs-title" className="type-heading font-semibold text-text">{t.allTitle}</h2>
      <dl>
        <CharacteristicRow label={t.itemRows.id} value={item.id} status="confirmed" source={t.derived.registry} />
        <CharacteristicRow label={t.itemRows.type} value={t.itemTypes[item.type]} status="confirmed" source={t.derived.registry} />
        {estimate(t.itemRows.supplier, item.supplier)}
        {estimate(t.itemRows.price, launchItemPrice(item))}
        {estimate(t.itemRows.costType, ru.catalog.card.costType[item.costType])}
        {estimate(t.itemRows.quantityNorm, item.quantityNorm)}
        {item.specs.map((spec, i) => (
          <CharacteristicRow key={`${String(i)}-${spec.value}`} label={t.specLabel(i)} value={spec.value} status={spec.status} source={spec.source} date={spec.date} />
        ))}
      </dl>
    </Card>
  )
}

function compatibilityItem(ref: CompatibilityRef, robots: readonly Robot[], items: readonly LaunchItem[]): ChipListItem {
  if (ref.kind === 'text') return { key: ref.text, label: ref.text }
  const name = ref.kind === 'robot' ? robots.find((r) => r.id === ref.id)?.name : items.find((i) => i.id === ref.id)?.name
  return name ? { key: ref.id, label: name, to: catalogItemPath(ref.id) } : { key: ref.id, label: ref.id }
}

/** «Совместимо» — известные позиции по id со ссылками, группы текстом (D-65); без совместимости блока нет. */
export function LaunchItemCompatibility({ item, robots, items }: { readonly item: LaunchItem; readonly robots: readonly Robot[]; readonly items: readonly LaunchItem[] }) {
  if (item.compatibleWith.length === 0) return null
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="item-compatible-title">
      <h2 id="item-compatible-title" className="type-heading font-semibold text-text">{t.compatibleTitle}</h2>
      <ChipList label={t.compatibleTitle} items={item.compatibleWith.map((ref) => compatibilityItem(ref, robots, items))} />
    </Card>
  )
}
