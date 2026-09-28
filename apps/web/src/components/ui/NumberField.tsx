import type { ReactNode } from 'react'
import { Field } from './Field'
import { Input } from './Input'

interface NumberFieldProps {
  readonly label: string
  /** Текст в поле как есть: разбор и проверку числа делает экран. */
  readonly value: string
  readonly onChange: (text: string) => void
  /** Единица справа: «м²», «шт/ч». */
  readonly unit?: string | undefined
  readonly required?: boolean
  readonly hint?: string | undefined
  readonly error?: string | undefined
  /** Плашка происхождения значения у подписи: «допущение», «формула», «точное значение». */
  readonly badge?: ReactNode
  /** id поля — переход к нему из сводки ошибок. */
  readonly id?: string | undefined
  readonly placeholder?: string | undefined
  /** decimal — число; text — список чисел («1 200 × 800 × 350»). */
  readonly inputMode?: 'decimal' | 'text'
  /** Ошибка, которой нет в `error` (проверка нескольких полей). */
  readonly invalid?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly onBlur?: (() => void) | undefined
}

/**
 * Числовое поле формы (components.md: NumberField): подпись с плашкой, поле с единицей справа, подсказка или ошибка.
 * Поля процесса 09а, профиля 14, технических параметров А2 и условий симуляции 05.
 */
export function NumberField({
  label, value, onChange, unit, required = false, hint, error, badge, id, placeholder, inputMode = 'decimal', invalid, disabled, onBlur,
}: NumberFieldProps) {
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error} badge={badge}>
      <Input
        inputMode={inputMode}
        autoComplete="off"
        placeholder={placeholder}
        suffix={unit}
        value={value}
        {...(invalid === undefined ? {} : { invalid })}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value) }}
        onBlur={onBlur}
      />
    </Field>
  )
}
