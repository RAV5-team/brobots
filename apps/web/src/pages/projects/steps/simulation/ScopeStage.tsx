import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Card, CardStat, CardTitle } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { MergedButton } from '@/components/ui/MergedButton'
import { NumberField } from '@/components/ui/NumberField'
import type { Fleet, RankedVariant } from '@/domain'
import { formatNumber, formatPercent, pluralize } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { parseFleetField, type CalcRow, type FleetKey } from './simulationModel'

const s = ru.project.simulation
const t = s.scope
const MILLION = 1_000_000

interface ScopeStageProps {
  readonly variant: RankedVariant
  readonly calc: readonly CalcRow[]
  /** Состав для проверки и состав из подбора. */
  readonly fleet: Fleet
  readonly fromMatching: Fleet
  readonly canEdit: boolean
  readonly onFleet: (fleet: Fleet) => void
}

interface FleetFieldProps {
  readonly fleetKey: FleetKey
  readonly label: string
  readonly value: number
  readonly fromMatching: number
  readonly disabled: boolean
  readonly onCommit: (value: number) => void
}

/**
 * Поле состава (3.1: «Роботов», «Станций»): верное число сохраняется сразу (D-21), неверное остаётся в поле с текстом
 * исправления. Изменённое значение показывает «было N · из подбора» (D-101).
 */
function FleetField({ fleetKey, label, value, fromMatching, disabled, onCommit }: FleetFieldProps) {
  // null — поле показывает действующее значение; строка — то, что пользователь набирает.
  const [text, setText] = useState<string | null>(null)
  const parsed = text === null ? null : parseFleetField(fleetKey, text)
  const error = parsed && !parsed.ok ? parsed.error : undefined
  return (
    <NumberField
      label={label}
      unit={t.source.units.pieces}
      value={text ?? String(value)}
      error={error}
      hint={value === fromMatching ? undefined : s.fleet.previous(fromMatching)}
      disabled={disabled}
      onChange={(next) => {
        setText(next)
        const result = parseFleetField(fleetKey, next)
        if (result.ok) onCommit(result.value)
      }}
      onBlur={() => { if (parsed?.ok) setText(null) }}
    />
  )
}

/** Значение подбора только для чтения (3.1: CAPEX, окупаемость) — поле-формула (Input computed; замена по D-86). */
function ReadonlyField({ label, value, unit }: { readonly label: string; readonly value: string; readonly unit?: string }) {
  return (
    <Field label={label}>
      <Input computed value={value} suffix={unit} />
    </Field>
  )
}

/**
 * «На проверке · из подбора» (3.1, 16325:149): вариант, поля состава и значения подбора, «Расчёт подбора».
 * CAPEX и окупаемость — из подбора и при смене состава не пересчитываются (ждёт решения, D-101).
 */
export function ScopeStage({ variant, calc, fleet, fromMatching, canEdit, onFleet }: ScopeStageProps) {
  const f = t.source.fields
  const name = ru.project.matching.variantName(variant.solutionName, ru.project.matching.acquisition[variant.acquisition])
  const set = (key: FleetKey) => (value: number) => { onFleet({ ...fleet, [key]: value }) }
  const payback = variant.paybackYears
  return (
    <Card as="section" padding={28} gap={20} aria-labelledby="simulation-source-title">
      <div className="flex flex-col gap-4">
        <CardTitle as="h2">{t.source.title}</CardTitle>
        <p id="simulation-source-title" className="type-title-md text-text">{name}</p>
      </div>
      <div className="grid grid-cols-4 items-start gap-16">
        <FleetField fleetKey="robots" label={f.robots} value={fleet.robots} fromMatching={fromMatching.robots} disabled={!canEdit} onCommit={set('robots')} />
        <FleetField fleetKey="stations" label={f.stations} value={fleet.stations} fromMatching={fromMatching.stations} disabled={!canEdit} onCommit={set('stations')} />
        <ReadonlyField label={f.capex} value={formatNumber(variant.capexRub / MILLION, 1)} unit={t.source.units.millionRub} />
        {payback === null
          ? <ReadonlyField label={f.payback} value={f.noPayback} />
          : <ReadonlyField label={f.payback} value={formatNumber(payback, 1)} unit={pluralize(payback, t.source.units.years)} />}
      </div>
      <div className="flex flex-col gap-4">
        <CardTitle as="h3">{t.calc.title}</CardTitle>
        <dl aria-label={t.calc.label}>
          {calc.map((row) => <CardStat key={row.key} label={row.label} value={row.value} />)}
        </dl>
      </div>
    </Card>
  )
}

interface ScopeRailProps {
  /** Допуск расхождения с расчётом, доля 0–1. */
  readonly tolerance: number
  readonly onNext: () => void
}

/** Правая колонка 3.1: «Что проверит симуляция» (четыре правила вердикта, PRD 11.4) и «Задать параметры симуляции» (№86). */
export function ScopeRail({ tolerance, onNext }: ScopeRailProps) {
  return (
    <>
      <Card as="section" padding={28} gap={20} aria-labelledby="simulation-checks-title">
        <h2 id="simulation-checks-title" className="type-heading text-text">{t.checks.title}</h2>
        <ol className="flex flex-col gap-20">
          {t.checks.items(formatPercent(1 - tolerance), formatPercent(tolerance)).map((item, index) => (
            <li key={item} className="flex items-start gap-12 type-body text-text">
              <span aria-hidden className="flex size-24 shrink-0 items-center justify-center rounded-full bg-surface-sunken type-caption font-semibold text-text">{index + 1}</span>
              {item}
            </li>
          ))}
        </ol>
      </Card>
      <MergedButton block label={t.next} icon={ArrowRight} onClick={onNext} />
    </>
  )
}
