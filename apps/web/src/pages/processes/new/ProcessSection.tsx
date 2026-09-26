import { ChipToggle } from '@/components/ui/Chip'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Segmented } from '@/components/ui/Segmented'
import { Select, type SelectOption } from '@/components/ui/Select'
import type { HandlingMethod } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { FieldGrid, FormSection, NumberField, type SectionProps } from './FormParts'
import { toggleHandling } from './processForm'

const t = ru.processNew
const DIVISIBLE_OPTIONS = [
  { value: 'no', label: t.divisible.no },
  { value: 'yes', label: t.divisible.yes },
] as const

interface ProcessSectionProps extends SectionProps {
  readonly classOptions: readonly SelectOption<string>[]
  readonly categoryOptions: readonly SelectOption<string>[]
  readonly carrierOptions: readonly SelectOption<string>[]
  readonly handlingMethods: readonly HandlingMethod[]
}

/** Секция 1 «Процесс и груз» (PRD 9.2; 15935:930). */
export function ProcessSection({ classOptions, categoryOptions, carrierOptions, handlingMethods, ...props }: ProcessSectionProps) {
  const { form, errors, update } = props
  const f = t.fields
  const s = t.sections.process
  return (
    <FormSection id="process" title={s.title} description={s.description}>
      <FieldGrid>
        <Field label={f.operationClass.label} required hint={f.operationClass.hint}>
          <Select options={classOptions} value={form.operationClass} onChange={(v) => { update({ operationClass: v as typeof form.operationClass }) }} />
        </Field>
        <Field label={f.name.label} required hint={f.name.hint} error={errors.name}>
          <Input value={form.name} autoComplete="off" onChange={(e) => { update({ name: e.target.value }) }} />
        </Field>
        <Field label={f.category.label} hint={f.category.hint} error={errors.category}>
          <Select options={categoryOptions} value={form.category} onChange={(v) => { update({ category: v }) }} />
        </Field>
        <Field label={f.carrier.label} required error={errors.carrier}>
          <Select options={carrierOptions} value={form.carrier} onChange={(v) => { update({ carrier: v }) }} />
        </Field>
        <NumberField name="unitMassKg" {...props} />
        <Field label={f.cargoDivisible.label} required hint={f.cargoDivisible.hint}>
          <Segmented
            label={f.cargoDivisible.label}
            size={44}
            options={DIVISIBLE_OPTIONS}
            value={form.cargoDivisible ? 'yes' : 'no'}
            onChange={(v) => { update({ cargoDivisible: v === 'yes' }) }}
          />
        </Field>
        <div className="col-span-2">
          <Field label={f.route.label} hint={f.route.hint}>
            <Input value={form.route} autoComplete="off" onChange={(e) => { update({ route: e.target.value }) }} />
          </Field>
        </div>
        <fieldset className="col-span-2 flex flex-col gap-8" aria-describedby="handling-message">
          <legend className="mb-8 type-caption font-medium text-text-secondary">
            {f.handling.label}
            <span aria-hidden> *</span>
          </legend>
          <div className="flex flex-wrap gap-8">
            {handlingMethods.map((method) => (
              <ChipToggle
                key={method.code}
                pressed={form.handling.includes(method.code)}
                onPressedChange={() => { update({ handling: toggleHandling(form, method.code).handling }) }}
                description={method.hint}
              >
                {method.name}
              </ChipToggle>
            ))}
          </div>
          <p id="handling-message" className={errors.handling ? 'type-caption font-medium text-danger' : 'type-caption text-text-muted'}>
            {errors.handling ?? f.handling.hint}
          </p>
        </fieldset>
      </FieldGrid>
    </FormSection>
  )
}
