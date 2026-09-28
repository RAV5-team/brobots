import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export type StatTileTone = 'light' | 'inverse'
export type StatTileSize = 'lg' | 'md' | 'sm'

/**
 * light — утопленная плитка на светлой карточке (surface-sunken), размеры:
 * lg — значение title-md, радиус 16 (рекомендация подбора 03, «Проверяем · из подбора» 04, итог 08);
 * md — значение heading, радиус 12, отступ 12 (факты процесса 11, 15935:1393);
 * sm — значение body 600, радиус 12 (условия подбора 03).
 * inverse — вложенная плашка тёмной карточки (inverse-well: рекомендация итога 08), только lg.
 */
type StatTileVariant =
  | { readonly tone?: 'light'; readonly size?: StatTileSize }
  | { readonly tone: 'inverse'; readonly size?: 'lg' }

type StatTileProps = StatTileVariant & {
  readonly label: ReactNode
  readonly value: ReactNode
  /** Пояснение под значением: «от бюджета», «−0,7 млн к подбору». */
  readonly caption?: ReactNode
  /** li — плитка в списке ul; term — пара dt и dd внутри списка определений dl. */
  readonly as?: 'li' | 'term'
  /** Раскладка в ряду: `flex-1`, `shrink-0`. */
  readonly className?: string
}

interface ToneSize {
  readonly box: string
  readonly label: string
  readonly value: string
  readonly caption: string
}

// Классы целиком: Tailwind находит утилиты только по полным строкам.
const LIGHT: Record<StatTileSize, ToneSize> = {
  lg: { box: 'rounded-lg bg-surface-sunken p-16', label: 'type-caption text-text-secondary', value: 'type-title-md text-text', caption: 'type-caption font-medium text-text-secondary' },
  md: { box: 'rounded-md bg-surface-sunken p-12', label: 'type-caption text-text-secondary', value: 'type-heading text-text', caption: 'type-caption text-text-secondary' },
  sm: { box: 'rounded-md bg-surface-sunken px-16 py-12', label: 'type-caption text-text-secondary', value: 'type-body font-semibold text-text', caption: 'type-caption text-text-secondary' },
}
const INVERSE: ToneSize = { box: 'rounded-lg bg-inverse-well px-16 py-14', label: 'type-caption text-text-disabled', value: 'type-title-md text-bg', caption: 'type-caption text-text-disabled' }

/** Плитка показателя: подпись, значение, необязательное пояснение (components.md: StatTile). */
export function StatTile({ label, value, caption, tone, size = 'lg', as = 'li', className }: StatTileProps) {
  const style = tone === 'inverse' ? INVERSE : LIGHT[size]
  const box = clsx('flex flex-col gap-4', style.box, className)
  if (as === 'term') {
    return (
      <div className={box}>
        <dt className={style.label}>{label}</dt>
        <dd className={style.value}>{value}</dd>
        {caption !== undefined && <dd className={style.caption}>{caption}</dd>}
      </div>
    )
  }
  return (
    <li className={box}>
      <span className={style.label}>{label}</span>
      <span className={style.value}>{value}</span>
      {caption !== undefined && <span className={style.caption}>{caption}</span>}
    </li>
  )
}
