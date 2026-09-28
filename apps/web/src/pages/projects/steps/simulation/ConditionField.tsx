import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { NumberField } from '@/components/ui/NumberField'
import { Select, type SelectOption } from '@/components/ui/Select'
import { parseConditionField, toFieldText, type ConditionOrigin, type NumericFieldSpec } from './conditionsModel'

interface NumberConditionProps {
  readonly spec: NumericFieldSpec
  readonly label: string
  readonly unit: string
  readonly hint: string
  readonly origin: ConditionOrigin
  /** Действующее значение, в хранимых единицах. */
  readonly value: number
  /** Ошибка, которую не проверить одним полем: смены не помещаются в сутки. */
  readonly crossError?: string | null
  readonly disabled: boolean
  readonly onCommit: (value: number) => void
  /** Поле стало неверным или снова верным — пока есть ошибки, запуск закрыт. */
  readonly onValidity: (valid: boolean) => void
}

/**
 * Числовое условие этапа 2: подпись с меткой источника, поле с единицей, подсказка или ошибка (05, 16197:1340).
 * Верное число сохраняется сразу (D-21); неверное остаётся в поле с текстом исправления и не сохраняется.
 */
export function NumberCondition({ spec, label, unit, hint, origin, value, crossError, disabled, onCommit, onValidity }: NumberConditionProps) {
  // null — поле показывает действующее значение; строка — то, что пользователь набирает.
  const [text, setText] = useState<string | null>(null)
  const parsed = text === null ? null : parseConditionField(spec, text)
  const error = parsed && !parsed.ok ? parsed.error : crossError ?? undefined

  return (
    <NumberField
      label={label}
      hint={hint || undefined}
      error={error}
      badge={<Badge kind={origin} />}
      unit={unit || undefined}
      value={text ?? toFieldText(spec, value)}
      invalid={error !== undefined}
      disabled={disabled}
      onChange={(next) => {
        const result = parseConditionField(spec, next)
        setText(next)
        onValidity(result.ok)
        if (result.ok) onCommit(result.value)
      }}
      onBlur={() => { if (parsed?.ok) setText(null) }}
    />
  )
}

interface ChoiceConditionProps<T extends string> {
  readonly label: string
  readonly hint: string
  readonly origin: ConditionOrigin
  readonly options: readonly SelectOption<T>[]
  readonly value: T
  readonly disabled: boolean
  readonly onChange: (value: T) => void
}

/** Условие-выбор этапа 2: люди в проездах, ходовые паллеты, правила вердикта (16197:1450). */
export function ChoiceCondition<T extends string>({ label, hint, origin, options, value, disabled, onChange }: ChoiceConditionProps<T>) {
  return (
    <Field label={label} hint={hint} badge={<Badge kind={origin} />}>
      <Select options={options} value={value} disabled={disabled} onChange={onChange} />
    </Field>
  )
}
