import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Progress } from './Progress'

/**
 * sunken — утопленная плашка на фоне страницы (А1а «status · опрос источников», 16044:376);
 * inverse — тёмная карточка с журналом строками («карточка · прогон» 06, 16197:1750; D-103).
 */
export type ProgressPanelVariant = 'sunken' | 'inverse'

/** Строка журнала: done — выполнено (✓), current — идёт сейчас (•), queued — ещё в очереди (·). */
export interface ProgressLogLine {
  readonly text: string
  readonly state: 'done' | 'current' | 'queued'
}

interface ProgressPanelProps {
  /** «Опрашиваем источники · 2 из 3». */
  readonly title: string
  /** Имя полосы для чтения с экрана: «Опрос источников». */
  readonly label: string
  /** 0…100. */
  readonly value: number
  readonly variant?: ProgressPanelVariant
  /** Справа от заголовка, лаймом: «12 с» (только inverse). */
  readonly meta?: ReactNode
  /** Журнал шагов под полосой. На светлой плашке — текстовые блоки (3.3); на тёмной — строки на inverse-well. */
  readonly log?: readonly ProgressLogLine[]
  /** Имя журнала для чтения с экрана. */
  readonly logLabel?: string
  /** Операция идёт: `aria-busy` на плашке. */
  readonly busy?: boolean
  /** Уровень заголовка: 3 — внутри раздела страницы (А1а), 2 — плашка сама раздел (06). */
  readonly headingLevel?: 2 | 3
  /** Статус по частям операции: «ФЦ БАС — получено 12 позиций · …». */
  readonly children?: ReactNode
}

const MARK = { done: '✓', current: '•', queued: '·' } as const

/** Журнал на светлой плашке (3.3, 17385:2606): галочка — сделано, точка — сейчас, «·» — в очереди. */
function StepList({ lines, label }: { readonly lines: readonly ProgressLogLine[]; readonly label?: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-8 type-body">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-12">
          <span aria-hidden className={clsx('w-14 shrink-0 text-center font-semibold', line.state === 'queued' ? 'text-text-muted' : 'text-text')}>
            {MARK[line.state]}
          </span>
          <span className={clsx('min-w-0 flex-1', line.state === 'queued' ? 'text-text-secondary' : 'text-text', line.state === 'current' && 'font-medium')}>
            {line.text}
          </span>
        </li>
      ))}
    </ol>
  )
}

function LogList({ lines, label }: { readonly lines: readonly ProgressLogLine[]; readonly label?: string }) {
  return (
    <ol aria-label={label} aria-live="polite" className="flex flex-col gap-10 bg-inverse-well type-body text-bg">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-12">
          <span aria-hidden className="flex h-20 w-16 shrink-0 items-center justify-center">
            {line.state === 'done'
              ? <Check size={16} strokeWidth={2.5} className="text-accent" />
              : <span className="size-4 rounded-full bg-text-disabled" />}
          </span>
          <span className="min-w-0 flex-1">{line.text}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Статус долгой операции: заголовок, полоса и строка статуса или журнал (components.md: ProgressPanel).
 * Изменения зачитываются вежливо (ТЗ 4.3.3).
 */
export function ProgressPanel({ title, label, value, variant = 'sunken', meta, log, logLabel, busy, headingLevel = 3, children }: ProgressPanelProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const titleId = useId()
  if (variant === 'inverse') {
    return (
      <section aria-labelledby={titleId} aria-busy={busy} className="surface-inverse flex flex-col gap-16 rounded-2xl bg-inverse p-24 shadow-popover">
        <div className="flex items-center justify-between gap-16">
          <Heading id={titleId} className="type-title-md font-medium text-bg">{title}</Heading>
          {meta && <p className="type-title-md font-medium text-on-inverse tabular-nums">{meta}</p>}
        </div>
        <Progress label={label} value={value} track="inverse" />
        {log && log.length > 0 && <LogList lines={log} {...(logLabel !== undefined ? { label: logLabel } : {})} />}
        {children && <p className="type-body text-text-disabled">{children}</p>}
      </section>
    )
  }
  return (
    <section aria-labelledby={titleId} aria-live="polite" aria-busy={busy} className="flex flex-col gap-10 rounded-lg bg-surface-sunken px-20 py-16">
      <div className="flex items-center justify-between gap-16">
        <Heading id={titleId} className="type-heading font-medium text-text">{title}</Heading>
        {meta && <p className="type-body text-text-secondary tabular-nums">{meta}</p>}
      </div>
      <Progress label={label} value={value} track="strong" />
      {log && log.length > 0 && <StepList lines={log} {...(logLabel !== undefined ? { label: logLabel } : {})} />}
      {children && <p className="type-body text-text-secondary">{children}</p>}
    </section>
  )
}
