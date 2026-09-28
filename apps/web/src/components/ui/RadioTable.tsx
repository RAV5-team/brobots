import * as RadixRadio from '@radix-ui/react-radio-group'
import { clsx } from 'clsx'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { optionValue } from './optionValue'

const ARROW_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

export interface RadioTableColumn {
  readonly key: string
  readonly label: string
  /** Ширина колонки с числом (`w-(--rav-…)`); у первой колонки не нужна — она забирает остаток. */
  readonly widthClass?: string
}

export interface RadioTableRow<T extends string> {
  readonly value: T
  /** Имя строки для скринридера: ячейки — отдельные span, без него текст склеивается («Химкисклад»). */
  readonly label: string
  /** Ячейки по порядку колонок: первая — название и подпись, остальные — числа справа. */
  readonly cells: readonly ReactNode[]
  /** Строку нельзя выбрать: полупрозрачна, стрелки её пропускают (как пункт Select). */
  readonly disabled?: boolean
}

interface RadioTableProps<T extends string> {
  readonly label: string
  readonly columns: readonly RadioTableColumn[]
  readonly rows: readonly RadioTableRow<T>[]
  readonly value: T | null
  readonly onChange: (value: T) => void
  /** Enter на выбранной строке — основное действие окна («Продолжить», A2). */
  readonly onConfirm?: (value: T) => void
}

/**
 * Таблица-радиогруппа (components.md: RadioTable; A2 16429:8): шапка-overline и строки с радиокнопкой 20×20.
 * Radix RadioGroup: Tab — в группу, стрелки — выбор строки; Enter радиогруппа сама не обрабатывает, его ловим здесь.
 * Выбор по стрелке делаем сами: Radix переводит фокус в setTimeout и выбирает строку, только если клавиша ещё нажата, —
 * при быстром нажатии фокус уезжал, а выбор оставался прежним.
 */
export function RadioTable<T extends string>({ label, columns, rows, value, onChange, onConfirm }: RadioTableProps<T>) {
  const isArrowMove = useRef(false)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    isArrowMove.current = ARROW_KEYS.includes(event.key)
    if (event.key !== 'Enter' || value === null || !onConfirm) return
    event.preventDefault()
    onConfirm(value)
  }
  const cellClass = (index: number) => (index === 0 ? 'min-w-0 flex-1' : clsx('shrink-0 text-right', columns[index]?.widthClass))

  return (
    <div className="flex flex-col">
      {/* Шапка видна глазами; программно значения строк читаются вместе с единицами («20 000 м²»). */}
      <div aria-hidden className="flex items-center gap-12 px-12 pb-8">
        <span className="w-20 shrink-0" />
        {columns.map((column, index) => (
          <span key={column.key} className={clsx('type-overline font-medium text-text-muted', cellClass(index))}>{column.label}</span>
        ))}
      </div>
      <RadixRadio.Root
        aria-label={label}
        value={value ?? ''}
        onValueChange={(next: string) => {
          const row = optionValue(rows, next)
          if (row !== undefined) onChange(row)
        }}
        onKeyDown={handleKeyDown}
        className="flex flex-col"
      >
        {rows.map((row) => (
          <RadixRadio.Item
            key={row.value}
            value={row.value}
            disabled={row.disabled ?? false}
            aria-label={row.label}
            onFocus={() => {
              if (!isArrowMove.current) return
              isArrowMove.current = false
              onChange(row.value)
            }}
            className={clsx(
              'group flex w-full items-center gap-12 rounded-md border-b border-border p-12 text-left transition-colors last:border-b-0',
              'not-data-disabled:cursor-pointer not-data-disabled:not-data-[state=checked]:hover:bg-surface-muted data-[state=checked]:bg-surface-sunken',
              'data-disabled:cursor-not-allowed data-disabled:opacity-(--rav-disabled-opacity)',
            )}
          >
            <span
              className={clsx(
                'flex size-20 shrink-0 items-center justify-center rounded-full bg-surface-muted shadow-inset-sm transition-colors',
                'group-data-[state=checked]:bg-inverse group-data-[state=checked]:shadow-none',
              )}
            >
              <RadixRadio.Indicator className="size-8 rounded-full bg-on-inverse" />
            </span>
            {row.cells.map((cell, index) => (
              <span key={columns[index]?.key ?? index} className={clsx(cellClass(index), index > 0 && 'type-body font-medium text-text')}>{cell}</span>
            ))}
          </RadixRadio.Item>
        ))}
      </RadixRadio.Root>
    </div>
  )
}
