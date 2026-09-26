import { useCallback, useEffect, useState } from 'react'

/** Секция считается текущей, когда её верх проходит верхнюю треть окна. */
const ROOT_MARGIN = '0px 0px -66% 0px'
const ACTIVE_LINE = 0.34

// matchMedia и scrollIntoView есть не во всех окружениях (jsdom) — без них просто прыгаем к секции.
const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Текущая секция длинной формы для SectionNav: IntersectionObserver вместо обработчика прокрутки.
 * `select` прокручивает к секции (плавно, если пользователь не просил меньше движения) и сразу подсвечивает пункт.
 */
export function useActiveSection(ids: readonly string[]): { readonly activeId: string; readonly select: (id: string) => void } {
  const [activeId, setActiveId] = useState(ids[0] ?? '')
  const key = ids.join('|')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const elements = key.split('|').flatMap((id) => {
      const el = document.getElementById(id)
      return el ? [el] : []
    })
    // Текущая — последняя секция, чей верх уже прошёл верхнюю треть окна; считаем по всем секциям,
    // а не по изменившимся записям: при быстрой прокрутке записи приходят не по каждой секции.
    const pick = () => {
      const line = window.innerHeight * ACTIVE_LINE
      const passed = elements.filter((el) => el.getBoundingClientRect().top <= line)
      const current = passed.at(-1) ?? elements[0]
      if (current) setActiveId(current.id)
    }
    const observer = new IntersectionObserver(pick, { rootMargin: ROOT_MARGIN, threshold: [0, 1] })
    elements.forEach((el) => { observer.observe(el) })
    return () => { observer.disconnect() }
  }, [key])

  const select = useCallback((id: string) => {
    setActiveId(id)
    const el = document.getElementById(id)
    if (!el) return
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    el.focus({ preventScroll: true })
  }, [])

  return { activeId, select }
}
