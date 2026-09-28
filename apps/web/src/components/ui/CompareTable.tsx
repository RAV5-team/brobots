import { clsx } from 'clsx'
import { Check, CircleHelp, X } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Тон ячейки сравнения (К-3, PRD 7.6): default — значение; unconfirmed — нет данных или не подтверждено, серым текстом
 * (16642:2618); panel — вдавленная плашка со списком (16642:2662); fit / misfit / unknown — ✓ ✕ ? блока «Соответствие»
 * (D-59: красный фон только у ✕).
 */
export type CompareCellTone = 'default' | 'unconfirmed' | 'panel' | 'fit' | 'misfit' | 'unknown'

export interface CompareCell {
  readonly key: string
  readonly tone?: CompareCellTone
  readonly content: ReactNode
}

export interface CompareRow {
  readonly key: string
  readonly label: string
  readonly cells: readonly CompareCell[]
}

export interface CompareGroup {
  readonly key: string
  readonly title: string
  readonly rows: readonly CompareRow[]
}

export interface CompareColumn {
  readonly key: string
  /** Шапка колонки — карточка позиции (16642:2503); подпись колонки для чтения с экрана. */
  readonly label: string
  readonly header: ReactNode
}

interface CompareTableProps {
  readonly caption: string
  readonly columns: readonly CompareColumn[]
  readonly groups: readonly CompareGroup[]
  /** Ширина колонки подписей: 300 (К-3) или 180 в основной колонке шага (03, D-96). */
  readonly labelWidth?: 'default' | 'compact'
}

const LABEL_WIDTHS = { default: 'w-(--rav-compare-label-width)', compact: 'w-(--rav-compare-label-width-compact)' } as const

const TONES: Record<CompareCellTone, string> = {
  default: 'text-text',
  unconfirmed: 'text-text-secondary',
  panel: 'bg-surface-sunken text-text',
  fit: 'text-on-accent',
  misfit: 'bg-danger-bg text-danger',
  unknown: 'text-text-secondary',
}

const FIT_ICONS = { fit: Check, misfit: X, unknown: CircleHelp } as const

function CellContent({ tone, content }: { readonly tone: CompareCellTone; readonly content: ReactNode }) {
  if (tone !== 'fit' && tone !== 'misfit' && tone !== 'unknown') return content
  const Icon = FIT_ICONS[tone]
  return (
    // Блок, а не inline-flex: иначе строка с иконкой выше обычной на 4 px (16642:2710 — 44 px).
    <span className="flex items-start gap-6">
      <Icon aria-hidden size={16} className="mt-2 shrink-0" />
      <span>{content}</span>
    </span>
  )
}

/**
 * Таблица сравнения с группами строк (components.md: CompareTable, FitCell; К-3, 16642:2500).
 * Колонка подписей — `--rav-compare-label-width`, колонки позиций делят остаток поровну; зазоры 12 × 4 — border-spacing.
 */
export function CompareTable({ caption, columns, groups, labelWidth = 'default' }: CompareTableProps) {
  return (
    <div className="-mx-12 -my-4">
      <table className="w-full table-fixed border-separate border-spacing-x-12 border-spacing-y-4">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className={LABEL_WIDTHS[labelWidth]} />
          {columns.map((c) => <col key={c.key} />)}
        </colgroup>
        <thead>
          <tr>
            <td />
            {columns.map((c) => (
              <th key={c.key} scope="col" aria-label={c.label} className="p-0 text-left align-top font-normal">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key}>
            <tr>
              <th scope="colgroup" colSpan={columns.length + 1} className="pt-16 pb-4 text-left type-overline text-text-muted">
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="py-12 text-left align-top type-body font-normal text-text-secondary">{row.label}</th>
                {row.cells.map((cell) => {
                  const tone = cell.tone ?? 'default'
                  return (
                    <td key={cell.key} className={clsx('rounded-md p-12 align-top type-body font-medium', TONES[tone])}>
                      <CellContent tone={tone} content={cell.content} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
