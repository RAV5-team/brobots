import { useState } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field } from '@/components/ui/Field'
import { Chip } from '@/components/ui/Chip'
import { RadioGroup } from '@/components/ui/RadioGroup'
import { LOCATION_PROCESSES } from '@/mocks/fixtures/locationProcesses'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { FACILITY_TYPES } from '@/mocks/fixtures/facilityParameters'
import { HANDLING_METHODS, OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { ru } from '@/shared/i18n/ru'
import { stateProps, type DemoState } from './demoState'
import { ShowcaseSection, StateGrid } from './StateGrid'

const s = ru.dev.samples
const STATES: readonly DemoState[] = ['default', 'hover', 'focus', 'disabled']
const pp = ru.project.params
// Процессы РЦ Химки — карточки выбора процесса шага 1 (16197:368); у инвентаризации подбор заблокирован (PRD 11.2).
const PROCESS_CARDS = LOCATION_PROCESSES.filter((lp) => lp.locationId === 'LOC-01').map((lp) => {
  const blocked = lp.id === 'LP-05'
  return {
    value: lp.id,
    label: lp.name ?? PROCESSES.find((pr) => pr.code === lp.processCode)?.name ?? lp.id,
    description: <Chip tone={blocked ? 'unconfirmed' : 'ready'} size="xs">{blocked ? pp.missingValues(2) : pp.readyToMatch}</Chip>,
    disabled: blocked,
  }
})
const CLASS_OPTIONS = OPERATION_CLASSES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}`, description: c.description }))
const FACILITY_OPTIONS = FACILITY_TYPES.map((f) => ({ value: f.code, label: f.name }))
const HANDLING_OPTIONS = HANDLING_METHODS.slice(0, 3).map((h) => ({ value: h.code, label: h.name }))
const YES_NO = [{ value: 'no', label: s.no }, { value: 'yes', label: s.yes }] as const

const LOCATOR_KINDS = [{ value: 'file', label: ru.dataSources.create.locatorKinds.file }, { value: 'url', label: ru.dataSources.create.locatorKinds.url, disabled: true }] as const

function DemoSegmented({ size, state }: { size: 40 | 44; state: DemoState }) {
  const [value, setValue] = useState<'no' | 'yes'>('no')
  const { 'data-demo-state': demo, disabled } = stateProps(state)
  return (
    <span className="block w-[200px]">
      <Segmented label={s.divisibleCargo} options={YES_NO} value={value} onChange={setValue} size={size} disabled={disabled ?? false} data-demo-state={demo} />
    </span>
  )
}

/** По ширине подписей, второй вариант недоступен — «Файл · Ссылка» окна А7 (15966:7665). */
function DemoSegmentedContent({ state }: { state: DemoState }) {
  const [value, setValue] = useState<'file' | 'url'>('file')
  const { 'data-demo-state': demo, disabled } = stateProps(state)
  return <Segmented label={ru.dataSources.create.fields.locator} fit="content" options={LOCATOR_KINDS} value={value} onChange={setValue} disabled={disabled ?? false} data-demo-state={demo} />
}

export function SegmentedShowcase() {
  return (
    <ShowcaseSection title="Segmented control">
      <StateGrid
        states={['default', 'hover', 'disabled']}
        rows={[
          { label: '40', render: (st) => <DemoSegmented size={40} state={st} /> },
          { label: '44', render: (st) => <DemoSegmented size={44} state={st} /> },
          { label: 'content', render: (st) => <DemoSegmentedContent state={st} /> },
        ]}
      />
      <RadioGroup variant="cards" columns={3} label={pp.processChoice} options={PROCESS_CARDS} defaultValue="LP-01" />
    </ShowcaseSection>
  )
}

export function SelectShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="Select">
        <StateGrid
          states={STATES}
          rows={[
            {
              label: 'field',
              render: (st) => (
                <span className="block w-[260px]">
                  <Select aria-label={s.operationClass} options={CLASS_OPTIONS} defaultValue="OP-01" {...stateProps(st)} />
                </span>
              ),
            },
            {
              label: 'filter',
              render: (st) => <Select variant="filter" aria-label={s.filterFacility} placeholder={s.filterFacility} options={FACILITY_OPTIONS} {...stateProps(st)} />,
            },
          ]}
        />
      </ShowcaseSection>
      <ShowcaseSection title="Field + Select">
        <div className="grid grid-cols-2 gap-40">
          <Field label={s.operationClass} required hint={s.operationClassHint}>
            <Select options={CLASS_OPTIONS} defaultValue="OP-01" />
          </Field>
          <Field label={s.filterFacility} required error={s.activeAreaError}>
            <Select options={FACILITY_OPTIONS} placeholder={s.filterFacility} />
          </Field>
        </div>
      </ShowcaseSection>
    </div>
  )
}

export function CheckboxShowcase() {
  return (
    <ShowcaseSection title="Checkbox">
      <StateGrid
        states={STATES}
        rows={[
          { label: 'off', render: (st) => <Checkbox label={s.operationClassValue} {...stateProps(st)} /> },
          { label: 'on', render: (st) => <Checkbox label={s.operationClassValue} defaultChecked {...stateProps(st)} /> },
        ]}
      />
      <RadioGroup variant="cards" columns={3} label={pp.processChoice} options={PROCESS_CARDS} defaultValue="LP-01" />
    </ShowcaseSection>
  )
}

export function RadioShowcase() {
  return (
    <ShowcaseSection title="Radio">
      <StateGrid
        states={STATES}
        rows={[
          { label: 'vertical', render: (st) => <RadioGroup label={s.handlingMethod} options={HANDLING_OPTIONS} defaultValue="platform" {...stateProps(st)} /> },
          { label: 'horizontal', render: (st) => <RadioGroup label={s.handlingMethod} orientation="horizontal" options={HANDLING_OPTIONS.slice(0, 2)} defaultValue="forks" {...stateProps(st)} /> },
        ]}
      />
      <RadioGroup variant="cards" columns={3} label={pp.processChoice} options={PROCESS_CARDS} defaultValue="LP-01" />
    </ShowcaseSection>
  )
}
