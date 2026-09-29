import { Link } from 'react-router'
import { Bridge } from '@/components/ui/MergedButton'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { NavItem } from './navigation'

interface NavLinkItemProps {
  readonly item: NavItem
  readonly count: number | undefined
  readonly active: boolean
}

/** Пункт левого меню: обычный, активный (чёрная капсула) или активный со счётчиком — капсула + круг с перемычкой. */
export function NavLinkItem({ item, count, active }: NavLinkItemProps) {
  const current = active ? 'page' : undefined

  if (item.disabled === true) {
    return (
      <span
        aria-disabled="true"
        title={ru.nav.soonHint}
        className="flex cursor-not-allowed items-center justify-between rounded-md p-12 type-body font-medium text-text-disabled"
      >
        {item.label}
        <span className="type-caption">{ru.nav.soon}</span>
      </span>
    )
  }

  if (!active) {
    return (
      <Link
        to={item.to}
        className="flex items-center justify-between rounded-md p-12 type-body font-medium text-text transition-colors hover:bg-surface-sunken"
      >
        {item.label}
        {count !== undefined && <span className="type-caption font-medium text-text-secondary">{formatNumber(count)}</span>}
      </Link>
    )
  }

  if (count === undefined) {
    return (
      <Link
        to={item.to}
        aria-current={current}
        className="flex items-center rounded-full bg-inverse px-16 py-12 type-body font-semibold text-on-inverse drop-shadow-popover"
      >
        {item.label}
      </Link>
    )
  }

  // 15935:816: капсула 154×44 и круг 44×44, между ними перемычка — прямоугольник минус две окружности r = 12.
  return (
    <Link to={item.to} aria-current={current} className="flex h-44 rounded-full drop-shadow-popover">
      <span className="flex flex-1 items-center rounded-full bg-inverse px-20 type-body font-semibold text-on-inverse">
        {item.label}
      </span>
      <Bridge className="fill-inverse" />
      <span className="flex size-44 shrink-0 items-center justify-center rounded-full bg-inverse type-caption font-medium text-on-inverse">
        {formatNumber(count)}
      </span>
    </Link>
  )
}
