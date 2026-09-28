import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ru } from '@/shared/i18n/ru'
import { Bridge } from './MergedButton'

/** Состояние шага: пройден, открыт сейчас, можно открыть, ещё закрыт. */
export type StepperStepState = 'done' | 'current' | 'available' | 'locked'

export interface StepperStep {
  readonly key: string
  readonly label: string
  readonly state: StepperStepState
  /** Адрес шага; без него шаг — только индикатор. Текущий и закрытый шаги ссылкой не бывают. */
  readonly to?: string
}

interface StepperProps {
  /** Доступное имя навигации: «Шаги проекта», «Этапы симуляции». */
  readonly label: string
  readonly steps: readonly StepperStep[]
  /**
   * pills — шаги проекта в капсуле (16197:1120): номер в круге, у пройденного — ✓, текущий — тёмная пилюля,
   * слитая с кругом перемычкой, как у MergedButton; segments — этапы симуляции (16197:1147): полоса 4 и подпись;
   * capsule — этапы симуляции на доске 16325 (16325:149): капсула из равных пунктов с точкой, как SectionNav.
   */
  readonly variant?: 'pills' | 'segments' | 'capsule'
  /**
   * Только для pills: где метка шага. start — круг с номером перед подписью (16197:1120);
   * end — подпись, затем ✓ или номер, текущий — тёмная пилюля без круга (доска 16325).
   */
  readonly marker?: 'start' | 'end'
  /** Для витрины: состояние первого шага-ссылки. */
  readonly 'data-demo-state'?: string | undefined
}

const t = ru.ui.stepper

/**
 * Степпер шагов (components.md: Stepper; D-54 — 4 шага по PRD 0.9). Шаги — упорядоченный список в навигации,
 * текущий — `aria-current="step"`, закрытый — скрытая пометка «недоступен» (`aria-disabled` у нефокусируемого span
 * скринридер не озвучивает). Пройденные и доступные шаги — ссылки.
 */
export function Stepper({ label, steps, variant = 'pills', marker = 'start', ...demo }: StepperProps) {
  const demoKey = steps.find((s) => isLink(s))?.key
  const item = (step: StepperStep, index: number) => {
    const demoState = step.key === demoKey ? demo['data-demo-state'] : undefined
    if (variant === 'segments') return <Segment step={step} demoState={demoState} />
    if (variant === 'capsule') return <CapsuleItem step={step} demoState={demoState} />
    return marker === 'end'
      ? <TrailingPill step={step} number={index + 1} demoState={demoState} />
      : <Pill step={step} number={index + 1} demoState={demoState} />
  }
  return (
    <nav
      aria-label={label}
      className={clsx(
        variant === 'pills' && 'self-start rounded-2xl border border-highlight bg-bg p-4 shadow-raised-md',
        variant === 'capsule' && 'rounded-full bg-surface-sunken p-4',
      )}
    >
      <ol className={clsx('flex', LIST[variant])}>
        {steps.map((step, index) => (
          <li key={step.key} className={clsx(variant === 'segments' && 'min-w-0 flex-1', variant === 'capsule' && 'flex min-w-0 flex-1')}>
            {item(step, index)}
          </li>
        ))}
      </ol>
    </nav>
  )
}

const LIST: Record<NonNullable<StepperProps['variant']>, string> = {
  pills: 'items-center',
  segments: 'items-start gap-6',
  capsule: 'gap-4',
}

const isLink = (step: StepperStep): step is StepperStep & { to: string } =>
  step.to !== undefined && (step.state === 'done' || step.state === 'available')

interface ItemProps {
  readonly step: StepperStep
  readonly demoState: string | undefined
}

/** Шаг — ссылкой, если его можно открыть; текущий — текстом с `aria-current`, закрытый — текстом с пометкой в подписи. */
function StepShell({ step, demoState, className, children }: ItemProps & { readonly className: string; readonly children: ReactNode }) {
  if (isLink(step)) {
    return <Link to={step.to} data-demo-state={demoState} className={className}>{children}</Link>
  }
  return (
    <span aria-current={step.state === 'current' ? 'step' : undefined} className={className}>
      {children}
    </span>
  )
}

/** Скрытая пометка состояния к подписи шага: «, пройден» или «, недоступен». */
function StateNote({ state }: { readonly state: StepperStepState }) {
  if (state === 'done') return <span className="sr-only">{t.done}</span>
  if (state === 'locked') return <span className="sr-only">{t.locked}</span>
  return null
}

