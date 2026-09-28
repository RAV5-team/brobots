import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

/**
 * section — секция карточки: заголовок `heading`, подпись, шеврон справа («Сравнение с текущим процессом», 16325:101);
 * group — группа параметров: заголовок 14/20 600, подпись-счётчик, разделитель снизу («Объём и нагрузка · 5 параметров», 16969:10);
 * chip — триггер-чип, содержимое под ним («4 не прошли фильтры», 16325:101).
 */
export type DisclosureVariant = 'section' | 'group' | 'chip'
export type DisclosureTone = 'neutral' | 'danger'

interface DisclosureProps {
  readonly title: ReactNode
  /** Подпись под заголовком (section / group): «7 параметров · 1 по допущению». У chip не выводится. */
  readonly caption?: ReactNode
  /** Слот справа от шапки вне кнопки — кнопки и чипы, не раскрывающие секцию. У chip не выводится. */
  readonly aside?: ReactNode
  readonly variant?: DisclosureVariant
  /** Тон чипа: danger — красная обводка «4 не прошли фильтры» (16325:101). */
  readonly tone?: DisclosureTone
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean) => void
  /** Шапка секции — заголовок этого уровня, чтобы секция попадала в оглавление скринридера. Нет — просто кнопка. */
  readonly headingLevel?: 2 | 3 | 4
  readonly disabled?: boolean
  readonly className?: string
  readonly children: ReactNode
  readonly 'data-demo-state'?: string
}

const TITLES: Record<Exclude<DisclosureVariant, 'chip'>, string> = {
  section: 'type-heading',
  group: 'type-body font-semibold',
}

const CHIP_TONES: Record<DisclosureTone, string> = {
  neutral: 'bg-surface-sunken text-text not-disabled:hover:bg-surface-muted',
  danger: 'border border-danger-border bg-bg text-danger not-disabled:hover:bg-danger-bg',
}

const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)'

/**
 * Сворачиваемая секция или группа (components.md: Disclosure; шаг 1 — группы, шаг 2 — условия, исключённые, сравнение).
 * Кнопка с `aria-expanded` / `aria-controls`; содержимое остаётся в DOM и скрыто атрибутом `hidden`.
 * Управляемая (`open` + `onOpenChange`) или нет (`defaultOpen`).
 */
export function Disclosure({
  title, caption, aside, variant = 'section', tone = 'neutral', open, defaultOpen = false, onOpenChange, headingLevel,
  disabled = false, className, children, ...demo
}: DisclosureProps) {
  const [inner, setInner] = useState(defaultOpen)
  const isOpen = open ?? inner
  const panelId = useId()
  const toggle = () => {
    const next = !isOpen
    setInner(next)
    onOpenChange?.(next)
  }
  const buttonProps = {
    type: 'button' as const,
    'aria-expanded': isOpen,
    'aria-controls': panelId,
    disabled,
    onClick: toggle,
    'data-demo-state': demo['data-demo-state'],
  }
  const chevron = <ChevronDown aria-hidden size={16} className={clsx('shrink-0 transition-transform', isOpen && 'rotate-180')} />

  if (variant === 'chip') {
    return (
      <div className={clsx('flex flex-col gap-12', className)}>
        <button
          {...buttonProps}
          className={clsx('inline-flex h-24 items-center gap-4 self-start rounded-full px-10 type-caption font-medium whitespace-nowrap transition-colors', CHIP_TONES[tone], DISABLED)}
        >
          {title}
          <ChevronDown aria-hidden size={12} strokeWidth={2.5} className={clsx('shrink-0 transition-transform', isOpen && 'rotate-180')} />
        </button>
        <div id={panelId} hidden={!isOpen}>{children}</div>
      </div>
    )
  }

  const Heading = headingLevel === undefined ? 'div' : (`h${String(headingLevel)}` as 'h2' | 'h3' | 'h4')
  const group = variant === 'group'
  return (
    <div className={clsx('flex flex-col', group ? 'border-b border-border' : 'gap-12', className)}>
      <div className={clsx('flex items-center gap-16', group && 'py-12')}>
        <Heading className="flex min-w-0 flex-1">
          <button
            {...buttonProps}
            className={clsx('flex min-w-0 flex-1 items-center gap-16 rounded-md text-left text-text transition-colors not-disabled:hover:text-text-secondary', DISABLED)}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-4">
              <span className={TITLES[variant]}>{title}</span>
              {caption && <span className="type-caption font-normal text-text-secondary">{caption}</span>}
            </span>
            <span className="flex size-24 shrink-0 items-center justify-center text-text-secondary">{chevron}</span>
          </button>
        </Heading>
        {aside && <div className="flex shrink-0 items-center gap-8">{aside}</div>}
      </div>
      <div id={panelId} hidden={!isOpen} className={clsx(group && 'pb-12')}>{children}</div>
    </div>
  )
}
