import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { TimeWindowList, type TimeWindow } from '@/components/ui/TimeWindowList'
import { addWindow, hoursOfWindows, windowsOfHours } from '@/components/ui/timeWindows'
import type { PeakHours } from '@/domain'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.simulation.conditions.peaks

type Flow = keyof PeakHours

const key = (hours: readonly number[]): string => hours.join(',')
const sameHours = (peaks: PeakHours): boolean => key(peaks.inbound) === key(peaks.outbound)

/**
 * Окна потока: пока их часы совпадают с сохранёнными, показываем окна как их набрал пользователь — иначе новое окно
 * сразу слилось бы с соседним (08–11 и 11–12 — одно окно 08–12). Сохранённые часы сменились извне («Вернуть как в
 * расчёте», другой черновик) — окна собираются из часов заново.
 */
function useFlowWindows(hours: readonly number[]) {
  const [draft, setDraft] = useState<{ readonly hours: string; readonly windows: readonly TimeWindow[] } | null>(null)
  const windows = draft !== null && draft.hours === key(hours) ? draft.windows : windowsOfHours(hours)
  const remember = (next: readonly TimeWindow[]): readonly number[] => {
    const nextHours = hoursOfWindows(next)
    setDraft({ hours: key(nextHours), windows: next })
    return nextHours
  }
  return { windows, remember }
}

interface PeakWindowsProps {
  readonly peaks: PeakHours
  /** Пики как в расчёте — «Вернуть как в расчёте» не нужна (D-102). */
  readonly isDefault: boolean
  readonly error: string | null
  readonly canEdit: boolean
  readonly onChange: (peaks: PeakHours) => void
  readonly onReset: () => void
}

/**
 * Пиковые окна «Расписания» (3.2, 16325:158): колонки приёмки и отгрузки из окон «08:00 — 11:00», флажок «Отгрузка в те же
 * часы, что приёмка» блокирует вторую колонку. В данных — набор часов `PeakHours` (D-102): окно — только способ его набрать.
 */
export function PeakWindows({ peaks, isDefault, error, canEdit, onChange, onReset }: PeakWindowsProps) {
  const inbound = useFlowWindows(peaks.inbound)
  const outbound = useFlowWindows(peaks.outbound)
  // Флажок — выбор пользователя, а не равенство часов: снятый флажок с совпавшими пока окнами не должен отмечаться сам.
  const [linked, setLinked] = useState(() => sameHours(peaks))
  const isLinked = linked && sameHours(peaks)

  const setInbound = (next: readonly TimeWindow[]) => {
    const hours = inbound.remember(next)
    if (isLinked) outbound.remember(next)
    onChange({ inbound: hours, outbound: isLinked ? hours : peaks.outbound })
  }
  const setOutbound = (next: readonly TimeWindow[]) => { onChange({ ...peaks, outbound: outbound.remember(next) }) }
  const link = (checked: boolean) => {
    setLinked(checked)
    if (checked) onChange({ ...peaks, outbound: peaks.inbound })
  }
  const column = (flow: Flow, header: ReactNode, windows: readonly TimeWindow[], onFlow: (next: readonly TimeWindow[]) => void, locked: boolean) => (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex h-24 items-center">{header}</div>
      <TimeWindowList
        label={t[flow]}
        windows={windows}
        readOnly={!canEdit}
        // Общая «Добавить окно» стоит под колонками; у отгрузки со своими часами — своя под списком.
        showAdd={flow === 'outbound' && !isLinked}
        // Заблокированная отгрузка — без onChange, а не `disabled`: у `disabled` длительность «4 ч» в `text-disabled`
        // не проходит контраст axe (поля и так недоступны: TimeWindowList блокирует их без onChange).
        {...(canEdit && !locked ? { onChange: onFlow } : {})}
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-12">
      <div className="grid grid-cols-2 items-start gap-16">
        {column('inbound', <span className="type-caption font-medium text-text-secondary">{t.inbound}</span>, inbound.windows, setInbound, false)}
        {column(
          'outbound',
          canEdit ? <Checkbox label={t.same} checked={isLinked} onCheckedChange={link} /> : <span className="type-caption font-medium text-text-secondary">{t.outbound}</span>,
          isLinked ? inbound.windows : outbound.windows,
          setOutbound,
          isLinked,
        )}
      </div>
      {error && <p role="alert" className="type-caption font-medium text-danger">{error}</p>}
      {canEdit && (
        <div className="flex justify-end gap-12">
          {!isDefault && <Button onClick={onReset}>{t.reset}</Button>}
          <Button onClick={() => { setInbound(addWindow(inbound.windows)) }}>{ru.ui.timeWindows.add}</Button>
        </div>
      )}
    </div>
  )
}
