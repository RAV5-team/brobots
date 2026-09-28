import { clsx } from 'clsx'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface TabItem<T extends string> {
  readonly value: T
  readonly label: string
  readonly disabled?: boolean
}

interface TabsProps<T extends string> {
  /** Общий префикс id вкладок и панели (`useId()`): связывает `Tabs` и `TabPanel`, которые могут жить в разных местах окна. */
  readonly id: string
  /** Доступное имя списка вкладок: «Разделы решения». */
  readonly label: string
  readonly items: readonly TabItem<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
  /** Для витрины: состояние первой невыбранной вкладки. */
  readonly 'data-demo-state'?: string | undefined
}

const tabId = (id: string, value: string) => `${id}-tab-${value}`
const panelId = (id: string, value: string) => `${id}-panel-${value}`

/** Следующая доступная вкладка по клавише или undefined, если клавиша не наша. */
function nextIndex<T extends string>(key: string, items: readonly TabItem<T>[], current: number): number | undefined {
  const enabled = items.flatMap((item, index) => (item.disabled ? [] : [index]))
  if (enabled.length === 0) return undefined
  const position = enabled.indexOf(current)
  if (key === 'Home') return enabled[0]
  if (key === 'End') return enabled.at(-1)
  if (key === 'ArrowRight') return enabled[(position + 1) % enabled.length]
  if (key === 'ArrowLeft') return enabled[(position - 1 + enabled.length) % enabled.length]
  return undefined
}

/**
 * Вкладки с подчёркиванием внутри окна (components.md: Tabs; 2.1а «Обзор · Технические · …», 16666:10).
 * WAI-ARIA tabs с автоматической активацией: Tab — в выбранную вкладку, ←/→ — соседняя (по кругу), Home / End — крайние;
 * недоступные пропускаются. Панель — `TabPanel` с тем же `id`. Адреса у вкладок нет — для разделов страницы есть `TabNav`.
 */
export function Tabs<T extends string>({ id, label, items, value, onChange, ...demo }: TabsProps<T>) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const demoTarget = items.find((item) => item.value !== value && !item.disabled)?.value

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = nextIndex(event.key, items, items.findIndex((item) => item.value === value))
    if (index === undefined) return
    const item = items[index]
    if (item === undefined) return
    event.preventDefault()
    onChange(item.value)
    refs.current.get(item.value)?.focus()
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={handleKeyDown} className="flex gap-20 border-b border-border">
      {items.map((item) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(node) => { if (node) refs.current.set(item.value, node); else refs.current.delete(item.value) }}
            type="button"
            role="tab"
            id={tabId(id, item.value)}
            aria-selected={selected}
            aria-controls={selected ? panelId(id, item.value) : undefined}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => { onChange(item.value) }}
            data-demo-state={item.value === demoTarget ? demo['data-demo-state'] : undefined}
            className={clsx(
              '-mb-px flex h-36 items-center border-b-2 type-body font-medium whitespace-nowrap transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)',
              selected
                ? 'border-text text-text'
                : 'border-transparent text-text-secondary not-disabled:hover:border-border-strong not-disabled:hover:text-text',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

interface TabPanelProps {
  /** Тот же `id`, что у `Tabs`. */
  readonly tabsId: string
  /** Значение выбранной вкладки — панель показывает её содержимое. */
  readonly value: string
  readonly className?: string
  readonly children: ReactNode
}

/** Панель выбранной вкладки: `role="tabpanel"`, подписана вкладкой, в порядке Tab (содержимое может не иметь фокусируемых). */
export function TabPanel({ tabsId, value, className, children }: TabPanelProps) {
  return (
    <div role="tabpanel" id={panelId(tabsId, value)} aria-labelledby={tabId(tabsId, value)} tabIndex={0} className={className}>
      {children}
    </div>
  )
}
