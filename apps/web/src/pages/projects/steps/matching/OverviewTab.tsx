import { Check, CircleHelp } from 'lucide-react'
import { ru } from '@/shared/i18n/ru'
import { formatScore } from './matchingModel'
import { DetailRows as Rows, DetailsGroup as Group } from './detailsParts'
import type { OverviewView } from './variantDetailsModel'

const o = ru.project.matching.details.overview
const groups = ru.catalog.item.groups

function Points({ items, icon, empty }: { readonly items: readonly string[]; readonly icon: 'fit' | 'missing'; readonly empty: string }) {
  if (items.length === 0) return <p className="type-body text-text-secondary">{empty}</p>
  return (
    <ul className="flex flex-col gap-8">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-8 type-body text-text">
          {icon === 'fit'
            ? <Check aria-hidden size={16} strokeWidth={2.5} className="mt-2 shrink-0" />
            : <CircleHelp aria-hidden size={16} className="mt-2 shrink-0 text-danger" />}
          {item}
        </li>
      ))}
    </ul>
  )
}

/**
 * Вкладка «Обзор» окна 2.1а (16744:470): идентификация и применимость — строки характеристик К-4, «Почему подходит»,
 * «Недостающие данные» и вклад критериев в балл.
 */
export function OverviewTab({ view, score }: { readonly view: OverviewView; readonly score: number | null }) {
  return (
    <div className="flex flex-col gap-20">
      <Group id="details-identification" title={groups.identification}><Rows rows={view.identification} /></Group>
      <Group id="details-applicability" title={groups.applicability} note={o.applicabilityNote}><Rows rows={view.applicability} /></Group>
      <Group id="details-fits" title={o.fits}><Points items={view.fits} icon="fit" empty={o.noFits} /></Group>
      <Group id="details-missing" title={o.missing}><Points items={view.missing} icon="missing" empty={o.noMissing} /></Group>
      {score !== null && <Group id="details-criteria" title={o.criteria(formatScore(score))}><Rows rows={view.criteria} /></Group>}
    </div>
  )
}
