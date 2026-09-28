import { clsx } from 'clsx'
import { CircleHelp } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'

/** default — светлая пилюля строки рейтинга; selected — тёмная с лаймом у выбранной строки (16325:101). */
export type ScorePillTone = 'default' | 'selected'

interface ScorePillProps extends Omit<ComponentPropsWithRef<'button'>, 'children' | 'type'> {
  /** Балл, уже отформатированный: «0,91». null — строка вне рейтинга: «—» без кнопки; такую пилюлю не делать триггером `Popover`. */
  readonly score: string | null
  /** Что откроет кнопка, для чтения с экрана: «Из чего складывается балл AMR 800». */
  readonly label: string
  readonly tone?: ScorePillTone
  /** Разбор раскрыт: `aria-expanded`. Внутри `Popover` не нужен — его ставит Radix. */
  readonly expanded?: boolean
  /** id раскрываемого разбора: `aria-controls`. */
  readonly controls?: string
}

const TONES: Record<ScorePillTone, string> = {
  default: 'bg-surface-sunken text-text not-disabled:hover:bg-surface-muted',
  selected: 'bg-inverse text-on-inverse not-disabled:hover:bg-inverse-hover',
}

/**
 * Пилюля балла со знаком «?» (components.md: ScorePill; рейтинг 2.1, 16325:101): кнопка-переключатель разбора 24 px.
 * Подходит как `Popover` trigger — ref и пропсы уходят кнопке. Видимое имя — балл, пояснение — только для скринридера.
 */
export function ScorePill({ score, label, tone = 'default', expanded, controls, className, ...rest }: ScorePillProps) {
  if (score === null) {
    return <span className="inline-flex h-24 items-center px-10 type-caption font-semibold text-text-muted">—</span>
  }
  return (
    <button
      type="button"
      {...(expanded !== undefined ? { 'aria-expanded': expanded } : {})}
      {...(controls !== undefined ? { 'aria-controls': controls } : {})}
      {...rest}
      className={clsx(
        'inline-flex h-24 shrink-0 items-center gap-4 rounded-full pr-6 pl-10 type-caption font-semibold whitespace-nowrap transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)',
        TONES[tone],
        className,
      )}
    >
      {score}
      <span className="sr-only">{`, ${label}`}</span>
      <CircleHelp aria-hidden size={14} className="shrink-0" />
    </button>
  )
}
