import { clsx } from 'clsx'
import { Link, NavLink } from 'react-router'

export interface TabNavItem {
  readonly to: string
  readonly label: string
  /** Активна только на точном адресе — для вкладки, чей адрес — префикс остальных. */
  readonly end?: boolean
}

interface TabNavProps {
  /** Доступное имя навигации: «Разделы локации». */
  readonly label: string
  readonly items: readonly TabNavItem[]
  /** Активная вкладка задаётся явно, если на одном экране живут несколько адресов (15 и 17). */
  readonly activeTo?: string
  /** Для витрины: состояние первой неактивной вкладки. */
  readonly 'data-demo-state'?: string | undefined
}

/**
 * Вкладки-разделы страницы, каждая — свой адрес (components.md: TabNav; 15950:2501).
 * Выпуклая капсула r28, пункты 14/20; активный — тёмная пилюля 36 px с лаймовой подписью, `aria-current="page"`.
 */
const tabClass = (active: boolean) =>
  clsx(
    'flex h-36 items-center rounded-full px-16 type-body font-medium whitespace-nowrap transition-colors',
    active
      ? 'bg-inverse text-on-inverse drop-shadow-popover hover:bg-inverse-hover'
      : 'text-text hover:bg-surface-muted active:bg-surface-sunken',
  )

export function TabNav({ label, items, activeTo, ...demo }: TabNavProps) {
  const demoTarget = items.find((item) => item.to !== activeTo)?.to
  return (
    <nav aria-label={label} className="self-start rounded-2xl border border-highlight bg-bg p-4 shadow-raised-md">
      <ul className="flex gap-4">
        {items.map((item) => {
          const demoState = item.to === demoTarget ? demo['data-demo-state'] : undefined
          // NavLink ставит aria-current только по совпадению адреса, поэтому явная вкладка — обычной ссылкой.
          if (activeTo !== undefined) {
            const active = item.to === activeTo
            return (
              <li key={item.to}>
                <Link to={item.to} data-demo-state={demoState} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                  {item.label}
                </Link>
              </li>
            )
          }
          return (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end ?? false} data-demo-state={demoState} className={({ isActive }) => tabClass(isActive)}>
                {item.label}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
