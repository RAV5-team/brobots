import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FieldGrid, FormSection } from '@/components/ui/FormSection'
import type { SimulationConditions } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { ChoiceCondition, NumberCondition } from './ConditionField'
import {
  NUMERIC_FIELDS,
  effectiveConditions,
  originOf,
  peaksError,
  shiftsError,
  simpleFraction,
  withCondition,
  type ConditionBases,
  type ConditionKey,
  type NumericConditionKey,
} from './conditionsModel'
import { DemandCard } from './DemandCard'
import { demandProfile, workingHours } from './hourlyDemand'
import { PeakHoursCard } from './PeakHoursCard'

const t = ru.project.simulation.conditions

type GroupKey = keyof typeof t.groups
type ChoiceKey = 'traffic' | 'fastMoversAtGates' | 'fleetPolicy' | 'designVolume'

/** Группы и поля по макету (16197:1335 … 16197:1509): порядок, колонки. */
const GROUPS: readonly { readonly key: GroupKey; readonly columns: 2 | 3 | 4 | 1; readonly fields: readonly ConditionKey[] }[] = [
  { key: 'schedule', columns: 4, fields: ['firstShiftStartHour', 'shiftsPerDay', 'shiftHours', 'peakFactor'] },
  { key: 'flows', columns: 3, fields: ['inboundPalletsPerDay', 'outboundPalletsPerDay', 'manualShare'] },
  { key: 'service', columns: 2, fields: ['maxWaitMin', 'onTimeTarget'] },
  { key: 'growth', columns: 1, fields: ['growthReserve'] },
  { key: 'site', columns: 3, fields: ['traffic', 'fastMoversAtGates', 'repairHours'] },
  { key: 'assumptions', columns: 3, fields: ['routeLengthM', 'operatorTimeShare', 'laborReplacementRatio'] },
  { key: 'check', columns: 3, fields: ['tolerance', 'fleetPolicy', 'designVolume'] },
]

const CHOICES = {
  traffic: Object.entries(t.traffic).map(([value, label]) => ({ value, label })),
  fastMoversAtGates: Object.entries(t.fastMovers).map(([value, label]) => ({ value, label })),
  fleetPolicy: Object.entries(t.fleetPolicy).map(([value, label]) => ({ value, label })),
  designVolume: Object.entries(t.designVolume).map(([value, label]) => ({ value, label })),
} as const

const isNumeric = (key: ConditionKey): key is NumericConditionKey => key in NUMERIC_FIELDS

interface ConditionsStageProps {
  readonly bases: ConditionBases
  /** Способ обработки робота для подписи коэффициента замещения: «платформа». */
  readonly handlingName: string | null
  readonly canEdit: boolean
  /** Пиковая потребность подбора, рейсов в час. */
  readonly calcPeak: number | null
  readonly overrides: Partial<SimulationConditions>
  readonly onChange: (overrides: Partial<SimulationConditions>) => void
  readonly onBack: () => void
  readonly onRun: () => void
}

/**
 * Этап 2 «Условия симуляции» (экран 05, 16197:1285; PRD 11.4; D-102): семь групп полей с меткой источника,
 * пиковые часы и потребность по часам. Правка сохраняется сразу и делает прошлый прогон устаревшим (D-89).
 */
