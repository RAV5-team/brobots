import * as RadixSlider from '@radix-ui/react-slider'
import { clsx } from 'clsx'
import { isPassed } from './chartScale'

/** Подпись под шкалой: время записи, с, и текст — «00», «06», «12». */
export interface TimelineTick {
  readonly at: number
  readonly label: string
}

interface PlaybackTimelineProps {
  /** Имя для чтения с экрана: «Время дня». */
  readonly label: string
  /** Время записи, с. */
  readonly value: number
  /** Длительность записи, с. */
  readonly max: number
  readonly step?: number
  readonly onValueChange: (value: number) => void
  /** Значение словами: «08:12». */
  readonly valueText?: string
  /** Потребность по равным отрезкам записи (обычно по часам): высоты мини-столбцов. */
  readonly bars: readonly number[]
  readonly ticks?: readonly TimelineTick[]
  readonly disabled?: boolean
  readonly className?: string
  readonly 'data-demo-state'?: string | undefined
}

const pct = (share: number): string => `${String(Number((share * 100).toFixed(4)))}%`

/**
 * Шкала суток 2D-плеера (доска 16325, 3.5, 17040:10): мини-гистограмма потребности, пройденная часть — лаймом,
 * впереди — серым, бегунок — черта с точкой; подписи часов под шкалой. Поведение и доступность — как у `Slider`
 * (Radix: `role="slider"`, `aria-valuetext`; клавиши — стрелки, Home / End, PageUp / PageDown).
 */
export function PlaybackTimeline({ label, value, max, step = 1, onValueChange, valueText, bars, ticks = [], disabled = false, className, ...demo }: PlaybackTimelineProps) {
  const peak = Math.max(...bars, Number.EPSILON)
  return (
    <div className={clsx('flex min-w-0 flex-col gap-4', disabled && 'opacity-(--rav-disabled-opacity)', className)}>
      <RadixSlider.Root
        value={[value]}
        min={0}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => { if (next !== undefined) onValueChange(next) }}
        className={clsx('relative flex h-40 w-full touch-none items-end select-none', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
      >
        <RadixSlider.Track className="relative flex h-32 grow items-end gap-2">
          {bars.map((bar, i) => {
            const passed = isPassed(i, bars.length, value, max)
            return (
              <span
                key={i}
                data-passed={passed ? true : undefined}
                className={clsx('min-w-0 flex-1 rounded-t-xs transition-colors', passed ? 'bg-accent' : 'bg-border')}
                style={{ height: pct(Math.max(bar, 0) / peak) }}
              />
            )
          })}
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-label={label}
          aria-valuetext={valueText}
          data-demo-state={demo['data-demo-state']}
          className={clsx(
            'relative block h-40 w-2 rounded-full bg-inverse',
            "before:absolute before:-top-2 before:left-1/2 before:size-8 before:-translate-x-1/2 before:rounded-full before:bg-inverse before:content-['']",
            'not-data-disabled:hover:before:scale-125',
          )}
        />
      </RadixSlider.Root>
      {ticks.length > 0 && (
        <div aria-hidden className="relative h-16">
          {ticks.map((tick) => (
            <span key={tick.at} className="absolute -translate-x-1/2 type-caption-xs text-text-muted tabular-nums" style={{ left: pct(max > 0 ? tick.at / max : 0) }}>
              {tick.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
