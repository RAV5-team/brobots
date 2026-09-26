interface ProgressProps {
  /** Что выполняется: «Опрос источников». */
  readonly label: string
  /** 0…100. */
  readonly value: number
}

const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)))

/** Полоса выполнения 6 px (components.md: Progress; 16044:378). Долгие операции показывают статус (ТЗ 4.3.3). */
export function Progress({ label, value }: ProgressProps) {
  const percent = clamp(value)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-6 w-full overflow-hidden rounded-full bg-surface-sunken"
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${String(percent)}%` }} />
    </div>
  )
}
