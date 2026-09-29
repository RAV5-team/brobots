import { useState } from 'react'
import { toSimulationRun } from '@/api/mappers/simulation'
import { Badge } from '@/components/ui/Badge'
import { Chip } from '@/components/ui/Chip'
import { Field } from '@/components/ui/Field'
import { HourGrid } from '@/components/ui/HourGrid'
import { hourText } from '@/components/ui/hourText'
import { FieldGrid } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/Input'
import { NumberStepper } from '@/components/ui/NumberStepper'
import { Stepper, type StepperStep, type StepperStepState } from '@/components/ui/Stepper'
import { PROJECT_STEPS, SIMULATION_STAGES, type ProjectStep, type SimulationStage } from '@/domain'
import { SIMULATION_RUNS } from '@/mocks/fixtures/simulationRuns.generated'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { stateProps, type DemoState } from './demoState'
import { ShowcaseSection, StateGrid } from './StateGrid'

const p = ru.project
const STATES: readonly DemoState[] = ['default', 'hover', 'focus', 'disabled']

/** Шаги проекта по состояниям: черновик на симуляции — пройдены 1–2, 4 закрыт; сохранённая оценка — все пройдены. */
const projectSteps = (
  current: ProjectStep,
  stateOf: (index: number) => StepperStepState,
  labels: Readonly<Record<ProjectStep, string>> = ru.projectStepTitles,
): readonly StepperStep[] =>
  PROJECT_STEPS.map((step, index) => ({
    key: step,
    label: labels[step],
    state: step === current ? 'current' : stateOf(index),
    to: `#${step}`,
  }))

const stages = (current: SimulationStage, withLinks = false): readonly StepperStep[] =>
  SIMULATION_STAGES.map((stage, index) => ({
    key: stage,
    label: p.simulation.stages[stage],
    state: stage === current ? 'current' : index < SIMULATION_STAGES.indexOf(current) ? 'done' : 'locked',
    ...(withLinks ? { to: `#${stage}` } : {}),
  }))

const short = ru.projectStepShortTitles

/**
 * Степпер шагов проекта (pills, 16197:1120; метка после подписи — доска 16325) и этапов симуляции
 * (segments, 16197:1147; capsule — доска 16325:149). 4 шага по PRD 0.9 (D-54).
 */
export function StepperShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="Stepper · pills">
        <StateGrid
          states={['default', 'hover', 'focus']}
          rows={[
            { label: 'draft · simulation', render: (st) => <Stepper label={p.stepsNav} steps={projectSteps('simulation', (i) => (i < 2 ? 'done' : 'locked'))} {...stateProps(st)} /> },
          ]}
        />
        <Stepper label={p.stepsNav} steps={projectSteps('matching', (i) => (i < 1 ? 'done' : i === 2 ? 'available' : 'locked'))} />
        <Stepper label={p.stepsNav} steps={projectSteps('economics', () => 'done')} />
      </ShowcaseSection>
      <ShowcaseSection title="Stepper · pills · marker end">
        <StateGrid
          states={['default', 'hover', 'focus']}
          rows={[
            { label: 'draft · simulation', render: (st) => <Stepper label={p.stepsNav} marker="end" steps={projectSteps('simulation', (i) => (i < 2 ? 'done' : 'locked'), short)} {...stateProps(st)} /> },
          ]}
        />
        <Stepper label={p.stepsNav} marker="end" steps={projectSteps('params', (i) => (i === 1 ? 'available' : 'locked'), short)} />
        <Stepper label={p.stepsNav} marker="end" steps={projectSteps('economics', () => 'done', short)} />
      </ShowcaseSection>
      <ShowcaseSection title="Stepper · segments">
        {SIMULATION_STAGES.map((stage) => <Stepper key={stage} variant="segments" label={p.simulation.stagesNav} steps={stages(stage)} />)}
      </ShowcaseSection>
      <ShowcaseSection title="Stepper · capsule">
        <StateGrid
          states={['default', 'hover', 'focus']}
          rows={[
            { label: 'verdict', render: (st) => <div className="w-[560px]"><Stepper variant="capsule" label={p.simulation.stagesNav} steps={stages('verdict', true)} {...stateProps(st)} /></div> },
          ]}
        />
        {SIMULATION_STAGES.map((stage) => <Stepper key={stage} variant="capsule" label={p.simulation.stagesNav} steps={stages(stage, true)} />)}
      </ShowcaseSection>
    </div>
  )
}

