import * as Popover from '@radix-ui/react-popover'
import { ChevronDown } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { ru } from '@/shared/i18n/ru'
import { Checkbox } from './Checkbox'
import { FILTER_PILL_CLASSES } from './buttonStyles'
import { multiSelectButtonLabel } from './multiSelectLabel'
import { Search } from './Search'

export interface MultiSelectOption<T extends string> {
  readonly value: T
  readonly label: string
  /** Короткая подпись в кнопке, если отличается от строки списка: «OP-01» вместо «OP-01 · Перемещение грузов» (К-2, 16642:2301). */
  readonly buttonLabel?: string
  readonly disabled?: boolean
}

/** Группа значений в списке: «Тип затрат», «Цена за единицу» (PRD 7.4, фильтр «Стоимость»). */
export interface MultiSelectGroup<T extends string> {
  readonly label: string
  readonly options: readonly MultiSelectOption<T>[]
}

interface MultiSelectFilterProps<T extends string> {
  /** Название фильтра — подпись кнопки, пока ничего не выбрано: «Отрасль». */
  readonly label: string
  /** Значения без групп или группами — одно из двух. */
  readonly options?: readonly MultiSelectOption<T>[]
  readonly groups?: readonly MultiSelectGroup<T>[]
  readonly value: readonly T[]
  readonly onChange: (value: readonly T[]) => void
  /** Поиск по значениям: подсказка в поле, например «Найти отрасль». Нет — поля поиска нет. */
  readonly searchLabel?: string
  readonly disabled?: boolean
  /** Почему фильтр недоступен — подсказка у кнопки. */
  readonly hint?: string | undefined
  readonly 'data-demo-state'?: string
}

const t = ru.ui.multiSelect

function matches(label: string, query: string): boolean {
  return label.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))
}

/** Стрелки вверх и вниз переводят фокус между флажками; Space отмечает флажок (Radix), Esc закрывает список. */
function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const boxes = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]:not(:disabled)'))
  if (boxes.length === 0) return
  event.preventDefault()
  const current = boxes.indexOf(document.activeElement as HTMLButtonElement)
  const step = event.key === 'ArrowDown' ? 1 : -1
  const next = current === -1 ? (step === 1 ? 0 : boxes.length - 1) : (current + step + boxes.length) % boxes.length
  boxes[next]?.focus()
}

/**
 * Фильтр с мультивыбором (components.md: MultiSelectFilter; PRD 7.4): кнопка в стиле `Select variant="filter"`,
 * во всплывающей панели — поиск по значениям (по желанию), флажки, группы и «Сбросить».
 */
export function MultiSelectFilter<T extends string>({
  label, options, groups, value, onChange, searchLabel, disabled = false, hint, ...demo
}: MultiSelectFilterProps<T>) {
  const [query, setQuery] = useState('')
  const sections: readonly MultiSelectGroup<T>[] = groups ?? [{ label: '', options: options ?? [] }]
  const all = sections.flatMap((g) => g.options)
  const visible = sections
    .map((g) => ({ ...g, options: g.options.filter((o) => matches(o.label, query)) }))
    .filter((g) => g.options.length > 0)

  const toggle = (option: T, checked: boolean) => {
    onChange(checked ? [...value, option] : value.filter((v) => v !== option))
  }

  return (
    <Popover.Root onOpenChange={(open) => { if (!open) setQuery('') }}>
      <Popover.Trigger
        disabled={disabled}
        title={hint}
        data-active={value.length > 0}
        data-demo-state={demo['data-demo-state']}
        className={FILTER_PILL_CLASSES}
      >
        {multiSelectButtonLabel(label, value, all)}
        {/* Шеврон 12, как caret на К-1 и К-2 (16642:645): с 16 ряд фильтров К-2 не помещается в 1078 (D-74). */}
        <ChevronDown aria-hidden size={12} strokeWidth={2.5} />
      </Popover.Trigger>
      <Popover.Portal>
        {/* Выше окна Modal (подложка z-30, окно z-40), как список Select. */}
        <Popover.Content
          align="start"
          sideOffset={8}
          aria-label={label}
          className="z-50 flex max-h-(--radix-popover-content-available-height) w-(--rav-multiselect-width) flex-col gap-12 rounded-xl bg-bg p-16 shadow-raised-lg"
        >
          {searchLabel && <Search label={searchLabel} value={query} onChange={(e) => { setQuery(e.target.value) }} />}
          <div role="group" aria-label={label} onKeyDown={moveFocus} className="flex min-h-0 flex-col gap-12 overflow-y-auto">
            {visible.length === 0 && <p className="type-body-sm text-text-muted">{t.nothingFound}</p>}
            {visible.map((group) => (
              <fieldset key={group.label} className="flex flex-col gap-8">
                {group.label && <legend className="mb-8 type-overline text-text-muted">{group.label}</legend>}
                {group.options.map((option) => (
                  <Checkbox
                    key={option.value}
                    label={option.label}
                    checked={value.includes(option.value)}
                    onCheckedChange={(checked) => { toggle(option.value, checked) }}
                    disabled={option.disabled ?? false}
                  />
                ))}
              </fieldset>
            ))}
          </div>
          <footer className="flex justify-end border-t border-border pt-12">
            <button
              type="button"
              disabled={value.length === 0}
              onClick={() => { onChange([]) }}
              className="rounded-full px-8 type-body-sm font-semibold text-text not-disabled:hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)"
            >
              {t.reset}
            </button>
          </footer>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
