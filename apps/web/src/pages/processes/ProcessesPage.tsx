import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { ProcessCard } from './ProcessCard'
import { ProcessFilters } from './ProcessFilters'
import { EMPTY_FILTER, filterProcesses, isFilterActive, type ProcessFilter } from './processesModel'
import { useProcesses, type ProcessesData } from './useProcesses'

const t = ru.processes
const SKELETON_CARDS = [0, 1, 2]

function ProcessesSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-16" aria-busy="true">
      {SKELETON_CARDS.map((i) => <Skeleton key={i} className="h-48" />)}
    </div>
  )
}

interface ProcessGridProps {
  readonly data: ProcessesData
  readonly filter: ProcessFilter
  readonly onReset: () => void
}

function ProcessGrid({ data, filter, onReset }: ProcessGridProps) {
  if (data.processes.length === 0) return <EmptyState title={t.empty.title} description={t.empty.description} />

  const visible = filterProcesses(data.processes, filter)
  if (visible.length === 0) {
    return (
      <EmptyState
        title={t.notFound.title}
        description={t.notFound.description}
        action={isFilterActive(filter) && <Button onClick={onReset}>{t.notFound.reset}</Button>}
      />
    )
  }

  return (
    // Ряды одной высоты: в макете все карточки 816 px, «Подробнее» прижата к низу.
    <ul aria-label={t.listLabel} className="grid auto-rows-fr grid-cols-3 gap-16">
      {visible.map((process) => (
        <li key={process.code}>
          <ProcessCard
            process={process}
            operationClass={data.operationClasses.find((c) => c.code === process.operationClass)}
            robotCount={data.robotsByClass[process.operationClass] ?? 0}
          />
        </li>
      ))}
    </ul>
  )
}

/** Экран 07 «Процессы · список» — библиотека процессов (PRD 9.1; 15935:268). */
export function ProcessesPage() {
  const role = useRole()
  const { state, retry } = useProcesses()
  const [filter, setFilter] = useState<ProcessFilter>(EMPTY_FILTER)

  return (
    <>
      <header className="flex flex-col gap-8">
        <h1 className="type-display-lg text-text">{t.title}</h1>
        <p className="type-body text-text-secondary">{t.lead}</p>
      </header>

      {state.status === 'loading' && <ProcessesSkeleton />}
      {state.status === 'error' && <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />}
      {state.status === 'ready' && (
        <div className="flex flex-col gap-12">
          <ProcessFilters
            filter={filter}
            onChange={setFilter}
            operationClasses={state.operationClasses}
            facilityTypes={state.facilityTypes}
            // Гостю — демо-процессы без сохранения (PRD 9.1, D-14): своих процессов он не заводит (D-30).
            canCreate={role !== 'guest'}
          />
          <ProcessGrid data={state} filter={filter} onReset={() => { setFilter(EMPTY_FILTER) }} />
        </div>
      )}
    </>
  )
}
