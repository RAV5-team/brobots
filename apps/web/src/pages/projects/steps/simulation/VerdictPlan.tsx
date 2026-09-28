import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { NumberStepper } from '@/components/ui/NumberStepper'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { Fleet, RankedVariant, SimulationRun } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { formatNumber, formatPercent } from '@/shared/format'
import { FLEET_LIMITS, robotsPerStation } from './simulationModel'
import { canAcceptRisk, economicsRows, kpisLine, planChangeLabel, planCheck, planDelta, sameFleet, servedShare } from './verdictModel'

const t = ru.project.simulation.verdict
const f = ru.project.simulation.fleet

interface PlanCardProps {
  readonly run: SimulationRun
  readonly fromMatching: Fleet
  readonly plan: Fleet
  readonly acceptRisk: boolean
  readonly canEdit: boolean
  readonly onPlan: (plan: Fleet) => void
  readonly onAcceptRisk: (accept: boolean) => void
}

/** Строка под степперами: проверен ли состав плана и чем (PRD 11.4; 07c — не проверен). */
function checkNote(run: SimulationRun, plan: Fleet): string {
  const check = planCheck(run, plan)
  if (check === null) return t.plan.unchecked(plan.robots, plan.stations)
  if (check.kind === 'from' && canAcceptRisk(run)) return kpisLine(check.kpis)
  const { peak, onTimeWorstDay } = check.kpis
  return t.plan.checked(formatNumber(peak.servedPerHour), formatNumber(peak.requiredPerHour), formatPercent(onTimeWorstDay, 1))
}

/**
 * «План изменений по итогам прогона» (16197:1892): степперы с «было» (проверенный состав) и дельтой,
 * рекомендация уже подставлена; у «нужно докупить» — «Продолжить без изменений и принять риск» (07b).
 */
export function PlanCard({ run, fromMatching, plan, acceptRisk, canEdit, onPlan, onAcceptRisk }: PlanCardProps) {
  const base = run.from
  const previous = (count: number) => (sameFleet(base, fromMatching) ? t.plan.previousMatching(count) : t.plan.previousChecked(count))
  const locked = !canEdit || acceptRisk
  const check = planCheck(run, plan)
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="verdict-plan-title">
      <div className="flex flex-wrap items-center justify-between gap-8">
        <h2 id="verdict-plan-title" className="type-heading text-text">{t.plan.title}</h2>
        <Chip>{planChangeLabel(base, plan)}</Chip>
      </div>
      <NumberStepper
        label={f.robots}
        value={plan.robots}
        {...FLEET_LIMITS.robots}
        disabled={locked}
        previous={previous(base.robots)}
        delta={planDelta(plan.robots, base.robots)}
        onChange={(robots) => { onPlan({ ...plan, robots }) }}
      />
      <NumberStepper
        label={f.stations}
        value={plan.stations}
        {...FLEET_LIMITS.stations}
        disabled={locked}
        description={f.perStation(robotsPerStation(plan))}
        previous={previous(base.stations)}
        delta={planDelta(plan.stations, base.stations)}
        onChange={(stations) => { onPlan({ ...plan, stations }) }}
      />
      <p role="status" className={check === null ? 'type-caption font-medium text-text' : 'type-caption text-text-secondary'}>{checkNote(run, plan)}</p>
      {canAcceptRisk(run) && (
        <div className="flex flex-col gap-4 rounded-lg bg-surface-sunken px-16 py-12">
          <Checkbox label={t.risk.label(base.robots, base.stations)} checked={acceptRisk} disabled={!canEdit} onCheckedChange={onAcceptRisk} />
          <p className="pl-30 type-caption text-text-secondary">{t.risk.description(servedShare(run.before))}</p>
        </div>
      )}
      <p className="type-caption text-text-secondary">{t.plan.note}</p>
    </Card>
  )
}

/** «Экономика, предварительно» (16197:1922): из подбора → с изменениями, разница со знаком (D-104). */
export function EconomicsCard({ variant, plan }: { readonly variant: RankedVariant; readonly plan: Fleet }) {
  const e = t.economics
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="verdict-economics-title">
      <div className="flex flex-wrap items-center justify-between gap-8">
        <h2 id="verdict-economics-title" className="type-heading text-text">{e.title}</h2>
        <p aria-hidden className="flex items-center gap-4 type-caption text-text-secondary">
          {e.columns.from}
          <ArrowRight size={12} />
          {e.columns.to.toLowerCase()}
        </p>
      </div>
      <Table caption={e.caption} layout="fixed">
        {/* Подписей колонок на макете нет: заголовки — для чтения с экрана, ширины — колонками. */}
        <colgroup>
          <col />
          <col className="w-150" />
          <col className="w-150" />
          <col className="w-150" />
        </colgroup>
        <TableHead>
          <tr className="sr-only">
            <TableHeaderCell>{e.columns.indicator}</TableHeaderCell>
            <TableHeaderCell>{e.columns.from}</TableHeaderCell>
            <TableHeaderCell>{e.columns.to}</TableHeaderCell>
            <TableHeaderCell>{e.columns.delta}</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {economicsRows(variant, plan).map((row) => (
            <TableRow key={row.key}>
              <TableCell><span className="type-body-sm text-text-secondary">{row.label}</span></TableCell>
              <TableCell align="end"><span className="type-body-sm font-medium text-text-secondary tabular-nums">{row.from}</span></TableCell>
              <TableCell align="end"><span className="type-body-sm font-medium text-text-secondary tabular-nums">{row.to}</span></TableCell>
              <TableCell align="end"><span className="type-body-sm font-semibold tabular-nums">{row.delta}</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="type-caption text-text-secondary">{e.note}</p>
    </Card>
  )
}
