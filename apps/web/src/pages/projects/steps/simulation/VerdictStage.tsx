import type { Fleet, RankedVariant, SimulationRun } from '@/domain'
import { VerdictActions } from './VerdictActions'
import { VerdictCard } from './VerdictCard'
import { EconomicsCard, PlanCard } from './VerdictPlan'
import { canAcceptRisk, planToStore, verdictAction } from './verdictModel'

export interface VerdictStageProps {
  readonly run: SimulationRun
  readonly variant: RankedVariant
  readonly fromMatching: Fleet
  readonly plan: Fleet
  readonly acceptRisk: boolean
  readonly canEdit: boolean
  /** План (null — рекомендация симуляции) и принятый риск — одной записью. */
  readonly onVerdict: (patch: { readonly plan: Fleet | null; readonly acceptRisk: boolean }) => void
  /** Записать план и открыть «Итог и экономику». */
  readonly onAccept: () => Promise<void>
  /** 07c: прогнать свой состав. */
  readonly onRerun: (fleet: Fleet) => void
  readonly conditionsTo: string
  readonly matchingTo: string
}

/**
 * Этап 4 «Вердикт», вкладка «Вердикт и действия» (экран 07, 16197:1847; PRD 11.4; D-104): что показала симуляция,
 * план состава, предварительная экономика и переход к итогу. 07b — принять риск, 07c — свой состав и повторный прогон.
 */
export function VerdictStage(props: VerdictStageProps) {
  const { run, variant, fromMatching, plan, acceptRisk, canEdit, onVerdict } = props
  const action = verdictAction(run, plan, acceptRisk)

  const setPlan = (next: Fleet) => { onVerdict({ plan: planToStore(next, run), acceptRisk: false }) }
  // Риск принимают за прежний состав; снятая галочка возвращает рекомендацию.
  const setRisk = (accept: boolean) => { onVerdict({ plan: accept ? run.from : null, acceptRisk: accept }) }
  return (
    <>
      <VerdictCard run={run} />
      {action !== 'closed' && (
        <>
          <PlanCard
            run={run}
            fromMatching={fromMatching}
            plan={plan}
            acceptRisk={acceptRisk && canAcceptRisk(run)}
            canEdit={canEdit}
            onPlan={setPlan}
            onAcceptRisk={setRisk}
          />
          <EconomicsCard variant={variant} plan={plan} />
        </>
      )}
      <VerdictActions {...props} />
    </>
  )
}
