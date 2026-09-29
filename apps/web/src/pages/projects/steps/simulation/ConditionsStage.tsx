import { ArrowRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { FieldGrid, FormSection } from '@/components/ui/FormSection'
import { MergedButton } from '@/components/ui/MergedButton'
import type { SelectOption } from '@/components/ui/Select'
import type { SimulationConditions } from '@/domain'
import { formatPercent } from '@/shared/format'
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
  type ConditionOrigin,
  type NumericConditionKey,
} from './conditionsModel'
import { DemandCard } from './DemandCard'
import { demandProfile } from './hourlyDemand'
import { PeakWindows } from './PeakWindows'

const t = ru.project.simulation.conditions

type SectionKey = keyof typeof t.sections
type GroupKey = keyof typeof t.groups
type ChoiceKey = 'traffic' | 'fastMoversAtGates' | 'fleetPolicy' | 'designVolume'

interface Group {
  /** Подраздел карточки с заголовком капсом; без ключа — поля прямо в карточке («Допущения расчёта»). */
  readonly key?: GroupKey
  readonly fields: readonly ConditionKey[]
}

/**
 * Карточки и подразделы 3.2 (16325:158): «Из задачи» — расписание и потоки, «Значения по умолчанию» — сервис, рост,
 * склад и проверка, «Допущения расчёта». Источник карточки — метка, которую у её полей не повторяем.
 */
const SECTIONS: readonly { readonly key: SectionKey; readonly origin: ConditionOrigin; readonly groups: readonly Group[] }[] = [
  {
    key: 'task',
    origin: 'task',
    groups: [
      { key: 'schedule', fields: ['firstShiftStartHour', 'shiftsPerDay', 'shiftHours', 'peakFactor'] },
      { key: 'flows', fields: ['inboundPalletsPerDay', 'outboundPalletsPerDay', 'manualShare'] },
    ],
  },
  {
    key: 'defaults',
    origin: 'default',
    groups: [
      { key: 'service', fields: ['maxWaitMin', 'onTimeTarget'] },
      { key: 'growth', fields: ['growthReserve'] },
      { key: 'site', fields: ['traffic', 'fastMoversAtGates', 'repairHours'] },
      { key: 'check', fields: ['tolerance', 'fleetPolicy', 'designVolume'] },
    ],
  },
  { key: 'assumptions', origin: 'assumption', groups: [{ fields: ['routeLengthM', 'operatorTimeShare', 'laborReplacementRatio'] }] },
]

/** Варианты из словаря: ключи подписей — значения условия, выбор приходит уже своего типа. */
const choices = <K extends string>(labels: Readonly<Record<K, string>>): readonly SelectOption<K>[] =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }))

const CHOICES = {
  traffic: choices(t.traffic),
  fastMoversAtGates: choices(t.fastMovers),
  fleetPolicy: choices(t.fleetPolicy),
  designVolume: choices(t.designVolume),
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
  readonly onRun: () => void
  /** Раскладка экрана: карточки условий — в основную колонку, график и запуск — в правую (каркас доски). */
  readonly layout: (body: ReactNode, rail: ReactNode) => ReactNode
}

/**
 * Этап 2 «Условия симуляции» (3.2, 16325:158; PRD 11.4; D-102): три карточки по источнику значений, пиковые окна,
 * справа — потребность по часам и запуск. Правка сохраняется сразу и делает прошлый прогон устаревшим (D-89).
 */
export function ConditionsStage({ bases, handlingName, overrides, calcPeak, canEdit, onChange, onRun, layout }: ConditionsStageProps) {
  const [invalid, setInvalid] = useState<ReadonlySet<ConditionKey>>(new Set())
  const conditions = effectiveConditions(bases, overrides)
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
    return t.onTimeHint(formatPercent(conditions.onTimeTarget), part, whole)
  }

  const renderField = (key: ConditionKey, sectionOrigin: ConditionOrigin) => {
    const origin = originOf(key, bases, overrides)
    const badge = origin === sectionOrigin ? null : origin
    if (isNumeric(key)) {
      const label = key === 'laborReplacementRatio' && handlingName ? t.replacementLabel(handlingName) : t.fields[key].label
      return (
        <NumberCondition
          key={key}
          spec={NUMERIC_FIELDS[key]}
          label={label}
          unit={t.fields[key].unit}
          hint={hintOf(key)}
          origin={badge}
          value={conditions[key]}
          crossError={key === 'shiftHours' ? shiftsProblem : null}
          disabled={!canEdit}
          onCommit={(value) => { set(key, value) }}
          onValidity={(valid) => { setValidity(key, valid) }}
        />
      )
    }
    return renderChoice(key as ChoiceKey, badge)
  }

  const renderChoice = (key: ChoiceKey, origin: ConditionOrigin | null) => {
    const common = { label: t.fields[key].label, hint: t.fields[key].hint, origin, disabled: !canEdit }
    switch (key) {
      case 'fastMoversAtGates':
        return <ChoiceCondition key={key} {...common} options={CHOICES.fastMoversAtGates} value={conditions.fastMoversAtGates ? 'abc' : 'no'} onChange={(v) => { set(key, v === 'abc') }} />
      case 'traffic':
        return <ChoiceCondition key={key} {...common} options={CHOICES.traffic} value={conditions.traffic} onChange={(v) => { set(key, v) }} />
      case 'fleetPolicy':
        return <ChoiceCondition key={key} {...common} options={CHOICES.fleetPolicy} value={conditions.fleetPolicy} onChange={(v) => { set(key, v) }} />
      case 'designVolume':
        return <ChoiceCondition key={key} {...common} options={CHOICES.designVolume} value={conditions.designVolume} onChange={(v) => { set(key, v) }} />
    }
  }

  const peakWindows = (
    <PeakWindows
      peaks={conditions.peakHours}
      isDefault={originOf('peakHours', bases, overrides) !== 'specified'}
      error={peaksProblem}
      canEdit={canEdit}
      onChange={(peaks) => { set('peakHours', peaks) }}
      onReset={() => { set('peakHours', bases.peakHours.value) }}
    />
  )

  const renderGroup = (group: Group, origin: ConditionOrigin, index: number) => {
    const grid = <FieldGrid>{group.fields.map((key) => renderField(key, origin))}</FieldGrid>
    if (!group.key) return <div key={index}>{grid}</div>
    const g: { readonly title: string; readonly description?: string } = t.groups[group.key]
    const headingId = `simulation-${group.key}-heading`
    return (
      // Подразделы — через линию (16914:6): первый без неё, сразу под заголовком карточки.
      <section key={group.key} aria-labelledby={headingId} className={index === 0 ? 'flex flex-col gap-16' : 'flex flex-col gap-16 border-t border-border pt-20'}>
        <div className="flex flex-col gap-4">
          <h3 id={headingId} className="type-overline text-text-muted">{g.title}</h3>
          {g.description && <p className="type-caption text-text-secondary">{g.description}</p>}
        </div>
        {group.key === 'schedule' && peakWindows}
        {grid}
      </section>
    )
  }

  const body = SECTIONS.map((section) => (
    <FormSection key={section.key} id={`simulation-${section.key}`} title={t.sections[section.key].title} description={t.sections[section.key].description}>
      {section.groups.map((group, index) => renderGroup(group, section.origin, index))}
    </FormSection>
  ))

  const rail = (
    <>
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
      <MergedButton block label={t.run} icon={ArrowRight} disabled={blocked || !canEdit} onClick={onRun} />
      {blocked && <p role="alert" className="type-caption font-medium text-danger">{t.invalid}</p>}
    </>
  )

  return layout(body, rail)
}
