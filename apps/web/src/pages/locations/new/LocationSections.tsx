import type { FacilityParameter } from '@/domain'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { FieldGrid, FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/Input'
import { NumberField } from '@/components/ui/NumberField'
import { Select } from '@/components/ui/Select'
import { Segmented } from '@/components/ui/Segmented'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { FormErrors } from './locationCheck'
import { siteFieldKind } from '../params/siteProfileFields'
import {
  FACILITY_CHOICES,
  NUMERIC_SPECS,
  extraSections,
  fieldDomId,
  isTurnoverAssumed,
  numericRange,
  type ExtraSection,
  type FacilityChoice,
  type LocationForm,
  type NumericKey,
  type NumericValues,
  type ParameterIndex,
  type TextKey,
} from './locationForm'

const t = ru.locationNew

/** Общие пропсы секций: форма, ошибки, обновление части полей и параметры склада. */
export interface LocationSectionProps {
  readonly form: LocationForm
  readonly errors: FormErrors
  readonly update: (patch: Partial<LocationForm>) => void
  readonly params: ParameterIndex
}

const rangeText = (key: NumericKey, params: ParameterIndex): string => {
  const range = numericRange(key, params)
  return range ? `${formatNumber(range.min, 3)}–${formatNumber(range.max, 3)}` : ''
}

/** Числовое поле профиля: звёздочка, единица справа, подсказка с диапазоном датасета или ошибка. */
export function LocationNumberField({ name, form, errors, update, params }: LocationSectionProps & { readonly name: NumericKey }) {
  const copy = t.fields[name]
  const assumed = name === 'turnover' && isTurnoverAssumed(form)
  return (
    <NumberField
      id={fieldDomId(name)}
      label={copy.label}
      required={NUMERIC_SPECS[name].required}
      hint={'hint' in copy ? copy.hint(rangeText(name, params)) : undefined}
      error={errors[name]}
      badge={assumed && <Badge kind="assumption" />}
      unit={copy.unit}
      value={form[name]}
      onChange={(text) => {
        const patch: Partial<NumericValues> = { [name]: text }
        update(patch)
      }}
    />
  )
}

function TextField({ name, form, errors, update, required = false }: Omit<LocationSectionProps, 'params'> & { readonly name: TextKey; readonly required?: boolean }) {
  const copy = t.text[name]
  return (
    <Field id={fieldDomId(name)} label={copy.label} required={required} hint={'hint' in copy ? copy.hint : undefined} error={errors[name]}>
      <Input autoComplete="off" value={form[name]} onChange={(e) => { update({ [name]: e.target.value }) }} />
    </Field>
  )
}

const TYPE_OPTIONS = FACILITY_CHOICES.map((value) => ({ value, label: t.facilityType.options[value] }))

/** Секция 1 «Основное» (15950:1975): тип объекта во всю ширину, название и город, адрес во всю ширину. */
export function BasicsSection({ typeLockedHint, ...props }: LocationSectionProps & {
  /** Тип сохранённой локации не меняется (17а): переключатель недоступен, подсказка объясняет почему. */
  readonly typeLockedHint?: string
}) {
  const { form, update } = props
  return (
    <FormSection id="basics" title={t.sections.basics.title} description={t.sections.basics.description}>
      <FieldGrid>
        <div className="col-span-2 flex flex-col gap-8">
          <p aria-hidden className="type-caption font-medium text-text-secondary">
            {t.facilityType.label}
            <span aria-hidden> *</span>
          </p>
          <Segmented<FacilityChoice>
            label={t.facilityType.label}
            options={TYPE_OPTIONS}
            value={form.facilityType}
            onChange={(facilityType) => { update({ facilityType }) }}
            disabled={typeLockedHint !== undefined}
          />
          <p className="type-caption text-text-muted">{typeLockedHint ?? t.facilityType.hint}</p>
        </div>
        <TextField name="name" required {...props} />
        <TextField name="city" required {...props} />
        <div className="col-span-2">
          <TextField name="address" {...props} />
        </div>
      </FieldGrid>
    </FormSection>
  )
}

/** Секция 2 «Площадь и этажность» (15950:2010). На 17а подсказка своя: у формы 14 она отсылает к самой вкладке (PRD 15 · №46). */
export function AreaSection({ description = t.sections.area.description, ...props }: LocationSectionProps & { readonly description?: string }) {
  return (
    <FormSection id="area" title={t.sections.area.title} description={description}>
      <FieldGrid>
        <LocationNumberField name="totalArea" {...props} />
        <LocationNumberField name="activeArea" {...props} />
        <LocationNumberField name="floors" {...props} />
      </FieldGrid>
    </FormSection>
  )
}

/** Секция 3 «Режим работы» (15950:2037) — без описания. */
export function ScheduleSection(props: LocationSectionProps) {
  return (
    <FormSection id="schedule" title={t.sections.schedule.title}>
      <FieldGrid>
        <LocationNumberField name="shifts" {...props} />
        <LocationNumberField name="workingDays" {...props} />
        <LocationNumberField name="shiftHours" {...props} />
        <LocationNumberField name="peakFactor" {...props} />
      </FieldGrid>
    </FormSection>
  )
}

/**
 * Вместо секций 2–4 у аэропорта, медучреждения и своего объекта: их форм в макетах нет (PRD 10.2 [Предложение], D-36).
 * Утопленная плашка, как «Уточнения и проверки» 06.
 */
const EMPTY = '__empty'

function ExtraField({ field, form, errors, update }: LocationSectionProps & { readonly field: FacilityParameter }) {
  const id = fieldDomId(field.code)
  const value = form.extras[field.code] ?? ''
  const error = errors[field.code]
  const onChange = (text: string) => { update({ extras: { ...form.extras, [field.code]: text } }) }
  const kind = siteFieldKind(field)
  if (kind === 'number') {
    const hint = field.min !== null && field.max !== null
      ? ru.locationNew.fields.extraHint(`${formatNumber(field.min, 3)}–${formatNumber(field.max, 3)}`)
      : undefined
    return (
      <NumberField id={id} label={field.name} unit={field.unit || undefined} hint={hint} error={error} value={value} onChange={onChange} />
    )
  }
  if (kind === 'select' && field.enumValues) {
    const listed = field.enumValues.includes(value) || value === '' ? field.enumValues : [value, ...field.enumValues]
    const options = [{ value: EMPTY, label: ru.location.params.site.noData }, ...listed.map((item) => ({ value: item, label: item }))]
    return (
      <Field id={id} label={field.name} error={error}>
        <Select
          aria-label={field.name}
          options={options}
          value={value === '' ? EMPTY : value}
          onChange={(next) => { onChange(next === EMPTY ? '' : next) }}
        />
      </Field>
    )
  }
  return (
    <Field id={id} label={field.name} error={error}>
      <Input autoComplete="off" value={value} onChange={(event) => { onChange(event.target.value) }} />
    </Field>
  )
}

/** Параметры справочника, которых нет в секциях 1–4: объёмы, хранение, проходы, пол, связь. */
export function ExtraSections(props: LocationSectionProps) {
  const sections: readonly ExtraSection[] = extraSections(props.params)
  return (
    <>
      {sections.map((section, index) => (
        <FormSection key={section.id} id={section.id} title={`${String(index + 5)}. ${section.title}`}>
          <FieldGrid>
            {section.fields.map((field) => <ExtraField key={field.code} field={field} {...props} />)}
          </FieldGrid>
        </FormSection>
      ))}
    </>
  )
}

export function OtherTypeNotice({ facilityType, copy = t.otherType }: {
  readonly facilityType: Exclude<FacilityChoice, 'warehouse'>
  /** Тексты плашки: у формы 14 — «заведите склад», у сохранённой локации (17а) — что можно изменить. */
  readonly copy?: { readonly title: (type: string) => string; readonly description: string }
}) {
  return (
    <Card variant="sunken" padding={28} gap={8} role="status">
      <h2 className="type-heading text-text">{copy.title(t.facilityType.options[facilityType])}</h2>
      <p className="type-caption text-text-secondary">{copy.description}</p>
    </Card>
  )
}
