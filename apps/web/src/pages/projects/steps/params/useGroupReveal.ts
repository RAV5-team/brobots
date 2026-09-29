import { useCallback, useState } from 'react'

/** Ключи групп в `useGroupReveal`: процесс и площадка — в одном наборе, поэтому с префиксом. */
export const processGroupKey = (key: string): string => `process:${key}`
export const siteGroupKey = (key: string): string => `site:${key}`

/**
 * Состояние навигации «всё раскрыто» (1.1, 16992:10): сценарий /dev/screens открывает шаг с раскрытыми группами.
 * Варианты процессов (1.2, 1.3; 17009:*) — локация только с применимыми параметрами, разбор нагрузки — как на фрагменте.
 */
export interface ParamsExpandedState {
  readonly paramsExpanded: true
  /** Все параметры локации, а не только применимые к процессу. */
  readonly siteAll: boolean
  /** Разбор «Как рассчитано» открыт. */
  readonly breakdown: boolean
}

export const paramsExpandedState = ({ siteAll = true, breakdown = true }: Partial<Omit<ParamsExpandedState, 'paramsExpanded'>> = {}): ParamsExpandedState =>
  ({ paramsExpanded: true, siteAll, breakdown })

export const isParamsExpandedState = (state: unknown): state is ParamsExpandedState =>
  typeof state === 'object' && state !== null && (state as Partial<ParamsExpandedState>).paramsExpanded === true

export interface GroupReveal {
  readonly isOpen: (key: string) => boolean
  readonly setOpen: (key: string, open: boolean) => void
  /** Раскрыть или свернуть сразу несколько групп: «Все параметры процесса». */
  readonly setMany: (keys: readonly string[], open: boolean) => void
  /** Раскрыть группу и прокрутить к строке: цель «↓» из поповера статуса процесса. */
  readonly reveal: (groupKey: string, anchor: string) => void
}

/** Какие группы отличаются от исходного вида: при `allOpen` — свёрнутые, иначе — раскрытые. */
interface OpenState {
  readonly allOpen: boolean
  readonly toggled: ReadonlySet<string>
}

/**
 * Раскрытые группы шага 1 (доска 16325, 16969:10): по умолчанию все свёрнуты (правило cap 1.1), в «всё раскрыто» (16992:10) — все открыты.
 * Ключи групп известны только после загрузки снимка, поэтому хранится исходный вид и отличия от него.
 * Строка незаполненного значения лежит в свёрнутой группе, поэтому «↓» сначала раскрывает её, а прокручивает — после отрисовки.
 */
export function useGroupReveal(initiallyOpen = false): GroupReveal {
  const [state, setState] = useState<OpenState>(() => ({ allOpen: initiallyOpen, toggled: new Set() }))

  const setMany = useCallback((keys: readonly string[], next: boolean) => {
    setState((prev) => {
      const toggled = new Set(prev.toggled)
      // Отличие от исходного вида: раскрыть при allOpen — убрать из свёрнутых, иначе — добавить в раскрытые.
      keys.forEach((key) => { if (next !== prev.allOpen) toggled.add(key); else toggled.delete(key) })
      return { allOpen: prev.allOpen, toggled }
    })
  }, [])

  const setOpen = useCallback((key: string, next: boolean) => { setMany([key], next) }, [setMany])

  const reveal = useCallback((groupKey: string, anchor: string) => {
    setMany([groupKey], true)
    // Кадр — чтобы группа успела раскрыться; таймер — после того, как закрытый поповер вернёт фокус на свою кнопку.
    requestAnimationFrame(() => {
      setTimeout(() => {
        const target = document.getElementById(anchor)
        target?.scrollIntoView({ block: 'center' })
        target?.focus({ preventScroll: true })
      }, 0)
    })
  }, [setMany])

  const isOpen = useCallback((key: string) => state.toggled.has(key) !== state.allOpen, [state])

  return { isOpen, setOpen, setMany, reveal }
}
