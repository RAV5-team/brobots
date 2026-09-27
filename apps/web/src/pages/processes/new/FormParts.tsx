import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ru } from '@/shared/i18n/ru'
import { NUMERIC_SPECS, type NumericKey, type NumericValues, type ProcessForm, type SectionId } from './processForm'
import type { FormErrors } from './processCalc'

const t = ru.processNew

/** Общие пропсы секций: форма, ошибки, обновление части полей и подсказки числовых полей (часть — формулы на значениях датасета). */
export interface SectionProps {
  readonly form: ProcessForm
  readonly errors: FormErrors
  readonly update: (patch: Partial<ProcessForm>) => void
  readonly hints: Readonly<Partial<Record<NumericKey, string>>>
}

interface FormSectionProps {
  readonly id: SectionId
  readonly title: string
  readonly description: string
  readonly children: ReactNode
}

/** Секция формы: выпуклая панель 28 / 20 с заголовком (15935:1008). Цель якоря SectionNav. */
export function FormSection({ id, title, description, children }: FormSectionProps) {
  const headingId = `${id}-heading`
  return (
    <Card id={id} padding={28} gap={20} aria-labelledby={headingId} tabIndex={-1} className="scroll-mt-(--rav-form-nav-offset) outline-none">
      <SectionHeader id={headingId} title={title} description={description} />
      {children}
    </Card>
  )
}

/** Сетка полей в две колонки: 20 по вертикали, 16 между колонками (15935:1012). */
export function FieldGrid({ children }: { readonly children: ReactNode }) {
  return <div className="grid grid-cols-2 items-start gap-x-16 gap-y-20">{children}</div>
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
