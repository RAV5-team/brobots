import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressPanel } from '@/components/ui/ProgressPanel'
import { EmptyState, ErrorState } from '@/components/ui/States'
import type { SimulationRunProgress } from '@/services'
import { SIMULATION_TIME_LIMIT_S } from '@/services/simulationRuns'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { Fleet } from '@/domain'
import { runPercent, runSteps } from './runModel'

const t = ru.project.simulation.run
const LIMIT = formatNumber(SIMULATION_TIME_LIMIT_S)

interface RunStageProps {
  /** Прогон, за которым следит SimulationRunService; null — не запускали в этой сессии или остановили. */
  readonly progress: SimulationRunProgress | null
  /** Последний записанный прогон проекта. */
  readonly lastRunId: string | null
  /** Состав или условия изменились после последнего прогона (D-89). */
  readonly stale: boolean
  /** Сохранённая оценка — только просмотр (D-17). */
  readonly readOnly: boolean
  /** Адрес этапа «Вердикт». */
  readonly verdictTo: string
  /** Запустить прогон; undefined — данные для запроса ещё не загрузились. */
  readonly onStart: (() => void) | undefined
  readonly onStop: () => void
  readonly onConditions: () => void
  /** Состав прогона и состав из подбора — для строки состояния; null — данные шага ещё не загрузились. */
  readonly fleet: { readonly checked: Fleet; readonly fromMatching: Fleet } | null
}

function Actions({ children }: { readonly children: ReactNode }) {
  return <div className="flex items-center justify-end gap-12">{children}</div>
}

function VerdictLink({ to }: { readonly to: string }) {
  return (
    <ButtonLink variant="primary" to={to}>
      {t.toVerdict}
      <ArrowRight aria-hidden size={16} />
    </ButtonLink>
  )
}

function ConditionsButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <Button onClick={onClick}>
      <ArrowLeft aria-hidden size={16} />
      {t.toConditions}
    </Button>
  )
}

function errorMessage(progress: Extract<SimulationRunProgress, { status: 'error' }>): string {
  switch (progress.reason) {
    case 'timeout': return t.error.timeout(LIMIT)
    case 'save': return t.error.save
    case 'failed': return progress.message ?? t.error.failed
  }
}

/** Без прогона в этой сессии: выполненный прогон, пустое состояние с запуском или только просмотр. */
function NoRun({ lastRunId, stale, readOnly, verdictTo, onStart, onConditions }: Omit<RunStageProps, 'progress' | 'onStop' | 'fleet'>) {
  if (lastRunId && readOnly) {
    return <EmptyState title={t.saved.title(lastRunId)} description={t.saved.description} action={<VerdictLink to={verdictTo} />} />
  }
  if (lastRunId && !stale) {
    return (
      <EmptyState
        title={t.last.title(lastRunId)}
        description={t.last.description}
        action={(
          <div className="flex flex-wrap justify-center gap-12">
            {onStart && <Button onClick={onStart}><RotateCcw aria-hidden size={16} />{t.restart}</Button>}
            <VerdictLink to={verdictTo} />
          </div>
        )}
      />
    )
  }
  return (
    <EmptyState
      title={t.idle.title}
      description={t.idle.description}
      action={readOnly ? undefined : (
        <div className="flex flex-wrap justify-center gap-12">
          <ConditionsButton onClick={onConditions} />
          <Button variant="primary" disabled={!onStart} onClick={onStart}>{t.idle.action}<ArrowRight aria-hidden size={16} /></Button>
        </div>
      )}
    />
  )
}

function RunProgress({ progress, fleet, verdictTo, onStop, onConditions }: Pick<RunStageProps, 'fleet' | 'verdictTo' | 'onStop' | 'onConditions'> & {
  readonly progress: Exclude<SimulationRunProgress, { status: 'error' }>
}) {
  const running = progress.status === 'running'
  return (
    <>
      {/* data-run-status — готовность для эталона: ждать атрибут, а не заголовок или время. */}
      <Card as="div" padding={28} gap={20} data-run-status={progress.status}>
        <ProgressPanel
          headingLevel={2}
          title={running ? t.running : t.done}
          label={t.progressLabel(LIMIT)}
          value={runPercent(progress, SIMULATION_TIME_LIMIT_S)}
          meta={t.seconds(formatNumber(progress.elapsedS))}
          log={runSteps(progress, fleet?.checked ?? null, fleet?.fromMatching ?? null)}
          logLabel={t.log}
          busy={running}
        />
        <Explain />
      </Card>
      <Actions>
        {running
          ? <Button onClick={onStop}>{t.stop}</Button>
          : <><ConditionsButton onClick={onConditions} /><VerdictLink to={verdictTo} /></>}
      </Actions>
    </>
  )
}

/** Пояснение под плашкой прогона (16405:339): как моделируются сутки и сколько это длится. */
function Explain() {
  return <p className="type-caption text-text-secondary">{t.explain}</p>
}

/**
 * Этап 3 «Моделирование» (3.3, 16325:167; PRD 11.4; D-103): светлая карточка — плашка прогона с полосой,
 * секундами и журналом шагов, под ней пояснение; `aria-busy` во время прогона. По завершении — итог и «Смотреть
 * вердикт» (автопереход к вердикту с доски ждёт решения 10); этап 4 уже записан в черновик.
 */
export function RunStage(props: RunStageProps) {
  const { progress, onStart, onConditions } = props
  if (progress === null) {
    return (
      <>
        <NoRun {...props} />
        <Explain />
      </>
    )
  }
  if (progress.status === 'error') {
    return (
      <>
        <ErrorState title={t.error.title} message={errorMessage(progress)} {...(onStart ? { onRetry: onStart } : {})} />
        <Actions><ConditionsButton onClick={onConditions} /></Actions>
      </>
    )
  }
  return <RunProgress progress={progress} fleet={props.fleet} verdictTo={props.verdictTo} onStop={props.onStop} onConditions={onConditions} />
}
