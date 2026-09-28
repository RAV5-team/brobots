import * as RadixCheckbox from '@radix-ui/react-checkbox'
import * as RadixRadio from '@radix-ui/react-radio-group'
import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { optionValue } from './optionValue'

const ARROW_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

export interface RadioTableColumn {
  readonly key: string
  readonly label: string
  /** Ширина колонки с числом (`w-(--rav-…)`); у первой колонки не нужна — она забирает остаток. */
  readonly widthClass?: string
}

/** default — обычная строка; danger — числа строки красным (вне рейтинга, отрицательный эффект; 2.1, 16325:101). */
export type RadioTableRowTone = 'default' | 'danger'

export interface RadioTableRow<T extends string> {
  readonly value: T
  /** Имя строки для скринридера: ячейки — отдельные span, без него текст склеивается («Химкисклад»). */
  readonly label: string
  /** Ячейки по порядку колонок: первая — название и подпись, остальные — числа справа. Только текст: строка — одна кнопка. */
  readonly cells: readonly ReactNode[]
  /** Строку нельзя выбрать: полупрозрачна, стрелки её пропускают (как пункт Select). */
  readonly disabled?: boolean
  /** Ячейка колонки `trailing` — вне кнопки строки, поэтому в ней живут кнопки: пилюля балла, чип с Popover, шеврон. */
  readonly trailing?: ReactNode
  /** Раскрытие под строкой на общей подложке: разбор балла (2.1), группы параметров процесса (шаг 1). */
  readonly detail?: ReactNode
  /** Показать `detail`; по умолчанию — у выбранной строки. */
  readonly expanded?: boolean
  readonly tone?: RadioTableRowTone
}

interface CommonProps<T extends string> {
  readonly label: string
  readonly columns: readonly RadioTableColumn[]
  readonly rows: readonly RadioTableRow<T>[]
  /** Колонка после чисел с интерактивными ячейками `row.trailing` (шапка и ширина). */
  readonly trailingColumn?: RadioTableColumn | undefined
}

interface SingleProps<T extends string> extends CommonProps<T> {
  readonly selection?: 'single'
  readonly value: T | null
  readonly onChange: (value: T) => void
  /** Enter на выбранной строке — основное действие окна («Продолжить», A2). */
  readonly onConfirm?: (value: T) => void
}

/** Режим флажков: несколько строк («Сравнить» 2–4 варианта, 2.1). */
interface MultipleProps<T extends string> extends CommonProps<T> {
  readonly selection: 'multiple'
  readonly values: readonly T[]
  readonly onValuesChange: (values: readonly T[]) => void
}

type RadioTableProps<T extends string> = SingleProps<T> | MultipleProps<T>

const cellClassFor = (columns: readonly RadioTableColumn[]) => (index: number) =>
  index === 0 ? 'min-w-0 flex-1' : clsx('shrink-0 text-right', columns[index]?.widthClass)

const ROW_STATES =
  'not-data-disabled:cursor-pointer data-disabled:cursor-not-allowed data-disabled:opacity-(--rav-disabled-opacity)'

function Header({ columns, trailingColumn }: { readonly columns: readonly RadioTableColumn[]; readonly trailingColumn: RadioTableColumn | undefined }) {
  const cellClass = cellClassFor(columns)
  return (
    // Шапка видна глазами; программно значения строк читаются вместе с единицами («20 000 м²»).
    <div aria-hidden className="flex items-center gap-12 px-12 pb-8">
      <span className="w-20 shrink-0" />
      {columns.map((column, index) => (
        <span key={column.key} className={clsx('type-overline font-medium text-text-muted', cellClass(index))}>{column.label}</span>
      ))}
      {trailingColumn && (
        <span className={clsx('shrink-0 text-right type-overline font-medium text-text-muted', trailingColumn.widthClass)}>{trailingColumn.label}</span>
      )}
    </div>
  )
}

function Cells<T extends string>({ row, columns }: { readonly row: RadioTableRow<T>; readonly columns: readonly RadioTableColumn[] }) {
  const cellClass = cellClassFor(columns)
  return row.cells.map((cell, index) => (
    <span
      key={columns[index]?.key ?? index}
      className={clsx(cellClass(index), index > 0 && 'type-body font-medium', index > 0 && (row.tone === 'danger' ? 'text-danger' : 'text-text'))}
    >
      {cell}
    </span>
  ))
}

interface RowShellProps {
  readonly selected: boolean
  readonly disabled: boolean
  readonly trailing: ReactNode
  readonly trailingColumn: RadioTableColumn | undefined
  readonly detail: ReactNode
  readonly children: ReactNode
}

/** Строка с колонкой `trailing` и раскрытием: подложка выбранной строки — общая для строки и раскрытия. */
function RowShell({ selected, disabled, trailing, trailingColumn, detail, children }: RowShellProps) {
  return (
    <div
      className={clsx(
        'flex flex-col rounded-md border-b border-border transition-colors last:border-b-0',
        selected ? 'bg-surface-sunken' : !disabled && 'hover:bg-surface-muted',
      )}
    >
      <div className="flex items-center">
        {children}
        {trailingColumn && (
          <span className={clsx('flex shrink-0 items-center justify-end gap-8 py-12 pr-12', trailingColumn.widthClass, disabled && 'opacity-(--rav-disabled-opacity)')}>
            {trailing}
          </span>
        )}
      </div>
      {detail !== undefined && detail !== null && <div className="px-12 pb-12">{detail}</div>}
    </div>
  )
}

