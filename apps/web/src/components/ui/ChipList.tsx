import { clsx } from 'clsx'
import { Link } from 'react-router'
import { ru } from '@/shared/i18n/ru'
import { Chip } from './Chip'

export interface ChipListItem {
  readonly key: string
  readonly label: string
  /** Значение не подтверждено — плашка серым текстом (D-64). */
  readonly unconfirmed?: boolean
  /** Плашка-ссылка на позицию; нет — текст без ссылки (D-65). */
  readonly to?: string
}

interface ChipListProps {
  readonly items: readonly ChipListItem[]
  /** Сколько плашек показать; остальные — одной плашкой «ещё N» (D-65). Нет — показать все. */
  readonly max?: number
  readonly label?: string
}

const LINK_CLASSES =
  'inline-flex h-24 shrink-0 items-center rounded-full bg-surface-sunken px-10 type-caption font-medium whitespace-nowrap transition-colors hover:bg-surface-muted'

/**
 * Ряд плашек карточки каталога с переносом строк (components.md: ChipList, MoreChip; К-1, 16642:682).
 * «ещё N» — отдельная плашка, скрытые значения — в её подписи для чтения с экрана.
 */
export function ChipList({ items, max, label }: ChipListProps) {
  const visible = max === undefined ? items : items.slice(0, max)
  const hidden = items.slice(visible.length)
  return (
    <ul aria-label={label} className="flex flex-wrap gap-x-8 gap-y-6">
      {visible.map((item) => (
        <li key={item.key} className="flex">
          {item.to
            ? <Link to={item.to} className={clsx(LINK_CLASSES, item.unconfirmed ? 'text-text-muted' : 'text-text')}>{item.label}</Link>
            : <Chip tone={item.unconfirmed ? 'unconfirmed' : 'neutral'}>{item.label}</Chip>}
        </li>
      ))}
      {hidden.length > 0 && (
        <li className="flex" aria-label={ru.ui.chipList.moreLabel(hidden.map((i) => i.label))} title={hidden.map((i) => i.label).join(', ')}>
          <span aria-hidden="true"><Chip tone="muted">{ru.ui.chipList.more(hidden.length)}</Chip></span>
        </li>
      )}
    </ul>
  )
}
