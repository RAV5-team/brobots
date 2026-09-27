import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { COMPARE_LIMIT, hasEntry, type CompareEntry } from '@/domain'
import { useCompare } from '@/shared/compare/useCompare'
import { ru } from '@/shared/i18n/ru'

const t = ru.catalog.item

export interface SolutionFact {
  readonly key: string
  readonly value: string
  readonly note: string
}

interface SolutionHeroProps {
  readonly kicker: string
  readonly name: string
  readonly subtitle: string
  readonly photo?: { readonly path: string } | undefined
  /** Метка типа вместо фото: у позиции для запуска и у робота без фото (D-62, D-79). */
  readonly typeLabel: string
  readonly description?: string | undefined
  readonly compareRef: CompareEntry
  /** «Проверить на своём объекте» — адрес окна «Новый проект» с этим решением (D-57); нет — кнопки нет. */
  readonly checkOnSitePath?: string | undefined
  readonly facts: readonly SolutionFact[]
  readonly children?: ReactNode
}

/**
 * Шапка страницы решения К-4 (16777:788): тип и классы, название, производитель и регион, фото или метка типа,
 * описание, «Добавить в сравнение» (как на К-1, D-67) и «Проверить на своём объекте», плитки фактов.
 */
export function SolutionHero({ kicker, name, subtitle, photo, typeLabel, description, compareRef, checkOnSitePath, facts }: SolutionHeroProps) {
  const { entries, toggle } = useCompare()
  const inCompare = hasEntry(entries, compareRef)
  const full = entries.length >= COMPARE_LIMIT && !inCompare

  return (
    <Card as="section" padding={24} gap={20} aria-labelledby="solution-title">
      <header className="flex flex-col gap-4">
        <p className="type-caption text-text-secondary">{kicker}</p>
        <h1 id="solution-title" className="type-display-lg text-text">{name}</h1>
        <p className="type-body text-text-secondary">{subtitle}</p>
      </header>
      <div className="flex items-start gap-24">
        <div className="relative h-(--rav-solution-photo-height) w-(--rav-solution-photo-width) shrink-0 overflow-hidden rounded-lg bg-surface-muted p-16 shadow-inset-sm">
          {photo
            ? (
              <div className="absolute inset-12">
                <img src={photo.path} alt={ru.catalog.card.photoAlt(name)} decoding="async" className="size-full object-contain" />
              </div>
            )
            : <span aria-hidden="true" className="type-heading font-semibold text-text-muted">{typeLabel}</span>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-24">
          {description && <p className="type-body text-text-secondary">{description}</p>}
          <div className="flex flex-wrap items-center gap-x-12 gap-y-8">
            <Button
              aria-pressed={inCompare}
              disabled={full}
              title={full ? ru.catalog.compare.full : undefined}
              onClick={() => { toggle(compareRef) }}
            >
              {inCompare && <Check aria-hidden size={16} />}
              {inCompare ? t.inCompare : t.addToCompare}
            </Button>
            {checkOnSitePath && <ButtonLink to={checkOnSitePath}>{t.checkOnSite}</ButtonLink>}
          </div>
        </div>
      </div>
      <dl className="flex gap-12">
        {facts.map((fact) => (
          <div key={fact.key} className="flex h-(--rav-solution-fact-height) min-w-0 flex-1 flex-col-reverse justify-end gap-4 rounded-lg bg-surface-muted p-16 shadow-inset-sm">
            <dt className="type-caption text-text-secondary">{fact.note}</dt>
            <dd className="type-title-md text-text">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