export function ConditionsStage({ bases, handlingName, overrides, calcPeak, canEdit, onChange, onBack, onRun }: ConditionsStageProps) {
  const [invalid, setInvalid] = useState<ReadonlySet<ConditionKey>>(new Set())
  const conditions = effectiveConditions(bases, overrides)
  const working = workingHours(conditions.firstShiftStartHour, conditions.shiftsPerDay, conditions.shiftHours)
  const shiftsProblem = shiftsError(conditions)
  const peaksProblem = shiftsProblem ? null : peaksError(conditions)
  const blocked = invalid.size > 0 || shiftsProblem !== null || peaksProblem !== null

  const set = <K extends ConditionKey>(key: K, value: SimulationConditions[K]) => { onChange(withCondition(overrides, bases, key, value)) }
  const setValidity = (key: ConditionKey, valid: boolean) => {
    setInvalid((current) => {
      if (valid === !current.has(key)) return current
      return valid ? new Set([...current].filter((k) => k !== key)) : new Set([...current, key])
    })
  }

  const hintOf = (key: NumericConditionKey): string => {
    if (key !== 'onTimeTarget') return t.fields[key].hint
    const { part, whole } = simpleFraction(conditions.onTimeTarget)
    return t.onTimeHint(part, whole)
  }

  const renderField = (key: ConditionKey) => {
    if (isNumeric(key)) {
      const label = key === 'laborReplacementRatio' && handlingName ? t.replacementLabel(handlingName) : t.fields[key].label
      return (
        <NumberCondition
          key={key}
          spec={NUMERIC_FIELDS[key]}
          label={label}
          unit={t.fields[key].unit}
          hint={hintOf(key)}
          origin={originOf(key, bases, overrides)}
          value={conditions[key]}
          crossError={key === 'shiftHours' ? shiftsProblem : null}
          disabled={!canEdit}
          onCommit={(value) => { set(key, value) }}
          onValidity={(valid) => { setValidity(key, valid) }}
        />
      )
    }
    return renderChoice(key as ChoiceKey)
  }

  const renderChoice = (key: ChoiceKey) => {
    const common = { label: t.fields[key].label, hint: t.fields[key].hint, origin: originOf(key, bases, overrides), disabled: !canEdit }
    switch (key) {
      case 'fastMoversAtGates':
        return <ChoiceCondition key={key} {...common} options={CHOICES.fastMoversAtGates} value={conditions.fastMoversAtGates ? 'abc' : 'no'} onChange={(v) => { set(key, v === 'abc') }} />
      case 'traffic':
        return <ChoiceCondition key={key} {...common} options={CHOICES.traffic} value={conditions.traffic} onChange={(v) => { set(key, v as SimulationConditions['traffic']) }} />
      case 'fleetPolicy':
        return <ChoiceCondition key={key} {...common} options={CHOICES.fleetPolicy} value={conditions.fleetPolicy} onChange={(v) => { set(key, v as SimulationConditions['fleetPolicy']) }} />
      case 'designVolume':
        return <ChoiceCondition key={key} {...common} options={CHOICES.designVolume} value={conditions.designVolume} onChange={(v) => { set(key, v as SimulationConditions['designVolume']) }} />
    }
  }

  return (
    <>
      {GROUPS.map((group) => (
        <FormSection key={group.key} id={`simulation-${group.key}`} title={t.groups[group.key].title} description={t.groups[group.key].description}>
          {group.columns === 1 ? group.fields.map(renderField) : <FieldGrid columns={group.columns}>{group.fields.map(renderField)}</FieldGrid>}
        </FormSection>
      ))}
      <PeakHoursCard
        startHour={conditions.firstShiftStartHour}
        working={working}
        peaks={conditions.peakHours}
        isDefault={originOf('peakHours', bases, overrides) !== 'specified'}
        error={peaksProblem}
        disabled={!canEdit}
        onChange={(peaks) => { set('peakHours', peaks) }}
        onReset={() => { set('peakHours', bases.peakHours.value) }}
      />
      <DemandCard
        calcPeak={calcPeak}
        profile={demandProfile({
          startHour: conditions.firstShiftStartHour,
          shiftsPerDay: conditions.shiftsPerDay,
          shiftHours: conditions.shiftHours,
          peakFactor: conditions.peakFactor,
          peakHours: conditions.peakHours,
          inboundPerDay: conditions.inboundPalletsPerDay,
          outboundPerDay: conditions.outboundPalletsPerDay,
          manualShare: conditions.manualShare,
        })}
      />
      <div className="flex items-center justify-end gap-12">
        {blocked && <p role="alert" className="mr-auto type-caption font-medium text-danger">{t.invalid}</p>}
        <Button onClick={onBack}>
          <ArrowLeft aria-hidden size={16} />
          {t.back}
        </Button>
        <Button variant="primary" disabled={blocked || !canEdit} onClick={onRun}>
          {t.run}
          <ArrowRight aria-hidden size={16} />
        </Button>
      </div>
    </>
  )
}
