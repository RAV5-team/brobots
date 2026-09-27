import { clsx } from 'clsx'
import { Link } from 'react-router'

export interface TabNavItem<K extends string> {
  readonly key: K
  readonly label: string
  readonly to: string
}

interface TabNavProps<K extends string> {
  /** Доступное имя навигации: у вкладок нет видимой подписи. */
  readonly label: string
  readonly items: readonly TabNavItem<K>[]
  readonly activeKey: K
  /** Для витрины: состояние первой неактивной вкладки. */
  readonly 'data-demo-state'?: string | undefined
}

/**
 * Вкладки-ссылки раздела (components.md: TabNav; «Администрирование», 15966:8024).
 * Выпуклая капсула r28 с пунктами h36; активный — тёмная капсула с лаймовой подписью и тенью.
 * Это навигация между страницами, а не переключатель значения — для выбора значения есть Segmented.
 */
export function TabNav<K extends string>({ label, items, activeKey, ...demo }: TabNavProps<K>) {
  const demoTarget = items.find((item) => item.key !== activeKey)?.key
  return (
    <nav aria-label={label} className="self-start">
      <ul className="flex flex-wrap gap-4 rounded-2xl border border-highlight bg-bg p-4 shadow-raised-md">
        {items.map((item) => {
          const active = item.key === activeKey
          return (
            <li key={item.key}>
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                data-demo-state={item.key === demoTarget ? demo['data-demo-state'] : undefined}
                className={clsx(
                  'flex h-36 items-center rounded-full px-16 type-body font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-inverse text-on-inverse drop-shadow-popover hover:bg-inverse-hover'
                    : 'text-text hover:bg-surface-sunken active:bg-surface-muted',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
