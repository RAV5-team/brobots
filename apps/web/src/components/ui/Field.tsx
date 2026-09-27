import { clsx } from 'clsx'
import { useId, type ReactNode } from 'react'
import { FieldContext } from './fieldContext'

interface FieldProps {
  readonly label: string
  readonly required?: boolean
  /** Подсказка: единицы, пример значения (ТЗ 4.5.3). */
  readonly hint?: string | undefined
  /** Текст ошибки со способом исправления (ТЗ 4.5.4); заменяет подсказку. */
  readonly error?: string | undefined
  readonly children: ReactNode
  /** overline — подпись капсом, как на экране входа 05 (15935:94). */
  readonly labelVariant?: 'default' | 'overline'
  /** Плашка происхождения значения справа от подписи: «допущение», «формула» (15935:964). */
  readonly badge?: ReactNode
}

/** Поле формы: подпись + контрол + подсказка или ошибка (components.md: Field; 15935:935, 15950:2023). */
export function Field({ label, required = false, hint, error, children, labelVariant = 'default', badge }: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint
  const invalid = error !== undefined

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-8">
        <label
          htmlFor={id}
          className={clsx('flex-1', labelVariant === 'overline' ? 'type-overline text-text-secondary' : 'type-caption font-medium text-text-secondary')}
        >
          {label}
          {required && <span aria-hidden> *</span>}
        </label>
        {badge}
      </div>
      <FieldContext value={{ id, describedBy: message ? messageId : undefined, invalid, required }}>{children}</FieldContext>
      {message && (
        <p id={messageId} className={invalid ? 'type-caption font-medium text-danger' : 'type-caption text-text-muted'}>
          {message}
        </p>
      )}
    </div>
  )
}
