import { Field } from '@/components/ui/Field'
import { FieldGrid, FormSection } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/Input'
import { NumberField } from '@/components/ui/NumberField'
import { Select } from '@/components/ui/Select'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import {
  SITE_PROFILE_FIELDS,
  SITE_PROFILE_GROUPS,
  siteFieldId,
  siteFieldLabel,
  type SiteFieldDef,
  type SiteValues,
} from './siteProfileFields'

const t = ru.location.params.site
const EMPTY = '__empty'

interface SiteSectionProps {
  readonly values: SiteValues
  readonly errors: Readonly<Record<string, string>>
  readonly onChange: (code: string, value: string) => void
}

function hintOf(field: SiteFieldDef): string | undefined {
  if (field.kind !== 'number' || field.min === undefined || field.max === undefined) return undefined
  return `Допустимо ${formatNumber(field.min, 3)}–${formatNumber(field.max, 3)}`
}

function SiteField({ field, values, errors, onChange }: SiteSectionProps & { readonly field: SiteFieldDef }) {
  const id = siteFieldId(field.code)
  const value = values[field.code] ?? ''
  const error = errors[field.code]
  const label = siteFieldLabel(field.code)
  if (field.kind === 'number') {
    return (
      <NumberField
        id={id}
        label={label}
        unit={field.unit}
        hint={hintOf(field)}
        error={error}
        value={value}
        onChange={(text) => { onChange(field.code, text) }}
      />
    )
  }
  if (field.kind === 'select' && field.options) {
    const listed = field.options.includes(value) || value === '' ? field.options : [value, ...field.options]
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

/** Группы подбора 17а отдельными секциями (PRD 10.3, 10.5). */
export function SiteSection(props: SiteSectionProps) {
  return (
    <>
      {SITE_PROFILE_GROUPS.map((group) => (
        <FormSection
          key={group}
          id={group}
          title={t.sectionTitles[group]}
          description={group === 'aisles' ? t.description : undefined}
        >
          <FieldGrid>
            {SITE_PROFILE_FIELDS.filter((field) => field.group === group).map((field) => (
              <SiteField key={field.code} field={field} {...props} />
            ))}
          </FieldGrid>
        </FormSection>
      ))}
    </>
  )
}
