import * as RadixSlider from '@radix-ui/react-slider'
import { clsx } from 'clsx'

interface SliderProps {
  /** Имя для чтения с экрана: «Время воспроизведения». */
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step?: number
  readonly onValueChange: (value: number) => void
  /** Значение словами: «08:12». */
  readonly valueText?: string
  readonly disabled?: boolean
  readonly className?: string
  readonly 'data-demo-state'?: string | undefined
}

/**
 * Ползунок одного значения (components.md: Slider; D-87, только для 2D-плеера 07a): вдавленная дорожка 6 как у
 * `Progress`, тёмное заполнение, выпуклый бегунок 18. Клавиатура — стрелки, Home / End, PageUp / PageDown (Radix).
 */
export function Slider({ label, value, min, max, step = 1, onValueChange, valueText, disabled = false, className, ...demo }: SliderProps) {
  return (
    <RadixSlider.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={([next]) => { if (next !== undefined) onValueChange(next) }}
      className={clsx(
        'relative flex h-18 w-full touch-none items-center select-none',
        disabled && 'cursor-not-allowed opacity-(--rav-disabled-opacity)',
        className,
      )}
    >
      <RadixSlider.Track className="relative h-6 grow overflow-hidden rounded-full bg-surface-sunken shadow-inset-sm">
        <RadixSlider.Range className="absolute h-full rounded-full bg-inverse" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        data-demo-state={demo['data-demo-state']}
        className={clsx(
          'block size-18 rounded-full bg-bg shadow-raised-sm transition-transform',
          'not-data-disabled:hover:scale-110 not-data-disabled:active:scale-95',
        )}
      />
    </RadixSlider.Root>
  )
}
