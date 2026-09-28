import { useId } from 'react'
import { ChipToggle } from '@/components/ui/Chip'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select, type SelectOption } from '@/components/ui/Select'
import type { DataConfidence, HandlingMethod, OperationClass, Process, RobotId } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { RobotFieldGrid, RobotFormSection, RobotSpecField, RobotTextField, type RobotSectionProps } from './RobotFormParts'
import { classChipHint, classesHint, type ReadinessChoice, type SolutionTypeOption, type YesNo } from './robotForm'

const t = ru.robotNew

const READINESS_OPTIONS: readonly SelectOption<ReadinessChoice>[] = (['operation', 'pilot', 'rnd'] as const)
  .map((value) => ({ value, label: t.readiness[value] }))
const YES_NO_OPTIONS: readonly SelectOption<YesNo>[] = (['yes', 'no'] as const).map((value) => ({ value, label: t.yesNo[value] }))
const CONFIDENCE_OPTIONS: readonly SelectOption<DataConfidence>[] = (['confirmed', 'partial', 'unconfirmed'] as const)
  .map((value) => ({ value, label: t.confidence[value] }))

interface MainSectionProps extends RobotSectionProps {
  readonly solutionTypes: readonly SolutionTypeOption[]
}

/** Секция 1 «Основное и цена» (PRD 6.3; 15966:6003): все шесть полей обязательные. */
export function MainSection({ solutionTypes, ...props }: MainSectionProps) {
  const { form, errors, update } = props
  return (
    <RobotFormSection id="robot-main" title={t.sections.main.title}>
      <RobotFieldGrid evenRows>
        <RobotTextField {...props} name="name" required />
        <RobotTextField {...props} name="manufacturer" required />
        <Field label={t.fields.readiness.label} required hint={t.fields.readiness.hint} error={errors.readiness}>
          <Select
            options={READINESS_OPTIONS}
            value={form.readiness}
            placeholder={t.fields.readiness.placeholder}
            onChange={(readiness) => { update({ readiness }) }}
          />
        </Field>
        <RobotTextField {...props} name="trl" required inputMode="numeric" />
        <RobotTextField {...props} name="price" required inputMode="numeric" />
        <Field label={t.fields.solutionType.label} required error={errors.solutionType}>
          <Select
            options={solutionTypes}
            value={form.solutionType}
            placeholder={t.fields.solutionType.placeholder}
            onChange={(solutionType) => { update({ solutionType }) }}
          />
        </Field>
      </RobotFieldGrid>
    </RobotFormSection>
  )
}

interface ClassesSectionProps extends RobotSectionProps {
  readonly nextId: RobotId
  readonly operationClasses: readonly OperationClass[]
  readonly processes: readonly Process[]
}

/** Секция 2 «Классы операций и идентификатор» (PRD 6.3; 15966:6041): ключ подбора робота. */
export function ClassesSection({ nextId, operationClasses, processes, form, errors, update }: ClassesSectionProps) {
  const labelId = useId()
  const hintId = `${labelId}-hint`
  const toggle = (code: OperationClass['code'], pressed: boolean) => {
    const rest = form.classes.filter((c) => c !== code)
    // Порядок — как в справочнике: так же в подсказке и подписи панели.
    const next = pressed ? operationClasses.map((c) => c.code).filter((c) => c === code || rest.includes(c)) : rest
    update({ classes: next })
  }
  const invalid = errors.classes !== undefined

  return (
    <RobotFormSection id="robot-classes" title={t.sections.classes.title} description={t.sections.classes.description}>
      <div className="flex flex-col gap-24">
        {/* Поле в ширину колонки, подсказка — во всю секцию (15966:6046). */}
        <Field label={t.fields.id.label} required hint={t.fields.id.hint}>
          <div className="w-1/2 pr-8">
            <Input value={nextId} readOnly aria-readonly />
          </div>
        </Field>
        <div
          role="group"
          aria-labelledby={labelId}
          aria-describedby={hintId}
          data-invalid={invalid || undefined}
          tabIndex={invalid ? -1 : undefined}
          className="flex flex-col gap-8 outline-none"
        >
          <p id={labelId} className="type-caption font-medium text-text-secondary">
            {t.fields.classes.label}<span aria-hidden> *</span>{t.fields.classes.extra}
          </p>
          <div className="flex flex-wrap gap-8">
            {operationClasses.map((cls) => (
              <ChipToggle
                key={cls.code}
                pressed={form.classes.includes(cls.code)}
                onPressedChange={(pressed) => { toggle(cls.code, pressed) }}
                description={classChipHint(cls)}
              >
                {`${cls.code} · ${cls.name}`}
              </ChipToggle>
            ))}
          </div>
          <p id={hintId} role="status" className={invalid ? 'type-caption font-medium text-danger' : 'type-caption text-text-muted'}>
            {errors.classes ?? classesHint(form.classes, processes)}
          </p>
        </div>
      </div>
    </RobotFormSection>
  )
}

/** Секция 3 «Технические параметры» (PRD 6.3; 15966:6087): необязательные, «точное значение» — у проверок. */
export function SpecsSection(props: RobotSectionProps) {
  return (
    <RobotFormSection id="robot-specs" title={t.sections.specs.title} description={t.sections.specs.description}>
      <RobotFieldGrid>
        <RobotSpecField {...props} name="payloadKg" exact />
        <RobotSpecField {...props} name="maxSpeedMps" />
        <RobotSpecField {...props} name="autonomyH" />
        <RobotSpecField {...props} name="chargeTimeMin" />
        <RobotSpecField {...props} name="dimensions" exact />
        <RobotSpecField {...props} name="minTempC" exact />
        <RobotSpecField {...props} name="avgPowerKw" />
        <RobotSpecField {...props} name="loadUnload" />
      </RobotFieldGrid>
    </RobotFormSection>
  )
}

interface ConditionsSectionProps extends RobotSectionProps {
  readonly handlingMethods: readonly HandlingMethod[]
}

/** Секция 4 «Условия применения» (PRD 6.3; 15966:6146): жёсткие проверки до рейтинга. */
export function ConditionsSection({ handlingMethods, ...props }: ConditionsSectionProps) {
  const { form, update } = props
  const methods = handlingMethods.map((m) => ({ value: m.code, label: m.name, description: m.hint }))
  return (
    <RobotFormSection id="robot-conditions" title={t.sections.conditions.title} description={t.sections.conditions.description}>
      <RobotFieldGrid>
        <Field label={t.fields.handlingMethod.label}>
          <Select
            options={methods}
            value={form.handlingMethod}
            placeholder={t.fields.handlingMethod.placeholder}
            onChange={(handlingMethod) => { update({ handlingMethod }) }}
          />
        </Field>
        <Field label={t.fields.indoor.label}>
          <Select options={YES_NO_OPTIONS} value={form.indoor} placeholder={t.fields.indoor.placeholder} onChange={(indoor) => { update({ indoor }) }} />
        </Field>
        <Field label={t.fields.outdoor.label}>
          <Select options={YES_NO_OPTIONS} value={form.outdoor} placeholder={t.fields.outdoor.placeholder} onChange={(outdoor) => { update({ outdoor }) }} />
        </Field>
        <Field label={t.fields.confidence.label} hint={t.fields.confidence.hint}>
          <Select
            options={CONFIDENCE_OPTIONS}
            value={form.confidence}
            placeholder={t.fields.confidence.placeholder}
            onChange={(confidence) => { update({ confidence }) }}
          />
        </Field>
        <div className="col-span-2">
          <RobotTextField {...props} name="sourceText" />
        </div>
      </RobotFieldGrid>
    </RobotFormSection>
  )
}
