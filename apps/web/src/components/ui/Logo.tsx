import { clsx } from 'clsx'
import { ru } from '@/shared/i18n/ru'

const LETTERS = ['R', '5'] as const

/** Логотип «R5»: два перекрывающихся круга с буквами (15935:24; tokens.md — не токен текста). */
export function Logo() {
  return (
    <span role="img" aria-label={ru.app.name} className="inline-flex items-center">
      {LETTERS.map((letter, index) => (
        <span
          key={letter}
          aria-hidden
          className={clsx(
            'flex size-36 items-center justify-center rounded-full border-(length:--rav-border-width-logo) border-text type-logo text-text-secondary',
            index === 0 && '-mr-6',
          )}
        >
          {letter}
        </span>
      ))}
    </span>
  )
}
