import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardStat, CardTitle } from '@/components/ui/Card'
import { FormRail } from '@/components/ui/FormRail'
import { NumberField } from '@/components/ui/NumberField'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ShowcaseSection } from './StateGrid'

const rail = ru.processNew.rail
const fields = ru.processNew.fields

function RailSummary() {
  return (
    <Card>
      <CardTitle>{rail.title}</CardTitle>
      <dl className="flex flex-col gap-12">
        <CardStat label={rail.formulas} value={formatNumber(3)} />
        <CardStat label={rail.required} value={formatNumber(12)} />
      </dl>
      <p className="type-caption text-text-secondary">{rail.note}</p>
    </Card>
  )
}

export function FormRailShowcase() {
  const excel = { importLabel: rail.importExcel, templateLabel: rail.downloadTemplate, note: rail.excelSoon }
  return (
    <div className="flex gap-24">
      <ShowcaseSection title="submit">
        <FormRail label={rail.title} summary={<RailSummary />} submit={{ label: rail.save, disabled: false }} excel={excel} />
      </ShowcaseSection>
      <ShowcaseSection title="guest · note">
        <FormRail label={rail.title} summary={<RailSummary />} submit={{ label: rail.save, disabled: true, note: rail.guestSave }} excel={excel} />
      </ShowcaseSection>
      <ShowcaseSection title="message">
        <FormRail label={rail.title} summary={<RailSummary />} message={ru.processNew.errors.saveFailed} submit={{ label: rail.saving, disabled: true }} />
      </ShowcaseSection>
    </div>
  )
}

export function NumberFieldShowcase() {
  const [volume, setVolume] = useState('2000')
  const [aisle, setAisle] = useState('2,8')
  return (
    <div className="grid w-[640px] grid-cols-2 gap-16">
      <NumberField label={fields.dailyVolume.label} unit={fields.dailyVolume.unit} required value={volume} onChange={setVolume} />
      <NumberField label={fields.peakFactor.label} unit={fields.peakFactor.unit} hint={fields.peakFactor.hint} badge={<Badge kind="assumption" />} value="1,5" onChange={setVolume} />
      <NumberField label={fields.minAisleWidthM.label} unit={fields.minAisleWidthM.unit} error={ru.processNew.errors.required} value={aisle} onChange={setAisle} />
      <NumberField label={fields.speedLimitMps.label} unit={fields.speedLimitMps.unit} disabled value="1,5" onChange={setAisle} />
    </div>
  )
}
