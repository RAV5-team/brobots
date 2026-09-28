import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented'
import type { AssumptionOverride } from '@/domain'
import { formatNumber, parseDecimal } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { assumptionValueText, validateAssumption, type AssumptionRow } from './paramsModel'

const t = ru.project.params.panel

type Kind = AssumptionOverride['kind']

const KIND_OPTIONS: readonly SegmentedOption<Kind>[] = [
  { value: 'fact', label: t.kinds.fact },
  { value: 'estimate', label: t.kinds.estimate },
]

interface AssumptionPanelProps {
  readonly row: AssumptionRow
  readonly onClose: () => void
  /** null — вернуть исходное значение. */
  readonly onApply: (next: AssumptionOverride | null) => void
}

const FORM_ID = 'assumption-panel-form'

/**
 * Панель «Уточнить допущение» (PRD 11.2; Modal side, 03a): текущее значение и источник, факт или оценка, новое значение
 * с единицей и диапазоном, где взять. Значение меняется только в проекте — профиль и справочник не трогаются (ТЗ 3.5.4).
 */
export function AssumptionPanel({ row, onClose, onApply }: AssumptionPanelProps) {
  const item = ru.project.params.assumptions.items[row.code]
  const [kind, setKind] = useState<Kind>(row.override?.kind ?? 'fact')
  const [text, setText] = useState(row.override ? formatNumber(row.override.value, row.digits) : '')
  const [error, setError] = useState<string | null>(null)
  const unit = row.unit === 'коэф.' ? '' : row.unit
  const range = t.range(formatNumber(row.min, row.digits), formatNumber(row.max, row.digits), unit)

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    const value = parseDecimal(text)
    const problem = validateAssumption(row, value)
    setError(problem)
    if (problem === null && value !== null) onApply({ code: row.code, value, kind })
  }

  return (
    <Modal
      size="side"
      title={t.title}
      description={item.label}
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      footer={(
        <>
          {row.override && <Button onClick={() => { onApply(null) }}>{t.reset}</Button>}
          <Button onClick={onClose}>{t.cancel}</Button>
          <Button variant="primary" type="submit" form={FORM_ID}>{t.apply}</Button>
        </>
      )}
    >
      <dl className="flex flex-col gap-12 rounded-lg bg-surface-sunken p-16">
        <div className="flex items-baseline justify-between gap-16">
          <dt className="type-caption text-text-secondary">{t.current}</dt>
          <dd className="type-body font-semibold text-text">{assumptionValueText(row, row.value)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-16">
          <dt className="type-caption text-text-secondary">{t.source}</dt>
          <dd className="type-body text-text">
            {row.override ? ru.project.params.assumptions.refined[row.override.kind] : item.source}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-16">
          <dt className="type-caption text-text-secondary">{t.affects}</dt>
          <dd className="text-right type-body text-text">{item.affects}</dd>
        </div>
      </dl>
      <form id={FORM_ID} noValidate onSubmit={submit} className="flex flex-col gap-16">
        <Field label={t.kind} hint={t.kindHint[kind]}>
          <Segmented label={t.kind} size={44} options={KIND_OPTIONS} value={kind} onChange={setKind} />
        </Field>
        <Field label={t.value} hint={range} error={error ?? undefined}>
          <Input
            value={text}
            inputMode="decimal"
            autoComplete="off"
            placeholder={formatNumber(row.base, row.digits)}
            invalid={error !== null}
            {...(unit ? { suffix: unit } : {})}
            onChange={(e) => {
              setText(e.target.value)
              if (error) setError(null)
            }}
          />
        </Field>
        <div className="flex flex-col gap-4">
          <p className="type-caption font-medium text-text-secondary">{t.where}</p>
          <p className="type-body text-text">{item.hint}</p>
        </div>
        <div className="flex flex-col gap-4">
          <p className="type-caption font-medium text-text-secondary">{t.savedTo}</p>
          <p className="type-body text-text">{t.savedToValue}</p>
        </div>
      </form>
    </Modal>
  )
}