function Pill({ step, number, demoState }: ItemProps & { readonly number: number }) {
  const name = (
    <>
      <span className="sr-only">{t.stepPrefix(number)}</span>{' '}
      {step.label}
      <StateNote state={step.state} />
    </>
  )
  if (step.state === 'current') {
    // Текущий шаг — круг с номером и пилюля с подписью, слитые перемычкой (как активный пункт меню).
    return (
      <span aria-current="step" className="flex h-36 items-center drop-shadow-popover">
        <span aria-hidden className="flex h-36 w-40 items-center justify-center rounded-full bg-inverse type-caption font-semibold text-on-inverse">{number}</span>
        <Bridge className="h-36 fill-inverse" />
        <span className="flex h-36 items-center rounded-full bg-inverse px-20 type-body font-medium whitespace-nowrap text-on-inverse">{name}</span>
      </span>
    )
  }
  const locked = step.state === 'locked'
  return (
    <StepShell
      step={step}
      demoState={demoState}
      className={clsx(
        'flex h-36 items-center gap-8 rounded-full pr-16 pl-12 type-body font-medium whitespace-nowrap transition-colors',
        isLink(step) && 'hover:bg-surface-muted active:bg-surface-sunken',
        step.state === 'done' ? 'text-text' : 'text-text-secondary',
        locked && 'cursor-not-allowed',
      )}
    >
      <span aria-hidden className={clsx('flex size-20 shrink-0 items-center justify-center rounded-full type-caption font-semibold text-text', step.state === 'done' ? 'bg-border' : 'bg-surface-sunken')}>
        {step.state === 'done' ? <Check size={12} strokeWidth={2.5} /> : number}
      </span>
      {name}
    </StepShell>
  )
}

function Segment({ step, demoState }: ItemProps) {
  const current = step.state === 'current'
  return (
    <StepShell step={step} demoState={demoState} className={clsx('flex flex-col gap-8 rounded-xs', isLink(step) && 'hover:[&>span:last-child]:text-text')}>
      <span aria-hidden className={clsx('h-4 w-full rounded-xs', current ? 'bg-inverse' : 'bg-surface-sunken')} />
      <span className={clsx('truncate type-caption', current ? 'font-medium text-text' : 'text-text-secondary')}>
        {step.label}
        <StateNote state={step.state} />
      </span>
    </StepShell>
  )
}

/** Шаг pills с меткой после подписи (доска 16325): «Параметры ✓», текущий — тёмная пилюля «Симуляция 3» с лаймом. */
function TrailingPill({ step, number, demoState }: ItemProps & { readonly number: number }) {
  const current = step.state === 'current'
  return (
    <StepShell
      step={step}
      demoState={demoState}
      className={clsx(
        'flex h-36 items-center gap-8 rounded-full px-20 type-body font-medium whitespace-nowrap transition-colors',
        current ? 'bg-inverse text-on-inverse drop-shadow-popover' : 'text-text',
        isLink(step) && 'hover:bg-surface-muted active:bg-surface-sunken',
        step.state === 'locked' && 'cursor-not-allowed',
      )}
    >
      <span className="sr-only">{t.stepPrefix(number)}</span>{' '}
      {step.label}
      <StateNote state={step.state} />
      <span aria-hidden className={clsx('flex items-center type-caption', current ? 'font-semibold' : 'text-text-muted')}>
        {step.state === 'done' ? <Check size={14} strokeWidth={2} /> : number}
      </span>
    </StepShell>
  )
}

/** Пункт капсулы этапов (вид SectionNav, 15935:914): точка и подпись, текущий — тёмный с лаймовой точкой. */
function CapsuleItem({ step, demoState }: ItemProps) {
  const current = step.state === 'current'
  return (
    <StepShell
      step={step}
      demoState={demoState}
      className={clsx(
        'flex h-32 min-w-0 flex-1 items-center justify-center gap-8 rounded-full px-12 type-caption whitespace-nowrap transition-colors',
        current ? 'bg-inverse font-semibold text-on-inverse' : 'font-medium text-text-secondary',
        isLink(step) && 'hover:bg-surface-muted hover:text-text',
        step.state === 'locked' && 'cursor-not-allowed',
      )}
    >
      <span aria-hidden className={clsx('size-8 shrink-0 rounded-full', current ? 'bg-accent' : 'bg-text-muted')} />
      <span className="truncate">
        {step.label}
        <StateNote state={step.state} />
      </span>
    </StepShell>
  )
}
