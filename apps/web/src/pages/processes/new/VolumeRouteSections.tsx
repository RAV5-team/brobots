import { Field } from '@/components/ui/Field'
import { FormulaStats } from '@/components/ui/FormulaStats'
import { Segmented } from '@/components/ui/Segmented'
import { ru } from '@/shared/i18n/ru'
import { FieldGrid, FormSection } from '@/components/ui/FormSection'
import { NumberField, type SectionProps } from './FormParts'
import { volumeStats } from './processStats'

const t = ru.processNew
const INDOOR_OPTIONS = [
  { value: 'yes', label: t.indoorOptions.yes },
  { value: 'no', label: t.indoorOptions.no },
] as const

/** Секция 2 «Объём и пик» (PRD 9.2; 15935:1008). */
export function VolumeSection(props: SectionProps) {
  const s = t.sections.volume
  return (
    <FormSection id="volume" title={s.title} description={s.description}>
      <FieldGrid>
        <NumberField name="dailyVolume" {...props} />
        <NumberField name="workHours" {...props} />
        <NumberField name="peakFactor" {...props} />
        <NumberField name="automationPct" {...props} />
      </FieldGrid>
      <FormulaStats label={t.volumeStats.label} stats={volumeStats(props.form)} />
    </FormSection>
  )
}

/** Секция 3 «Маршрут и среда» (PRD 9.2; 15935:1060). */
export function RouteSection(props: SectionProps) {
  const s = t.sections.route
  const f = t.fields.indoor
  return (
    <FormSection id="route" title={s.title} description={s.description}>
      <FieldGrid>
        <NumberField name="routeLengthM" {...props} />
        <NumberField name="speedLimitMps" {...props} />
        <NumberField name="widthMarginM" {...props} />
        <NumberField name="liftTripPct" {...props} />
        <NumberField name="liftWaitS" {...props} />
        <Field label={f.label} hint={f.hint}>
          <Segmented
            label={f.label}
            size={44}
            options={INDOOR_OPTIONS}
            value={props.form.indoor ? 'yes' : 'no'}
            onChange={(v) => { props.update({ indoor: v === 'yes' }) }}
          />
        </Field>
        <NumberField name="minAisleWidthM" {...props} />
        <NumberField name="minTempC" {...props} />
      </FieldGrid>
    </FormSection>
  )
}

/** Секция 5 «Эксплуатация и объектные затраты» (PRD 9.2; 15935:1203). */
export function CostsSection(props: SectionProps) {
  const s = t.sections.costs
  return (
    <FormSection id="costs" title={s.title} description={s.description}>
      <FieldGrid>
        <NumberField name="fleetOperators" {...props} />
        <NumberField name="fleetSalaryRub" {...props} />
        <NumberField name="sitePrepPct" {...props} />
        <NumberField name="itIntegrationRub" {...props} />
        <NumberField name="consumablesRub" {...props} />
        <NumberField name="otherEffectsRub" {...props} />
      </FieldGrid>
    </FormSection>
  )
}
