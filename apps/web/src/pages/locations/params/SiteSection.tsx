import { clsx } from 'clsx'
import type { FacilityParameter } from '@/domain'
import { SITE_GROUPS, siteFields } from '@/domain'
import { CardTitle } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
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

/** Якорь секции 5 для `SectionNav`: условия площадки — одна секция с подгруппами (16785:146). */
export const SITE_SECTION_ID = 'site'

interface SiteSectionProps {
  readonly parameters: readonly FacilityParameter[]
  readonly values: SiteValues
  readonly errors: Readonly<Record<string, string>>
  readonly onChange: (code: string, value: string) => void
}

/** Подсказка под полем: у чисел — диапазон справочника, у остальных — примечание организатора (16785:165). */
function hintOf(field: FacilityParameter): string | undefined {
  if (siteFieldKind(field) === 'number' && field.min !== null && field.max !== null) {
    return t.range(formatNumber(field.min, 3), formatNumber(field.max, 3))
  }
  return field.note === '' ? undefined : field.note
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
      <Field id={id} label={label} hint={hintOf(field)} error={error}>
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
    <Field id={id} label={label} hint={hintOf(field)} error={error}>
      <Input autoComplete="off" value={value} onChange={(e) => { onChange(field.code, e.target.value) }} />
    </Field>
  )
}

/**
 * Секция 5 «Условия площадки для роботов» 17а (16785:146; PRD 10.3, 10.5): одна секция, как в макете,
 * внутри — группы подбора PRD 10.5. Состав полей — справочник типа объекта.
 */
export function SiteSection({ parameters, ...props }: SiteSectionProps) {
  const fields = siteFields(parameters)
  return (
    <FormSection id={SITE_SECTION_ID} title={t.title} description={t.description} badge={<Chip tone="muted">{t.optional}</Chip>}>
      {SITE_GROUPS.filter((group) => fields.some((field) => field.formSection === group)).map((group, index) => {
        const groupFields = fields.filter((field) => field.formSection === group)
        const headingId = `site-${group}-heading`
        // Подгруппы разделены линией, как в макете (16785:216, 16785:237).
        return (
          <section key={group} aria-labelledby={headingId} className={clsx('flex flex-col gap-16', index > 0 && 'border-t border-border pt-20')}>
            <CardTitle id={headingId}>{t.groups[group]}</CardTitle>
            <FieldGrid>
              {groupFields.map((field) => (
                <SiteField key={field.code} field={field} {...props} />
              ))}
            </FieldGrid>
          </section>
        )
      })}
    </FormSection>
  )
}
