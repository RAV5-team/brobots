import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { ru } from '@/shared/i18n/ru'
import { NUMERIC_SPECS, type NumericKey, type NumericValues, type ProcessForm } from './processForm'
import type { FormErrors } from './processCalc'

const t = ru.processNew

/** Общие пропсы секций: форма, ошибки, обновление части полей и подсказки числовых полей (часть — формулы на значениях датасета). */
export interface SectionProps {
  readonly form: ProcessForm
  readonly errors: FormErrors
  readonly update: (patch: Partial<ProcessForm>) => void
  readonly hints: Readonly<Partial<Record<NumericKey, string>>>
}

interface NumberFieldProps extends Pick<SectionProps, 'form' | 'errors' | 'update' | 'hints'> {
  readonly name: NumericKey
}

/** Числовое поле: подпись со звёздочкой и плашкой происхождения, единица справа, подсказка или ошибка. */
export function NumberField({ name, form, errors, update, hints }: NumberFieldProps) {
  const spec = NUMERIC_SPECS[name]
  const copy = t.fields[name]
  const hint = hints[name] ?? ('hint' in copy ? copy.hint : undefined)
  return (
    <Field
      label={copy.label}
      required={spec.required === true}
      hint={hint}
      error={errors[name]}
      badge={spec.badge && <Badge kind={spec.badge} />}
    >
      <Input
        inputMode="decimal"
        autoComplete="off"
        suffix={copy.unit}
        value={form[name]}
        onChange={(e) => {
          const patch: Partial<NumericValues> = { [name]: e.target.value }
          update(patch)
        }}
      />
    </Field>
  )
}
