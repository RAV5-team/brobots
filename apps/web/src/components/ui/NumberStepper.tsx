import { clsx } from 'clsx'
import { Minus, Plus } from 'lucide-react'
import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { ru } from '@/shared/i18n/ru'
import { IconButton } from './IconButton'

interface NumberStepperProps {
  /** Подпись строки: «Роботов», «Зарядных станций» — и доступное имя значения. */
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step?: number
  readonly onChange: (value: number) => void
  /** Пояснение под подписью: «AMR 800 · RaaS», «1 станция на 4 робота». */
  readonly description?: ReactNode
  /** Слот «было»: «было 18 · из подбора» (план вердикта 07). */
  readonly previous?: ReactNode
  /** Слот дельты слева от «−»: «−2». */
  readonly delta?: ReactNode
  readonly disabled?: boolean
  /**
   * row — строка: подпись слева, степпер справа (04, 07); block — правая колонка вердикта (16325:176): подпись и пояснение
   * сверху, справа чип `badge`, ниже широкий степпер во всю ширину. Дельта в block не показывается у кнопок — её роль у чипа.
   */
  readonly layout?: 'row' | 'block'
  /** Только для block: чип справа от подписи — «+1», «без изменений». Входит в описание значения. */
  readonly badge?: ReactNode
  /** Для витрины: состояние значения. */
  readonly 'data-demo-state'?: string | undefined
}

const t = ru.ui.numberStepper

/**
 * Строка числа с кнопками «−» и «+» (components.md: NumberStepper; 16197:1213 — «Состав для проверки», 07 — план вердикта).
 * Значение — `role="spinbutton"`: ↑ → и ↓ ← меняют на шаг, Home и End — к границам. Кнопки — только для мыши,
 * из порядка Tab убраны (шаблон APG), на границе недоступны.
 */
export function NumberStepper({ label, value, min, max, step = 1, onChange, description, previous, delta, disabled = false, layout = 'row', badge, ...demo }: NumberStepperProps) {
  const labelId = useId()
  const descriptionId = useId()
  const badgeId = useId()
  const isBlock = layout === 'block'
  const hasDescription = description !== undefined || previous !== undefined || delta !== undefined
  const hasBadge = isBlock && badge !== undefined
  const describedBy = [hasDescription && descriptionId, hasBadge && badgeId].filter(Boolean).join(' ') || undefined

  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next))
    if (!disabled && clamped !== value) onChange(clamped)
  }
  const keys: Record<string, () => void> = {
    ArrowUp: () => { set(value + step) },
    ArrowRight: () => { set(value + step) },
    ArrowDown: () => { set(value - step) },
    ArrowLeft: () => { set(value - step) },
    Home: () => { set(min) },
    End: () => { set(max) },
  }
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const action = keys[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }

  const caption = hasDescription && (
    <span id={descriptionId} className={clsx('type-caption text-text-secondary', isBlock && 'flex flex-col')}>
      {/* block — «из подбора: 5» и «рекомендация: 6» строками; пробел между ними — для описания значения. */}
      {isBlock && description !== undefined ? <span>{description}</span> : description}
      {description !== undefined && previous !== undefined && (isBlock ? ' ' : ' · ')}
      {isBlock && previous !== undefined ? <span>{previous}</span> : previous}
      {/* Дельта видна у кнопок; для чтения с экрана — в описании. */}
      {delta !== undefined && <>{' '}<span className="sr-only">{delta}</span></>}
    </span>
  )
  const decrease = <IconButton label={t.decrease(label)} icon={Minus} size={36} tabIndex={-1} disabled={disabled || value <= min} onClick={() => { set(value - step) }} />
  const increase = <IconButton label={t.increase(label)} icon={Plus} size={36} tabIndex={-1} disabled={disabled || value >= max} onClick={() => { set(value + step) }} />
  const spin = (className: string) => (
    <span
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled || undefined}
      data-demo-state={demo['data-demo-state']}
      onKeyDown={onKeyDown}
      className={clsx(className, disabled && 'opacity-(--rav-disabled-opacity)')}
    >
      {value}
    </span>
  )

  if (isBlock) {
    return (
      <div className="flex flex-col gap-10">
        <div className="flex items-start justify-between gap-12">
          <div className="flex min-w-0 flex-col gap-2">
            <span id={labelId} className="type-body font-semibold text-text">{label}</span>
            {caption}
          </div>
          {hasBadge && <span id={badgeId} className="shrink-0">{badge}</span>}
        </div>
        <div className="flex h-44 items-center gap-8 rounded-full bg-surface-muted p-4 shadow-inset-sm">
          {decrease}
          {spin('flex h-36 min-w-0 flex-1 items-center justify-center rounded-full type-title-sm text-text tabular-nums')}
          {increase}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-16">
      <div className="flex min-w-0 flex-col gap-2">
        <span id={labelId} className="type-body font-medium text-text">{label}</span>
        {caption}
      </div>
      <div className="flex shrink-0 items-center gap-10">
        {delta !== undefined && <span aria-hidden className="type-body text-text-secondary">{delta}</span>}
        {decrease}
        {spin('flex h-36 min-w-48 items-center justify-center rounded-full bg-surface-muted px-16 type-title-sm text-text shadow-inset-sm tabular-nums')}
        {increase}
      </div>
    </div>
  )
}
