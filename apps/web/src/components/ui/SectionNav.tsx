import { clsx } from 'clsx'

export interface SectionNavItem {
  /** id секции на странице — цель якоря. */
  readonly id: string
  readonly label: string
}

interface SectionNavProps {
  /** Доступное имя навигации: «Разделы формы». */
  readonly label: string
  readonly items: readonly SectionNavItem[]
  readonly activeId: string
  /** Переход к секции; без обработчика работает обычный якорь. */
  readonly onSelect?: (id: string) => void
}

/**
 * Навигация по секциям длинной формы: капсула с пунктами одной ширины и точкой слева
 * (components.md: SectionNav; 15935:914). Активный пункт — тёмный, подпись лаймом; `aria-current="location"`.
 */
export function SectionNav({ label, items, activeId, onSelect }: SectionNavProps) {
  return (
    <nav aria-label={label} className="rounded-full bg-surface-sunken p-4">
      <ul className="flex gap-4">
        {items.map((item) => {
          const isActive = item.id === activeId
          return (
            <li key={item.id} className="flex flex-1">
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                onClick={(event) => {
                  if (!onSelect) return
                  event.preventDefault()
                  onSelect(item.id)
                }}
                className={clsx(
                  'flex h-32 flex-1 items-center justify-center gap-8 rounded-full px-12 type-caption whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-inverse font-semibold text-on-inverse hover:bg-inverse-hover'
                    : 'font-medium text-text-secondary hover:bg-surface-muted',
                )}
              >
                <span aria-hidden className={clsx('size-8 shrink-0 rounded-full', isActive ? 'bg-accent' : 'bg-text-muted')} />
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
