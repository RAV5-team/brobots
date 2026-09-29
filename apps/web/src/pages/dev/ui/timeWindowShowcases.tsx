import { useState } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { TimeWindowList, type TimeWindow } from '@/components/ui/TimeWindowList'
import { ShowcaseSection } from './StateGrid'

/** Окна по макету 3.2 (16325:158): 08–11, 13–15, 19–22, 01–03. */
const BOARD_WINDOWS: readonly TimeWindow[] = [{ from: 8, to: 11 }, { from: 13, to: 15 }, { from: 19, to: 22 }, { from: 1, to: 3 }]

/** «Пиковые часы» 3.2: приёмка — список окон; отгрузка — те же окна, пока отмечен флажок (список заблокирован). */
function PeakWindowsDemo() {
  const [inbound, setInbound] = useState<readonly TimeWindow[]>(BOARD_WINDOWS)
  const [outbound, setOutbound] = useState<readonly TimeWindow[]>(BOARD_WINDOWS)
  const [same, setSame] = useState(true)
  return (
    <div className="grid grid-cols-2 gap-24">
      <div className="flex flex-col gap-12">
        <span className="type-caption text-text-secondary">Приёмка</span>
        <TimeWindowList label="Приёмка" windows={inbound} onChange={setInbound} />
      </div>
      <div className="flex flex-col gap-12">
        <Checkbox label="Отгрузка в те же часы, что приёмка" checked={same} onCheckedChange={setSame} />
        <TimeWindowList label="Отгрузка" windows={same ? inbound : outbound} onChange={setOutbound} disabled={same} />
      </div>
    </div>
  )
}

function EmptyDemo() {
  const [windows, setWindows] = useState<readonly TimeWindow[]>([])
  return <TimeWindowList label="Приёмка" windows={windows} onChange={setWindows} />
}

export function TimeWindowListShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="TimeWindowList · обычный и заблокированный (3.2)">
        <PeakWindowsDemo />
      </ShowcaseSection>
      <ShowcaseSection title="TimeWindowList · readOnly">
        <TimeWindowList label="Приёмка" windows={BOARD_WINDOWS} readOnly />
      </ShowcaseSection>
      <ShowcaseSection title="TimeWindowList · пустой список">
        <EmptyDemo />
      </ShowcaseSection>
    </div>
  )
}
