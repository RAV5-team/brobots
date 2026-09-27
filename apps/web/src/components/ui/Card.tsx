import { clsx } from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

export type CardVariant = 'panel' | 'tile' | 'accent' | 'sunken' | 'inset' | 'well'

interface CardProps extends HTMLAttributes<HTMLElement> {
  /**
   * panel — крупная карточка и панели (радиус 28, raised-lg, 15935:1255); tile — KPI (радиус 16, raised-md, 15935:122);
   * accent — лаймовая вдавленная панель (радиус 28, accent-inset; 15935:37, 15935:78);
   * sunken — утопленная плашка без тени (радиус 24, surface-sunken; «Уточнения и проверки» 06, 15935:138);
   * inset — вдавленная плитка показателя (радиус 12, surface-muted, inset-md; «24 · ТТХ подтверждены» 11, 15935:1469);
   * well — вдавленная панель внутри карточки (радиус 16, surface-muted, inset-md; «231 млн ₽ / год» 12, 15950:1686).
   */
  readonly variant?: CardVariant
  /** Внутренний отступ; по умолчанию 20. Карточки экрана входа — 28, лаймовые панели — 16 и 8. */
  readonly padding?: 8 | 16 | 20 | 28
  /** Промежуток между детьми; по умолчанию 12 у panel, 8 у остальных. */
  readonly gap?: 0 | 4 | 8 | 12 | 16 | 20 | 28
  readonly as?: 'section' | 'article' | 'div' | 'ul'
  /** Высота выпуклости panel и tile; по умолчанию lg у panel и md у tile. Панели дашборда 06 — md (15935:147). */
  readonly elevation?: CardElevation
}

export type CardElevation = 'md' | 'lg'

const VARIANTS: Record<CardVariant, string> = {
  panel: 'rounded-2xl border border-highlight bg-bg',
  tile: 'rounded-lg border border-highlight bg-bg',
  accent: 'rounded-2xl bg-accent-surface shadow-accent-inset',
  sunken: 'rounded-xl bg-surface-sunken',
  inset: 'rounded-md bg-surface-muted shadow-inset-md',
  well: 'rounded-lg bg-surface-muted shadow-inset-md',
}

const ELEVATIONS: Record<CardElevation, string> = { md: 'shadow-raised-md', lg: 'shadow-raised-lg' }
const DEFAULT_ELEVATION: Record<CardVariant, CardElevation | null> = { panel: 'lg', tile: 'md', accent: null, sunken: null, inset: null, well: null }

// Классы целиком: Tailwind находит утилиты только по полным строкам.
const PADDINGS = { 8: 'p-8', 16: 'p-16', 20: 'p-20', 28: 'p-28' } as const
const GAPS = { 0: 'gap-0', 4: 'gap-4', 8: 'gap-8', 12: 'gap-12', 16: 'gap-16', 20: 'gap-20', 28: 'gap-28' } as const

/** Выпуклая карточка того же цвета, что фон, или лаймовая панель (components.md: Card). */
export function Card({ variant = 'panel', padding = 20, gap, as: Tag = 'section', elevation, className, ...rest }: CardProps) {
  const resolvedGap = gap ?? (variant === 'panel' ? 12 : 8)
  // Лаймовая, утопленная и вдавленная панели не выпуклые — elevation к ним не применяется.
  const resolvedElevation = DEFAULT_ELEVATION[variant] === null ? null : (elevation ?? DEFAULT_ELEVATION[variant])
  return (
    <Tag
      className={clsx(
        'flex flex-col',
        VARIANTS[variant],
        resolvedElevation && ELEVATIONS[resolvedElevation],
        PADDINGS[padding],
        GAPS[resolvedGap],
        className,
      )}
      {...rest}
    />
  )
}

/** Заголовок карточки: капсом, приглушённый («ПРОВЕРКА ШАБЛОНА»). */
export function CardTitle({ children }: { readonly children: ReactNode }) {
  return <h3 className="type-overline text-text-muted">{children}</h3>
}

/** Строка «подпись — значение» внутри <dl>. */
export function CardStat({ label, value }: { readonly label: ReactNode; readonly value: ReactNode }) {
  return (
    <div className="flex items-start gap-8 py-8">
      <dt className="flex-1 type-body text-text-secondary">{label}</dt>
      <dd className="type-body font-semibold whitespace-nowrap text-text">{value}</dd>
    </div>
  )
}

interface KpiCardProps {
  readonly label: string
  readonly value: ReactNode
  readonly caption?: ReactNode
}

/** Показатель дашборда: подпись, крупное значение, пояснение (экран 06, 15935:122). */
export function KpiCard({ label, value, caption }: KpiCardProps) {
  return (
    <Card as="article" variant="tile">
      <h3 className="type-overline text-text-muted">{label}</h3>
      <p className="type-display-lg text-text">{value}</p>
      {caption && <p className="type-caption text-text-secondary">{caption}</p>}
    </Card>
  )
}
