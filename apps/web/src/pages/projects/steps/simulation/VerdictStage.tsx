import type { ReactNode } from 'react'
import { canProceedToEconomics, type Fleet, type RankedVariant, type SimulationRun } from '@/domain'
import { CalibrationCard } from './CalibrationCard'
import { VerdictCard } from './VerdictCard'
import { VerdictRail } from './VerdictRail'

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

interface BoardVerdictProps extends VerdictStageProps {
  /** Принятые поправки методики; null — не выбирали: отмеченные движком по умолчанию. */
  readonly calibration: readonly string[] | null
  readonly onCalibration: (codes: readonly string[]) => void
  /** Раскладка экрана: вердикт и методика — в основную колонку, состав, экономика и действия — в правую. */
  readonly layout: (body: ReactNode, rail: ReactNode) => ReactNode
}

/**
 * Этап 4 «Вердикт», вкладка «Вердикт и действия» (3.4 need_more, 16325:176; 3.6 confirmed, 16325:194; PRD 11.4; D-104):
 * одна вёрстка для всех пяти вердиктов. Слева — что показала симуляция и «Уточнить методику», справа — состав, экономика
 * и действия. 07b — принять риск, 07c — свой состав и повторный прогон.
 */
export function VerdictStage({ calibration, onCalibration, layout, ...props }: BoardVerdictProps) {
  const { run, canEdit } = props
  const selected = calibration ?? run.adjustments.filter((a) => a.defaultSelected).map((a) => a.code)
  const body = (
    <>
      <VerdictCard run={run} />
      {/* Поправки уходят в экономику: у закрытых вердиктов (узкое место, недостижимо) переход к ней закрыт — блока нет. */}
      {run.adjustments.length > 0 && canProceedToEconomics(run.verdict) && (
        <CalibrationCard adjustments={run.adjustments} selected={selected} canEdit={canEdit} onChange={onCalibration} />
      )}
    </>
  )
  return layout(body, <VerdictRail {...props} />)
}
