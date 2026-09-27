import { X } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { formatRubMillions } from '@/shared/format/money'
import { ru } from '@/shared/i18n/ru'
import { entryName, type CatalogEntry } from '../catalogModel'
import { checkOnSitePath, typeLabelOf } from './comparePaths'

const t = ru.catalog.comparePage

interface CompareColumnHeadProps {
  readonly entry: CatalogEntry
  readonly onRemove: () => void
}

/** Шапка колонки К-3 (16642:2503): тип, «×», название, производитель, цена, УГТ и «Проверить на объекте» (D-57). */
export function CompareColumnHead({ entry, onRemove }: CompareColumnHeadProps) {
  const name = entryName(entry)
  const maker = entry.kind === 'robot' ? entry.robot.manufacturer : entry.item.supplier
  const price = entry.kind === 'robot'
    ? (entry.robot.priceRub === null ? ru.catalog.card.noPrice : formatRubMillions(entry.robot.priceRub))
    : entry.item.price.kind === 'rub' ? formatRubMillions(entry.item.price.amountRub) : ru.catalog.card.percentOfCapex(entry.item.price.percent)
  const trl = entry.kind === 'robot' ? entry.robot.trl : null

  return (
    <div className="flex h-full flex-col gap-8 rounded-lg bg-surface-sunken p-16">
      <div className="flex items-center justify-between">
        <Chip>{typeLabelOf(entry)}</Chip>
        <IconButton label={t.remove(name)} icon={X} size={24} variant="ghost" onClick={onRemove} />
      </div>
      <p className="type-heading font-semibold text-text">{name}</p>
      <p className="type-caption text-text-secondary">{maker}</p>
      <p className="type-title-lg text-text">{price}</p>
      {trl !== null && <p className="px-12 py-4 type-caption font-medium text-text">{t.trl(trl)}</p>}
      <ButtonLink to={checkOnSitePath(entry)} aria-label={t.checkOnSiteLabel(name)} className="mt-auto w-full">{t.checkOnSite}</ButtonLink>
    </div>
  )
}