/** Раскрыта ли строка: явно или, по умолчанию, когда выбрана. */
const detailOf = <T extends string>(row: RadioTableRow<T>, selected: boolean): ReactNode =>
  (row.expanded ?? selected) ? row.detail : undefined

const isExtended = <T extends string>(props: RadioTableProps<T>) =>
  props.trailingColumn !== undefined || props.rows.some((r) => r.detail !== undefined || r.trailing !== undefined || r.tone !== undefined)

/**
 * Таблица-радиогруппа (components.md: RadioTable; A2 16429:8): шапка-overline и строки с радиокнопкой 20×20.
 * Radix RadioGroup: Tab — в группу, стрелки — выбор строки; Enter радиогруппа сама не обрабатывает, его ловим здесь.
 * Выбор по стрелке делаем сами: Radix переводит фокус в setTimeout и выбирает строку, только если клавиша ещё нажата, —
 * при быстром нажатии фокус уезжал, а выбор оставался прежним.
 * Для шагов 1–2 (16969:10, 16325:101) — необязательные колонка `trailingColumn` с кнопками вне строки, раскрытие `detail`,
 * тон строки `danger` и режим флажков `selection="multiple"`. Без них разметка — прежняя.
 */
export function RadioTable<T extends string>(props: RadioTableProps<T>) {
  if (props.selection === 'multiple') return <CheckTable {...props} />
  return <SingleTable {...props} extended={isExtended(props)} />
}

function SingleTable<T extends string>({ label, columns, rows, value, onChange, onConfirm, trailingColumn, extended }: SingleProps<T> & { readonly extended: boolean }) {
  const isArrowMove = useRef(false)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Кнопки trailing и detail (и поповеры из них) лежат внутри группы: их клавиши — не выбор строки.
    const isOnRow = event.target instanceof Element && event.target.closest('[role="radio"]') !== null
    isArrowMove.current = isOnRow && ARROW_KEYS.includes(event.key)
    if (!isOnRow || event.key !== 'Enter' || value === null || !onConfirm) return
    event.preventDefault()
    onConfirm(value)
  }

  const item = (row: RadioTableRow<T>, className: string) => (
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
      className={className}
    >
      <span
        className={clsx(
          'flex size-20 shrink-0 items-center justify-center rounded-full bg-surface-muted shadow-inset-sm transition-colors',
          'group-data-[state=checked]:bg-inverse group-data-[state=checked]:shadow-none',
        )}
      >
        <RadixRadio.Indicator className="size-8 rounded-full bg-on-inverse" />
      </span>
      <Cells row={row} columns={columns} />
    </RadixRadio.Item>
  )

  return (
    <div className="flex flex-col">
      <Header columns={columns} trailingColumn={trailingColumn} />
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
        {rows.map((row) => {
          if (!extended) {
            return item(row, clsx(
              'group flex w-full items-center gap-12 rounded-md border-b border-border p-12 text-left transition-colors last:border-b-0',
              'not-data-disabled:cursor-pointer not-data-disabled:not-data-[state=checked]:hover:bg-surface-muted data-[state=checked]:bg-surface-sunken',
              'data-disabled:cursor-not-allowed data-disabled:opacity-(--rav-disabled-opacity)',
            ))
          }
          const selected = row.value === value
          return (
            <RowShell
              key={row.value}
              selected={selected}
              disabled={row.disabled ?? false}
              trailing={row.trailing}
              trailingColumn={trailingColumn}
              detail={detailOf(row, selected)}
            >
              {item(row, clsx('group flex min-w-0 flex-1 items-center gap-12 rounded-md p-12 text-left', ROW_STATES))}
            </RowShell>
          )
        })}
      </RadixRadio.Root>
    </div>
  )
}

/** Режим флажков: каждая строка — флажок (Radix Checkbox), Tab по строкам, Space отмечает. */
function CheckTable<T extends string>({ label, columns, rows, values, onValuesChange, trailingColumn }: MultipleProps<T>) {
  return (
    <div className="flex flex-col">
      <Header columns={columns} trailingColumn={trailingColumn} />
      <div role="group" aria-label={label} className="flex flex-col">
        {rows.map((row) => {
          const checked = values.includes(row.value)
          return (
            <RowShell
              key={row.value}
              selected={checked}
              disabled={row.disabled ?? false}
              trailing={row.trailing}
              trailingColumn={trailingColumn}
              detail={detailOf(row, checked)}
            >
              <RadixCheckbox.Root
                checked={checked}
                disabled={row.disabled ?? false}
                aria-label={row.label}
                onCheckedChange={(next) => {
                  onValuesChange(next === true ? [...values, row.value] : values.filter((v) => v !== row.value))
                }}
                className={clsx('group flex min-w-0 flex-1 items-center gap-12 rounded-md p-12 text-left', ROW_STATES)}
              >
                {/* Флажок 18 в поле 20 — колонка совпадает с радиокнопками. */}
                <span className="flex w-20 shrink-0 justify-center">
                  <span
                    className={clsx(
                      'flex size-18 items-center justify-center rounded-xs bg-surface-muted shadow-inset-sm transition-colors',
                      'group-data-[state=checked]:bg-inverse group-data-[state=checked]:shadow-none',
                    )}
                  >
                    <RadixCheckbox.Indicator>
                      <Check aria-hidden size={12} strokeWidth={3} className="text-on-inverse" />
                    </RadixCheckbox.Indicator>
                  </span>
                </span>
                <Cells row={row} columns={columns} />
              </RadixCheckbox.Root>
            </RowShell>
          )
        })}
      </div>
    </div>
  )
}
