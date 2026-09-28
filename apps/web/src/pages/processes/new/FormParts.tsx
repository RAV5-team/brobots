import { Badge } from '@/components/ui/Badge'
import { NumberField } from '@/components/ui/NumberField'
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

interface ProcessNumberFieldProps extends Pick<SectionProps, 'form' | 'errors' | 'update' | 'hints'> {
  readonly name: NumericKey
}

/** Числовое поле процесса: подпись со звёздочкой и плашкой происхождения, единица справа, подсказка или ошибка. */
export function ProcessNumberField({ name, form, errors, update, hints }: ProcessNumberFieldProps) {
  const spec = NUMERIC_SPECS[name]
  const copy = t.fields[name]
  const hint = hints[name] ?? ('hint' in copy ? copy.hint : undefined)
  return (
    <NumberField
      label={copy.label}
      required={spec.required === true}
      hint={hint}
      error={errors[name]}
      badge={spec.badge && <Badge kind={spec.badge} />}
      unit={copy.unit}
      value={form[name]}
      onChange={(text) => {
        const patch: Partial<NumericValues> = { [name]: text }
        update(patch)
      }}
    />
  )
}
