import { formatNumber } from '@/shared/format'

interface CounterProps {
  readonly value: number
}

/** Счётчик в кнопке: тёмная пилюля с лаймовым числом («Открыть 8», экран 06, 15935:144). */
export function Counter({ value }: CounterProps) {
  return (
    <span className="inline-flex h-24 min-w-24 items-center justify-center rounded-full bg-inverse px-8 type-caption font-medium text-on-inverse drop-shadow-popover">
      {formatNumber(value)}
    </span>
  )
}
