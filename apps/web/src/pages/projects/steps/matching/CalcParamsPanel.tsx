import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { CalcParams } from '@/domain'
import { formatCount, formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { useModelNorms } from '@/shared/norms/useModelNorms'
import { calcFields, parseCalcField, toFieldText, type CalcFieldSpec } from './matchingModel'

const p = ru.project.matching.params
const FORM_ID = 'calc-params-form'

type Texts = Readonly<Partial<Record<keyof CalcParams, string>>>
type Errors = Readonly<Partial<Record<keyof CalcParams, string>>>

interface CalcParamsPanelProps {
  readonly defaults: CalcParams
  readonly overrides: Partial<CalcParams>
  /** Решение, к которому относятся производительность и цена: «AMR 800». */
  readonly solutionName: string | null
  readonly onClose: () => void
  readonly onApply: (next: Partial<CalcParams>) => void
}

const initialTexts = (fields: readonly CalcFieldSpec[], overrides: Partial<CalcParams>): Texts =>
  Object.fromEntries(fields.flatMap((spec) => {
    const value = overrides[spec.key]
    return value === undefined ? [] : [[spec.key, toFieldText(spec, value)]]
  }))

function fieldLabel(spec: CalcFieldSpec, solutionName: string | null): string {
  const { label } = p.fields[spec.key]
  return spec.perSolution && solutionName ? p.solutionField(label, solutionName) : label
}

/**
 * Панель «Параметры расчёта» (PRD 11.3, ТЗ 3.5.3): семь допущений сценария проекта. Пустое поле — исходное значение;
 * изменения только в проекте и делают подбор устаревшим до пересчёта (D-89). Макета нет — Modal side и поля, как
 * у «Уточнить допущение» шага 1 (D-86). `onApply` получает только изменённые поля; пустой объект — все исходные.
 */
export function CalcParamsPanel({ defaults, overrides, solutionName, onClose, onApply }: CalcParamsPanelProps) {
  const horizonYears = useModelNorms().horizonYears
  const fields = calcFields(horizonYears)
  const [texts, setTexts] = useState<Texts>(() => initialTexts(fields, overrides))
  const [errors, setErrors] = useState<Errors>({})

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    const parsed = fields.map((spec) => [spec, parseCalcField(spec, texts[spec.key] ?? '')] as const)
    const nextErrors = Object.fromEntries(parsed.flatMap(([spec, r]) => (r.ok ? [] : [[spec.key, r.error]])))
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    onApply(Object.fromEntries(parsed.flatMap(([spec, r]) => (r.ok && r.value !== null && r.value !== defaults[spec.key] ? [[spec.key, r.value]] : []))))
  }

  return (
    <Modal
      size="side"
      title={p.title}
      description={p.description}
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      footer={(
        <>
          <Button onClick={() => { setTexts({}); setErrors({}) }}>{p.reset}</Button>
          <Button variant="primary" type="submit" form={FORM_ID}>{p.done}</Button>
        </>
      )}
    >
      <p className="type-caption text-text-secondary">{p.lead}</p>
      <form id={FORM_ID} noValidate onSubmit={submit} className="flex flex-col gap-16">
        {fields.map((spec) => {
          const field = p.fields[spec.key]
          const fieldHint = typeof field.hint === 'string' ? field.hint : field.hint(formatCount(horizonYears, ru.project.matching.plural.years))
          const initial = toFieldText(spec, defaults[spec.key])
          const error = errors[spec.key]
          const hint = `${fieldHint}. ${p.range(formatNumber(spec.min, spec.digits), formatNumber(spec.max, spec.digits))}`
          return (
            <Field key={spec.key} label={fieldLabel(spec, solutionName)} hint={hint} error={error}>
              <Input
                value={texts[spec.key] ?? ''}
                inputMode="decimal"
                autoComplete="off"
                placeholder={p.initial(initial)}
                suffix={field.unit}
                invalid={error !== undefined}
                onChange={(e) => {
                  setTexts({ ...texts, [spec.key]: e.target.value })
                  if (error) setErrors(Object.fromEntries(Object.entries(errors).filter(([key]) => key !== spec.key)))
                }}
              />
            </Field>
          )
        })}
      </form>
    </Modal>
  )
}
