import { ArrowRight, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ru } from '@/shared/i18n/ru'
import type { VerdictStageProps } from './VerdictStage'
import { planToStore, sameFleet, verdictAction } from './verdictModel'

const t = ru.project.simulation.verdict

export type VerdictActionsProps = Omit<VerdictStageProps, 'variant'>

/** Узкое место и недостижимо: к экономике не перейти — только другие условия или другое решение (PRD 11.4). */
function ClosedActions({ conditionsTo, matchingTo }: Pick<VerdictActionsProps, 'conditionsTo' | 'matchingTo'>) {
  return (
    <div className="flex flex-col items-end gap-12">
      <p className="type-caption text-text-secondary">{t.actions.closed}</p>
      <div className="flex items-center gap-12">
        <ButtonLink to={conditionsTo}>{t.actions.conditions}</ButtonLink>
        <ButtonLink variant="primary" to={matchingTo}>
          {t.actions.otherSolution}
          <ArrowRight aria-hidden size={16} />
        </ButtonLink>
      </div>
    </div>
  )
}

/**
 * Действия вердикта — общие для вкладок «Вердикт и действия» (07) и «Графики и 2D-сравнение» (07a, 16198:845; D-105):
 * «Вернуть как в подборе» и главное действие плана — принять, принять с риском (07b) или прогнать свой состав (07c).
 */
export function VerdictActions(props: VerdictActionsProps) {
  const { run, fromMatching, plan, acceptRisk, canEdit, onVerdict, onAccept, onRerun } = props
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const action = verdictAction(run, plan, acceptRisk)
  if (action === 'closed') return <ClosedActions conditionsTo={props.conditionsTo} matchingTo={props.matchingTo} />

  const accept = () => {
    setAccepting(true)
    setAcceptError(null)
    onAccept().catch((error: unknown) => {
      console.error('Не удалось принять план вердикта', error)
      setAcceptError(t.accepted.failed)
      setAccepting(false)
    })
  }
  const primary = {
    accept: { label: canEdit ? t.actions.accept : t.actions.toEconomics, onClick: accept },
    acceptRisk: { label: t.actions.acceptRisk(plan.robots, plan.stations), onClick: accept },
    rerun: { label: t.actions.rerun, onClick: () => { onRerun(plan) } },
  } as const

  return (
    <div className="flex flex-col items-end gap-8">
      <div className="flex items-center gap-12">
        {canEdit && !acceptRisk && !sameFleet(plan, fromMatching) && (
          <Button onClick={() => { onVerdict({ plan: planToStore(fromMatching, run), acceptRisk: false }) }}>{t.actions.reset}</Button>
        )}
        <Button
          variant="primary"
          disabled={accepting || (action === 'rerun' && !canEdit)}
          onClick={primary[action].onClick}
        >
          {action === 'rerun' && <RotateCcw aria-hidden size={16} />}
          {primary[action].label}
          {action !== 'rerun' && <ArrowRight aria-hidden size={16} />}
        </Button>
      </div>
      {acceptError && <p role="alert" className="type-caption text-danger">{acceptError}</p>}
    </div>
  )
}
