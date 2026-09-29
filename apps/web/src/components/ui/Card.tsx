import { clsx } from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

export type CardVariant = 'panel' | 'tile' | 'accent' | 'sunken' | 'inset' | 'well' | 'inverse'

interface CardProps extends HTMLAttributes<HTMLElement> {
  /**
   * panel — крупная карточка и панели (радиус 28, raised-lg, 15935:1255); tile — KPI (радиус 16, raised-md, 15935:122);
   * accent — лаймовая вдавленная панель (радиус 28, accent-inset; 15935:37, 15935:78);
   * sunken — утопленная плашка без тени (радиус 24, surface-sunken; «Уточнения и проверки» 06, 15935:138);
   * inset — вдавленная плитка показателя (радиус 12, surface-muted, inset-md; «24 · ТТХ подтверждены» 11, 15935:1469);
   * well — вдавленная панель внутри карточки (радиус 16, surface-muted, inset-md; «231 млн ₽ / год» 12, 15950:1686);
   * inverse — тёмная карточка (радиус 28, inverse, тень popover; «карточка · вердикт» 07, 16197:1870): кольцо фокуса внутри — лаймовое.
   */
  readonly variant?: CardVariant
  /** Внутренний отступ; по умолчанию 20. Карточки экрана входа — 28, лаймовые панели — 16 и 8, карточки каталога К-1 — 12, шапка страницы решения К-4 — 24. */
  readonly padding?: 8 | 12 | 16 | 20 | 24 | 28
  /** Промежуток между детьми; по умолчанию 12 у panel, 8 у остальных. Справочник А8 — 16. */
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
  inverse: 'surface-inverse rounded-2xl bg-inverse text-bg shadow-popover',
}

const ELEVATIONS: Record<CardElevation, string> = { md: 'shadow-raised-md', lg: 'shadow-raised-lg' }
const DEFAULT_ELEVATION: Record<CardVariant, CardElevation | null> = { panel: 'lg', tile: 'md', accent: null, sunken: null, inset: null, well: null, inverse: null }

// Классы целиком: Tailwind находит утилиты только по полным строкам.
const PADDINGS = { 8: 'p-8', 12: 'p-12', 16: 'p-16', 20: 'p-20', 24: 'p-24', 28: 'p-28' } as const
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

interface CardTitleProps {
  readonly children: ReactNode
  /** Уровень по месту в документе: h2 — первый заголовок карточки под h1 страницы, h3 — внутри секции. */
  readonly as?: 'h2' | 'h3'
  /** id — для aria-labelledby карточки. */
  readonly id?: string
}

/** Заголовок карточки: капсом, приглушённый («ПРОВЕРКА ШАБЛОНА»). */
export function CardTitle({ children, as: Heading = 'h3', id }: CardTitleProps) {
  return <Heading id={id} className="type-overline text-text-muted">{children}</Heading>
}

interface CardStatProps {
  readonly label: ReactNode
  readonly value: ReactNode
  /** Пояснение под подписью: «+ 6 зарядных станций, 4 точки Wi-Fi», «в рамках бюджета 80 млн ₽» (rail шага 2, 16325:101). */
  readonly caption?: ReactNode
}

/** Строка «подпись — значение» внутри <dl>; с `caption` — пояснение второй строкой под подписью. */
export function CardStat({ label, value, caption }: CardStatProps) {
  return (
    <div className="flex items-start gap-8 py-8">
      {caption === undefined
        ? <dt className="flex-1 type-body text-text-secondary">{label}</dt>
        : (
            <dt className="flex flex-1 flex-col gap-4 type-body text-text-secondary">
              {label}
              <span className="type-caption">{caption}</span>
            </dt>
          )}
      <dd className="type-body font-semibold whitespace-nowrap text-text">{value}</dd>
    </div>
  )
}

interface KpiCardProps {
  readonly label: string
  readonly value: ReactNode
  readonly caption?: ReactNode
  /** Слот «было»: «было 64,2 ₽» (выбранный вариант подбора, 03). */
  readonly previous?: ReactNode
  /** Слот изменения: «−20 %». */
  readonly change?: ReactNode
}

/** Показатель: подпись, крупное значение, «было → изменение», пояснение (экран 06, 15935:122; 03 — выбранный вариант). */
export function KpiCard({ label, value, caption, previous, change }: KpiCardProps) {
  return (
    <Card as="article" variant="tile">
      <h3 className="type-overline text-text-muted">{label}</h3>
      <p className="type-display-lg text-text">{value}</p>
      {(previous !== undefined || change !== undefined) && (
        <p className="flex flex-wrap items-baseline gap-x-8 type-caption text-text-secondary">
          {previous}
          {change !== undefined && <span className="font-semibold text-text">{change}</span>}
        </p>
      )}
      {caption && <p className="type-caption text-text-secondary">{caption}</p>}
    </Card>
  )
}
