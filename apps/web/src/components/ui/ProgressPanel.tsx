import { Check } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Progress } from './Progress'

/**
 * sunken — утопленная плашка на фоне страницы (А1а «status · опрос источников», 16044:376);
 * inverse — тёмная карточка с журналом строками («карточка · прогон» 06, 16197:1750; D-103).
 */
export type ProgressPanelVariant = 'sunken' | 'inverse'

/** Строка журнала: done — выполнено (✓), current — идёт сейчас (•). */
export interface ProgressLogLine {
  readonly text: string
  readonly state: 'done' | 'current'
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
  /** Журнал строками под полосой (только inverse); новые строки зачитываются вежливо. */
  readonly log?: readonly ProgressLogLine[]
  /** Операция идёт: `aria-busy` на плашке. */
  readonly busy?: boolean
  /** Уровень заголовка: 3 — внутри раздела страницы (А1а), 2 — плашка сама раздел (06). */
  readonly headingLevel?: 2 | 3
  /** Статус по частям операции: «ФЦ БАС — получено 12 позиций · …». */
  readonly children?: ReactNode
}

function LogList({ lines }: { readonly lines: readonly ProgressLogLine[] }) {
  return (
    <ol aria-live="polite" className="flex flex-col gap-10 bg-inverse-well type-body text-bg">
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
export function ProgressPanel({ title, label, value, variant = 'sunken', meta, log, busy, headingLevel = 3, children }: ProgressPanelProps) {
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
        {log && log.length > 0 && <LogList lines={log} />}
        {children && <p className="type-body text-text-disabled">{children}</p>}
      </section>
    )
  }
  return (
    <section aria-labelledby={titleId} aria-live="polite" aria-busy={busy} className="flex flex-col gap-10 rounded-lg bg-surface-sunken px-20 py-16">
      <Heading id={titleId} className="type-heading font-medium text-text">{title}</Heading>
      <Progress label={label} value={value} track="strong" />
      {children && <p className="type-body text-text-secondary">{children}</p>}
    </section>
  )
}
