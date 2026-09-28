import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Chip } from '@/components/ui/Chip'
import { CompareTable, type CompareColumn } from '@/components/ui/CompareTable'
import { Card } from '@/components/ui/Card'
import { IconButton } from '@/components/ui/IconButton'
import type { HandlingMethod } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { compareGroups, type CompareEntry } from './compareModel'

const t = ru.project.matching
const c = t.compare

interface CompareSectionProps {
  readonly entries: readonly CompareEntry[]
  readonly handlingMethods: readonly HandlingMethod[]
  readonly siteUnchecked: number
  readonly onClose: () => void
}

function header(e: CompareEntry) {
  return (
    <span className="flex flex-col gap-4 px-12">
      <span className="type-body font-semibold text-text">{e.name}</span>
      {e.violations && <Chip tone="unconfirmed" size="xs">{c.outOfRanking}</Chip>}
      {e.violations && <span className="type-caption text-danger">{c.violates}</span>}
    </span>
  )
}

/**
 * «Сравнение вариантов» (PRD 11.3): 2–4 варианта по одинаковым объёму, горизонту и границам затрат — экономика,
 * техника, инфраструктура и данные. Панель в основной колонке, а не окно: 4 колонки не помещаются в 560 (D-96).
 */
export function CompareSection({ entries, handlingMethods, siteUnchecked, onClose }: CompareSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ block: 'start' }); ref.current?.focus() }, [])
  const columns: CompareColumn[] = entries.map((e) => ({ key: e.key, label: e.name, header: header(e) }))
  return (
    // Открытая панель получает фокус и прокручивается в вид: иначе её не заметить под рейтингом.
    <div ref={ref} tabIndex={-1} className="outline-none">
    <Card as="section" padding={24} gap={12} aria-labelledby="matching-compare-title">
      <div className="flex items-start justify-between gap-16">
        <div className="flex flex-col gap-4">
          <h2 id="matching-compare-title" className="type-heading text-text">{c.title}</h2>
          <p className="type-caption text-text-secondary">{c.lead}</p>
        </div>
        <IconButton label={c.close} icon={X} onClick={onClose} />
      </div>
      <CompareTable caption={c.caption} columns={columns} groups={compareGroups(entries, { handlingMethods, siteUnchecked })} labelWidth="compact" />
    </Card>
    </div>
  )
}
