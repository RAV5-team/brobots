import { ArrowRight, Check, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { MergedButton } from '@/components/ui/MergedButton'
import { NumberStepper } from '@/components/ui/NumberStepper'
import type { Fleet, RankedVariant, SimulationRun } from '@/domain'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { FLEET_LIMITS } from './simulationModel'
import type { VerdictStageProps } from './VerdictStage'
import { canAcceptRisk, economicsRows, kpisLine, planCheck, planDelta, planToStore, servedShare, verdictAction } from './verdictModel'

const t = ru.project.simulation.verdict
const f = ru.project.simulation.fleet

/** Пояснения строки состава: из подбора; проверенный, если прогон шёл не по подбору; рекомендация, если она другая. */
function captions(key: keyof Fleet, run: SimulationRun, fromMatching: Fleet) {
  const checked = run.from[key]
  const recommended = run.to[key]
  const lines = [
    t.plan.fromMatching(fromMatching[key]),
    checked === fromMatching[key] ? null : t.plan.fromChecked(checked),
    recommended === checked ? null : t.plan.recommended(recommended),
  ].filter((line): line is string => line !== null)
  const rest = lines.slice(1)
  // Строки пояснения — каждая с новой строки (16414:3651); пробел между ними — для описания значения.
  const previous = rest.length === 0 ? undefined : rest.map((line, i) => <span key={line} className="block">{i > 0 && ' '}{line}</span>)
  return { description: lines[0], previous }
}

interface PlanProps {
  readonly run: SimulationRun
  readonly fromMatching: Fleet
  readonly plan: Fleet
  readonly locked: boolean
  readonly onPlan: (plan: Fleet) => void
}

/**
 * «Что докупить» (3.4) / «Состав парка» (3.6), 16414:3613: строка на величину — подпись, «из подбора», «рекомендация»,
 * чип изменения к проверенному составу и широкий степпер. Состав проверен — лаймовая плашка (3.6), нет — строка 07c.
 */
function PlanCard({ run, fromMatching, plan, locked, onPlan }: PlanProps) {
  const check = planCheck(run, plan)
  const row = (key: keyof Fleet, label: string) => {
    const delta = planDelta(plan[key], run.from[key])
    const { description, previous } = captions(key, run, fromMatching)
    return (
      <NumberStepper
        layout="block"
        label={label}
        value={plan[key]}
        {...FLEET_LIMITS[key]}
        disabled={locked}
        description={description}
        {...(previous === undefined ? {} : { previous })}
        badge={delta === null ? <Chip tone="muted">{t.plan.noChange}</Chip> : <Chip tone="inverse">{delta}</Chip>}
        onChange={(value) => { onPlan({ ...plan, [key]: value }) }}
      />
    )
  }
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="verdict-plan-title">
      <h2 id="verdict-plan-title" className="type-heading text-text">{run.verdict === 'need_more' ? t.plan.titleNeedMore : t.plan.title}</h2>
      {row('robots', f.robots)}
      {row('stations', f.stations)}
      {check === null
        ? <p role="status" className="type-caption font-medium text-text">{t.plan.unchecked(plan.robots, plan.stations)}</p>
        : check.kind === 'from' && canAcceptRisk(run)
          ? <p role="status" className="type-caption text-text-secondary">{kpisLine(check.kpis)}</p>
          : (
              <Card variant="accent" padding={16} gap={0} role="status" className="flex-row items-start gap-6">
                <Check aria-hidden size={14} strokeWidth={3} className="mt-2 shrink-0 text-on-accent" />
                <p className="type-caption font-semibold text-on-accent">
                  {t.plan.checked(formatNumber(check.kpis.peak.servedPerHour), formatNumber(check.kpis.peak.requiredPerHour), formatPercent(check.kpis.onTimeWorstDay, 1))}
                </p>
              </Card>
            )}
    </Card>
  )
}

