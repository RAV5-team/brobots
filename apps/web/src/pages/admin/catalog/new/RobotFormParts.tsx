import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { NumberField } from '@/components/ui/NumberField'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ru } from '@/shared/i18n/ru'
import type { RobotForm, RobotFormErrors } from './robotForm'

const t = ru.robotNew

/** Общие пропсы секций: форма, ошибки проверки и обновление части полей. */
export interface RobotSectionProps {
  readonly form: RobotForm
  readonly errors: RobotFormErrors
  readonly update: (patch: Partial<RobotForm>) => void
}

interface RobotFormSectionProps {
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly children: ReactNode
}

/** Секция карточки: выпуклая панель, отступ 28, зазор 16 (15966:6003). */
export function RobotFormSection({ id, title, description, children }: RobotFormSectionProps) {
  const headingId = `${id}-heading`
  return (
    <Card id={id} padding={28} gap={16} aria-labelledby={headingId}>
      <SectionHeader id={headingId} title={title} description={description} />
      {children}
    </Card>
  )
}

interface RobotFieldGridProps {
  /** Ряды одной высоты с местом под подсказку, даже если её нет: секция 1 (15966:6006, поля по 92). */
  readonly evenRows?: boolean
  readonly children: ReactNode
}

/** Две колонки полей: 18 по вертикали, 16 между колонками (15966:6006). */
export function RobotFieldGrid({ evenRows = false, children }: RobotFieldGridProps) {
  return (
    <div className={clsx('grid grid-cols-2 items-start gap-x-16 gap-y-18', evenRows && 'auto-rows-[minmax(var(--rav-field-hinted-height),auto)]')}>
      {children}
    </div>
  )
}

type TextKey = 'name' | 'manufacturer' | 'trl' | 'price' | 'sourceText'

interface TextFieldProps extends RobotSectionProps {
  readonly name: TextKey
  readonly required?: boolean
  readonly inputMode?: 'text' | 'numeric' | 'decimal'
}

/** Текстовое поле секций 1 и 4: подпись, пример в плейсхолдере, подсказка или ошибка. */
export function RobotTextField({ name, form, errors, update, required = false, inputMode = 'text' }: TextFieldProps) {
  const copy = t.fields[name]
  return (
    <Field label={copy.label} required={required} hint={'hint' in copy ? copy.hint : undefined} error={errors[name]}>
      <Input
        inputMode={inputMode}
        autoComplete="off"
        placeholder={copy.placeholder}
        suffix={'unit' in copy ? copy.unit : undefined}
        value={form[name]}
        onChange={(e) => { update({ [name]: e.target.value }) }}
      />
    </Field>
  )
}

export type SpecKey = 'payloadKg' | 'maxSpeedMps' | 'autonomyH' | 'chargeTimeMin' | 'dimensions' | 'minTempC' | 'avgPowerKw' | 'loadUnload'

interface SpecFieldProps extends RobotSectionProps {
  readonly name: SpecKey
  /** Плашка «точное значение» у подписи (15966:6095). */
  readonly exact?: boolean
}

/** Технический параметр: единица справа, необязательный — ориентировочное значение войдёт как допущение. */
export function RobotSpecField({ name, form, errors, update, exact = false }: SpecFieldProps) {
  const copy = t.fields[name]
  const isList = name === 'dimensions' || name === 'loadUnload'
  return (
    <NumberField
      label={copy.label}
      error={errors[name]}
      badge={exact ? <Badge kind="exact" variant="pill" /> : <BadgeSpacer />}
      inputMode={isList ? 'text' : 'decimal'}
      placeholder={copy.placeholder}
      unit={copy.unit}
      value={form[name]}
      onChange={(text) => { update({ [name]: text }) }}
    />
  )
}

/** Подписи секции 3 — 24 px и без плашки (15966:6101): поля в строке стоят на одном уровне. */
function BadgeSpacer() {
  return <span aria-hidden className="h-24" />
}
