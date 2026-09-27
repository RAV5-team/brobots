import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChipList, type ChipListItem } from '@/components/ui/ChipList'
import { ru } from '@/shared/i18n/ru'
import { catalogItemPath } from './catalogModel'

const t = ru.catalog

interface CatalogCardFrameProps {
  readonly id: string
  readonly name: string
  /** Фото из данных (D-62); нет — плашка с меткой типа. */
  readonly photo?: { readonly path: string } | undefined
  readonly typeLabel: string
  readonly subtitle: string
  readonly children: ReactNode
  readonly inCompare: boolean
  /** Набор полон, а позиции в нём нет — «Сравнить» недоступна (D-67). */
  readonly compareFull: boolean
  readonly onCompare: () => void
}

/**
 * Каркас карточки каталога К-1 (16642:671, 16642:1090): плашка фото 120, заголовок, секции, кнопки
 * «Подробнее» (страница решения, D-57) и «Сравнить» (переключатель набора, D-67).
 */
export function CatalogCardFrame({ id, name, photo, typeLabel, subtitle, children, inCompare, compareFull, onCompare }: CatalogCardFrameProps) {
  return (
    <Card as="article" variant="tile" padding={12} gap={16} aria-label={name} className="h-full pb-16">
      <div className="relative h-(--rav-catalog-photo-height) shrink-0 overflow-hidden rounded-md bg-surface-muted p-16 shadow-inset-md">
        {photo
          ? (
            // Размер задаёт плашка, а не картинка: фото разных пропорций не сдвигают карточку.
            <div className="absolute inset-10">
              <img src={photo.path} alt={t.card.photoAlt(name)} loading="lazy" decoding="async" className="size-full object-contain" />
            </div>
          )
          : <span aria-hidden="true" className="type-heading font-semibold text-text-muted">{typeLabel}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-16 px-8">
        <header className="flex flex-col gap-4">
          <h2 className="type-heading font-semibold text-text">{name}</h2>
          <p className="type-caption text-text-secondary">{subtitle}</p>
        </header>
        {children}
      </div>
      <div className="flex gap-8 px-8">
        <ButtonLink to={catalogItemPath(id)} aria-label={t.card.detailsLabel(name)} className="flex-1">{t.card.details}</ButtonLink>
        <Button
          aria-pressed={inCompare}
          aria-label={t.compare.itemLabel(inCompare ? t.compare.added : t.compare.add, name)}
          title={compareFull ? t.compare.full : undefined}
          disabled={compareFull}
          onClick={onCompare}
          className="flex-1"
        >
          {inCompare && <Check aria-hidden size={16} />}
          {inCompare ? t.compare.added : t.compare.add}
        </Button>
      </div>
    </Card>
  )
}

interface CardSectionProps {
  readonly title: string
  readonly items: readonly ChipListItem[]
  readonly max?: number
}

/** Секция карточки: подпись капсом и ряд плашек («КЛАСС ОПЕРАЦИИ», «ДЛЯ ЗАПУСКА», «СОВМЕСТИМО»). */
export function CardSection({ title, items, max }: CardSectionProps) {
  return (
    <section className="flex flex-col gap-6">
      <h3 className="type-overline text-text-muted">{title}</h3>
      <ChipList items={items} label={title} {...(max !== undefined ? { max } : {})} />
    </section>
  )
}