/** «Экономика, предварительно» (3.4, 16414:3663): из подбора → с изменениями, изменение в процентах; хуже — `danger`. */
function EconomicsCard({ variant, plan }: { readonly variant: RankedVariant; readonly plan: Fleet }) {
  const e = t.economics
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="verdict-economics-title">
      <CardTitle as="h2" id="verdict-economics-title">{e.title}</CardTitle>
      <table className="w-full border-collapse">
        <caption className="sr-only">{e.caption}</caption>
        <thead>
          <tr className="type-caption text-text-muted">
            <th scope="col"><span className="sr-only">{e.columns.indicator}</span></th>
            <th scope="col" className="pl-8 text-right font-normal whitespace-nowrap">{e.columns.from}</th>
            <th scope="col" className="pl-8 text-right font-normal whitespace-nowrap">{e.columns.to}</th>
          </tr>
        </thead>
        <tbody>
          {economicsRows(variant, plan).map((row) => (
            <tr key={row.key} className="border-b border-border last:border-b-0">
              <th scope="row" className="py-8 text-left align-top type-caption font-normal text-text-secondary">{row.label}</th>
              <td className="py-8 pl-8 text-right align-top type-caption whitespace-nowrap text-text-secondary tabular-nums">{row.from}</td>
              <td className="py-8 pl-8 text-right align-top tabular-nums">
                <span className="block type-body font-semibold whitespace-nowrap text-text">{row.to}</span>
                {row.change && (
                  <span className={row.change.worse ? 'block type-caption text-danger' : 'block type-caption text-text-secondary'}>
                    <span aria-hidden>{row.change.text}</span>
                    <span className="sr-only">{row.change.worse ? e.worse(row.change.text) : row.change.text}</span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

/**
 * Правая колонка вердикта (3.4, 16414:3373; 3.6): состав, экономика, «Продолжить без изменений» (07b), главное действие
 * и всегда — «Изменить условия симуляции», «Выбрать другое решение». Узкое место и недостижимо — без плана и экономики.
 */
export function VerdictRail(props: VerdictStageProps) {
  const { run, variant, fromMatching, plan, acceptRisk, canEdit, onVerdict, onAccept, onRerun } = props
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const action = verdictAction(run, plan, acceptRisk)
  const riskShown = canAcceptRisk(run)

  const accept = () => {
    setAccepting(true)
    setAcceptError(null)
    onAccept().catch((error: unknown) => {
      console.error('Не удалось принять план вердикта', error)
      setAcceptError(t.accepted.failed)
      setAccepting(false)
    })
  }
  const setPlan = (next: Fleet) => { onVerdict({ plan: planToStore(next, run), acceptRisk: false }) }
  // Риск принимают за прежний состав; снятая галочка возвращает рекомендацию.
  const setRisk = (accept: boolean) => { onVerdict({ plan: accept ? run.from : null, acceptRisk: accept }) }

  const secondary = (
    <>
      <ButtonLink to={props.conditionsTo} className="w-full justify-center">{t.actions.conditions}</ButtonLink>
      <ButtonLink to={props.matchingTo} className="w-full justify-center">{t.actions.otherSolution}</ButtonLink>
    </>
  )
  if (action === 'closed') {
    return (
      <>
        <p className="type-caption text-text-secondary">{t.actions.closed}</p>
        {secondary}
      </>
    )
  }

  const primary = {
    accept: { label: canEdit ? t.actions.consider : t.actions.toEconomics, icon: ArrowRight, onClick: accept },
    acceptRisk: { label: t.actions.acceptRisk(plan.robots, plan.stations), icon: ArrowRight, onClick: accept },
    rerun: { label: t.actions.rerun, icon: RotateCcw, onClick: () => { onRerun(plan) } },
  }[action]
  return (
    <>
      <PlanCard run={run} fromMatching={fromMatching} plan={plan} locked={!canEdit || (acceptRisk && riskShown)} onPlan={setPlan} />
      <EconomicsCard variant={variant} plan={plan} />
      {riskShown && (
        <div className="flex flex-col gap-4">
          <Checkbox label={t.risk.label(run.from.robots, run.from.stations)} checked={acceptRisk} disabled={!canEdit} onCheckedChange={setRisk} />
          <p className="pl-[calc(var(--rav-size-18)+var(--rav-space-12))] type-caption text-text-secondary">{t.risk.description(servedShare(run.before))}</p>
        </div>
      )}
      <MergedButton
        block
        label={primary.label}
        icon={primary.icon}
        disabled={accepting || (action === 'rerun' && !canEdit)}
        onClick={primary.onClick}
      />
      {acceptError && <p role="alert" className="type-caption text-danger">{acceptError}</p>}
      {secondary}
    </>
  )
}
