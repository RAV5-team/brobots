import type { ReactNode } from 'react'

/**
 * Вложенная плашка тёмной карточки с заголовком-надстрочником (components.md: Well): «Где тоньше всего»,
 * «Что проверить на пилоте» вердикта 07 (16197:1889), «Вывод» и «Следующий шаг» итога 08.
 * Секция без собственного заголовка в дереве документа — имя берёт из `title`.
 */
export function Well({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-lg bg-inverse-well px-16 py-16">
      <h3 className="type-overline text-text-disabled">{title}</h3>
      {children}
    </section>
  )
}