function DemoFleet({ state, withPlan }: { readonly state: DemoState; readonly withPlan: boolean }) {
  const [robots, setRobots] = useState(withPlan ? 16 : 18)
  const delta = robots - 18
  return (
    <div className="w-[520px]">
      <NumberStepper
        label={p.simulation.fleet.robots}
        value={robots}
        min={1}
        max={60}
        onChange={setRobots}
        {...(withPlan ? { previous: p.simulation.fleet.previous(18) } : { description: p.simulation.fleet.perStation('3') })}
        {...(withPlan && delta !== 0 ? { delta: formatNumber(delta, 0, { signed: true }) } : {})}
        {...stateProps(state)}
      />
    </div>
  )
}

/** Вид block — правая колонка вердикта (16325:176): «из подбора», справа чип «+1» / «без изменений», широкий степпер. */
function DemoFleetBlock({ state }: { readonly state: DemoState }) {
  const from = needMore.from.stations
  const [stations, setStations] = useState(from + 1)
  const delta = stations - from
  return (
    <div className="w-(--rav-form-rail-width)">
      <NumberStepper
        layout="block"
        label={p.simulation.fleet.stations}
        value={stations}
        min={1}
        max={60}
        onChange={setStations}
        description={p.simulation.fleet.previous(from)}
        badge={delta === 0 ? <Chip tone="muted" size="sm">{p.simulation.verdict.plan.noChange}</Chip> : <Chip tone="inverse" size="sm">{formatNumber(delta, 0, { signed: true })}</Chip>}
        {...stateProps(state)}
      />
    </div>
  )
}

/** Строка числа ±: «Состав для проверки» 04 (16197:1213) и план вердикта 07 со слотами «было» и дельтой; block — доска 16325. */
export function NumberStepperShowcase() {
  return (
    <ShowcaseSection title="NumberStepper">
      <StateGrid
        states={STATES}
        rows={[
          { label: 'scope (04)', render: (st) => <DemoFleet state={st} withPlan={false} /> },
          { label: 'plan (07)', render: (st) => <DemoFleet state={st} withPlan /> },
          { label: 'block (16325:176)', render: (st) => <DemoFleetBlock state={st} /> },
        ]}
      />
    </ShowcaseSection>
  )
}

const needMoreDto = SIMULATION_RUNS.find((run) => run.status === 'needs_additions')
if (!needMoreDto) throw new Error('Фикстура прогона «нужно докупить» не найдена')
const needMore = toSimulationRun(needMoreDto)

/** Сетка полей в 2, 3 и 4 колонки — условия симуляции 05 (16197:1286); метки — одно перечисление Badge. */
export function FieldGridShowcase() {
  const f = p.simulation.fleet
  return (
    <ShowcaseSection title="FieldGrid · columns">
      {([2, 3, 4] as const).map((columns) => (
        <FieldGrid key={columns} columns={columns}>
          {Array.from({ length: columns }, (_, i) => (
            <Field key={i} label={i % 2 === 0 ? f.robots : f.stations} badge={<Badge kind={i === 0 ? 'task' : i === 1 ? 'default' : 'assumption'} />}>
              <Input defaultValue={formatNumber(i % 2 === 0 ? needMore.from.robots : needMore.from.stations)} />
            </Field>
          ))}
        </FieldGrid>
      ))}
    </ShowcaseSection>
  )
}

const HOURS_FROM_SHIFT = Array.from({ length: 24 }, (_, i) => (7 + i) % 24)
const OFF_SHIFT = [5, 6]

function DemoHourGrid({ label, disabled, showHourLabels }: { readonly label: string; readonly disabled: boolean; readonly showHourLabels: boolean }) {
  const [selected, setSelected] = useState<readonly number[]>([7, 8, 9, 10, 17, 18, 19])
  const peaks = p.simulation.conditions.peaks
  return (
    <HourGrid
      label={label}
      hours={HOURS_FROM_SHIFT}
      selected={selected}
      disabledHours={OFF_SHIFT}
      hourLabel={(h) => peaks.hour(hourText(h), hourText((h + 1) % 24), label)}
      showHourLabels={showHourLabels}
      disabled={disabled}
      onChange={setSelected}
    />
  )
}

/** Сетка часов «Пиковые часы» 05 (16197:1541): несколько отметок, часы вне смен пунктиром, стрелки двигают фокус. */
export function HourGridShowcase() {
  const peaks = p.simulation.conditions.peaks
  return (
    <ShowcaseSection title="HourGrid">
      <div className="flex flex-col gap-8">
        <DemoHourGrid label={peaks.inbound} disabled={false} showHourLabels={false} />
        <DemoHourGrid label={peaks.outbound} disabled={false} showHourLabels />
      </div>
      <DemoHourGrid label={peaks.inbound} disabled showHourLabels />
    </ShowcaseSection>
  )
}
