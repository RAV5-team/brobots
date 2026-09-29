import type { ReactNode } from 'react'
import { CardStat } from '@/components/ui/Card'
import { CharacteristicRow } from '@/components/ui/CharacteristicRow'
import type { StackedRow } from './detailsTabsModel'
import type { AmountRow, DetailRow } from './economicsTabModel'

/** Группа вкладки окна 2.1а: заголовок капсом, необязательное пояснение (16744:473, 16832:1343). */
export function DetailsGroup({ id, title, note, children }: { readonly id: string; readonly title: string; readonly note?: string | null; readonly children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <div className="flex flex-col gap-4 pb-4">
        <h3 id={id} className="type-overline text-text-muted">{title}</h3>
        {note && <p className="type-caption text-text-muted">{note}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * Строки «подпись — значение» — строки характеристик К-4 (`CharacteristicRow`): без пояснения — `plain`,
 * с пояснением под значением — `stacked` без плашки. У последней строки нет разделителя.
 */
export function DetailRows({ rows }: { readonly rows: readonly DetailRow[] }) {
  return (
    <dl className="flex flex-col [&>div:last-child]:border-b-0">
      {rows.map((r) => (r.caption
        ? <CharacteristicRow key={r.key} variant="stacked" label={r.label} value={r.value} source={r.caption} />
        : <CharacteristicRow key={r.key} variant="plain" label={r.label} value={r.value} />))}
    </dl>
  )
}

/** Статьи сумм «подпись — сумма справа» (`CardStat`), разделители между строками (16832:1343). */
export function AmountRows({ rows }: { readonly rows: readonly AmountRow[] }) {
  return (
    <dl className="flex flex-col divide-y divide-border">
      {rows.map((r) => <CardStat key={r.key} label={r.total ? <span className="font-semibold text-text">{r.label}</span> : r.label} value={r.value} />)}
    </dl>
  )
}

/** Строки характеристик со статусом (К-4 `CharacteristicRow stacked`): значение, источник и дата под ним, плашка справа. */
export function StackedRows({ rows }: { readonly rows: readonly StackedRow[] }) {
  return (
    <dl className="flex flex-col [&>div:last-child]:border-b-0">
      {rows.map((r) => (
        <CharacteristicRow key={r.key} variant="stacked" label={r.label} value={r.value} source={r.source} date={r.date} verification={r.verification} />
      ))}
    </dl>
  )
}
