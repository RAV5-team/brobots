import type { FacilityParameter } from '@/domain'
import { SITE_GROUPS, siteFields } from '@/domain'
import { Field } from '@/components/ui/Field'
import { FieldGrid, FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/Input'
import { NumberField } from '@/components/ui/NumberField'
import { Select } from '@/components/ui/Select'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { siteFieldId, siteFieldKind, type SiteValues } from './siteProfileFields'

const t = ru.location.params.site
const EMPTY = '__empty'

interface SiteSectionProps {
  readonly parameters: readonly FacilityParameter[]
  readonly values: SiteValues
  readonly errors: Readonly<Record<string, string>>
  readonly onChange: (code: string, value: string) => void
}

function hintOf(field: FacilityParameter): string | undefined {
  if (siteFieldKind(field) !== 'number' || field.min === null || field.max === null) return undefined
  return `Допустимо ${formatNumber(field.min, 3)}–${formatNumber(field.max, 3)}`
}

function SiteField({ field, values, errors, onChange }: Omit<SiteSectionProps, 'parameters'> & { readonly field: FacilityParameter }) {
  const id = siteFieldId(field.code)
  const value = values[field.code] ?? ''
  const error = errors[field.code]
  const label = field.name
  const kind = siteFieldKind(field)
  if (kind === 'number') {
    return (
      <NumberField
        id={id}
        label={label}
        unit={field.unit || undefined}
        hint={hintOf(field)}
        error={error}
        value={value}
        onChange={(text) => { onChange(field.code, text) }}
      />
    )
  }
  if (kind === 'select' && field.enumValues) {
    const listed = field.enumValues.includes(value) || value === '' ? field.enumValues : [value, ...field.enumValues]
    const options = [{ value: EMPTY, label: t.noData }, ...listed.map((item) => ({ value: item, label: item }))]
    return (
      <Field id={id} label={label} hint={t.noData} error={error}>
        <Select
          aria-label={label}
          options={options}
          value={value === '' ? EMPTY : value}
          onChange={(next) => { onChange(field.code, next === EMPTY ? '' : next) }}
        />
      </Field>
    )
  }
  return (
    <Field id={id} label={label} error={error}>
      <Input autoComplete="off" value={value} onChange={(e) => { onChange(field.code, e.target.value) }} />
    </Field>
  )
}

/** Группы подбора 17а отдельными секциями (PRD 10.3, 10.5). Состав — справочник типа объекта. */
export function SiteSection({ parameters, ...props }: SiteSectionProps) {
  const fields = siteFields(parameters)
  return (
    <>
      {SITE_GROUPS.map((group) => (
        <FormSection
          key={group}
          id={group}
          title={t.sectionTitles[group]}
          description={group === 'aisles' ? t.description : undefined}
        >
          <FieldGrid>
            {fields.filter((field) => field.formSection === group).map((field) => (
              <SiteField key={field.code} field={field} {...props} />
            ))}
          </FieldGrid>
        </FormSection>
      ))}
    </>
  )
}
