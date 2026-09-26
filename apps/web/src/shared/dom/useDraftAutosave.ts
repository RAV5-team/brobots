import { useEffect, useRef, useState } from 'react'

/** Пауза после последней правки перед записью черновика. */
const SAVE_DELAY_MS = 600

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    // Приватный режим или переполненное хранилище: форма работает, просто без черновика.
    console.warn('Черновик не сохранён в браузере', error)
    return false
  }
}

/** Прочитать черновик; битый или чужой формы — null. */
export function readDraft<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn('Не удалось удалить черновик', error)
  }
}

/**
 * Автосохранение черновика формы в браузере (D-21): пишет после паузы в правках,
 * возвращает время последней записи для плашки «Черновик сохранён · 14:41». `enabled: false` — гость, без сохранения.
 */
export function useDraftAutosave(key: string, value: unknown, enabled: boolean): Date | null {
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (!enabled) return
    // Открытие формы уже создаёт черновик — плашка видна сразу, как в макете.
    const delay = first.current ? 0 : SAVE_DELAY_MS
    first.current = false
    const timer = setTimeout(() => {
      if (write(key, value)) setSavedAt(new Date())
    }, delay)
    return () => { clearTimeout(timer) }
  }, [key, value, enabled])

  return savedAt
}
