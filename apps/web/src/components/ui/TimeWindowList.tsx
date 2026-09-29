import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { ru } from '@/shared/i18n/ru'
import { Button } from './Button'
import { hourText } from './hourText'
import { IconButton } from './IconButton'
import { Select } from './Select'
import { addWindow, HOURS_PER_DAY, windowHours, type TimeWindow } from './timeWindows'

export type { TimeWindow } from './timeWindows'

const t = ru.ui.timeWindows
const HOUR_OPTIONS = Array.from({ length: HOURS_PER_DAY }, (_, h) => ({ value: String(h), label: `${hourText(h)}:00` }))

interface TimeWindowListProps {
  /** Имя списка: «Приёмка» — подпись колонки; входит в имена полей для чтения с экрана. */
  readonly label: string
  readonly windows: readonly TimeWindow[]
  readonly onChange?: (windows: readonly TimeWindow[]) => void
  /** Заблокирован: «Отгрузка в те же часы, что приёмка» (3.2) — поля видны, но недоступны. */
  readonly disabled?: boolean
  /** Только чтение (гость, закрытый шаг): окна текстом без полей и кнопок. */
  readonly readOnly?: boolean
  /** Кнопка «Добавить окно» под списком; экран может поставить свою в ряд с «Вернуть как в расчёте» (`addWindow`). */
  readonly showAdd?: boolean
  readonly className?: string
}

/**
 * Список окон пиковых часов (components.md: TimeWindowList; доска 16325, 3.2, 16325:158): строка — два `Select`
 * часов «08:00 — 11:00», длительность «3 ч», «×» удаления; под списком — «Добавить окно».
 */
export function TimeWindowList({ label, windows, onChange, disabled = false, readOnly = false, showAdd = true, className }: TimeWindowListProps) {
  const replace = (index: number, patch: Partial<TimeWindow>) => onChange?.(windows.map((w, i) => (i === index ? { ...w, ...patch } : w)))
  const locked = disabled || !onChange
  return (
    <div className={clsx('flex flex-col gap-12', className)}>
      <ul aria-label={label} className="flex flex-col gap-8">
        {windows.map((w, i) => {
          const n = i + 1
          const duration = <span className={clsx('type-caption tabular-nums', disabled ? 'text-text-disabled' : 'text-text-muted')}>{t.hours(windowHours(w))}</span>
          if (readOnly) {
            return (
              <li key={i} className="flex items-center gap-8 type-body text-text tabular-nums">
                {`${hourText(w.from)}:00 — ${hourText(w.to)}:00`}
                {duration}
              </li>
            )
          }
          return (
            <li key={i} className="flex items-center gap-8">
              <Select variant="filter" aria-label={t.start(label, n)} options={HOUR_OPTIONS} value={String(w.from)} disabled={locked}
                onChange={(v) => { replace(i, { from: Number(v) }) }} />
              <span aria-hidden className={disabled ? 'text-text-disabled' : 'text-text-muted'}>—</span>
              <Select variant="filter" aria-label={t.end(label, n)} options={HOUR_OPTIONS} value={String(w.to)} disabled={locked}
                onChange={(v) => { replace(i, { to: Number(v) }) }} />
              <span className="ml-auto">{duration}</span>
              <IconButton size={24} icon={X} label={t.remove(label, n)} disabled={locked}
                onClick={() => onChange?.(windows.filter((_, j) => j !== i))} />
            </li>
          )
        })}
      </ul>
      {showAdd && !readOnly && (
        <Button size="sm" className="self-start" disabled={locked} onClick={() => onChange?.(addWindow(windows))}>{t.add}</Button>
      )}
    </div>
  )
}
