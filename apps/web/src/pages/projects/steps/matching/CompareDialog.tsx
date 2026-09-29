import { CompareTable, type CompareColumn } from '@/components/ui/CompareTable'
import { Modal, type ModalColumns } from '@/components/ui/Modal'
import { ErrorState, Skeleton } from '@/components/ui/States'
import type { MatchBaseline, SiteFacts } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { compareGroups, type CompareEntry } from './compareModel'
import { useCharacteristicContext } from './useCharacteristicContext'

const t = ru.project.matching
const c = t.compare

interface CompareDialogProps {
  readonly entries: readonly CompareEntry[]
  readonly catalogVersion: string
  readonly baseline: MatchBaseline | null
  readonly horizonYears: number
  readonly site: SiteFacts
  readonly widthMarginM: number
  /** «×» и Esc — назад к 2.1: режим «Сравнить» и отметки сохраняются. */
  readonly onClose: () => void
}

/** Ширина окна по числу колонок: 2 / 3 / 4 варианта — 640 / 820 / 1000 (решение №7, пересматривает D-96). */
const columnsOf = (count: number): ModalColumns => (count >= 4 ? 4 : count === 3 ? 3 : 2)

/**
 * Окно 2.1б «Сравнение вариантов» (16833:10; PRD 11.3): 2–4 варианта из режима «Сравнить» рейтинга 2.1 —
 * экономика, техника, инфраструктура и данные. Таблица — `CompareTable`, ячейки соответствия и серые оценки — как в К-3.
 */
export function CompareDialog({ entries, catalogVersion, baseline, horizonYears, site, widthMarginM, onClose }: CompareDialogProps) {
  const load = useCharacteristicContext(catalogVersion)
  const columns: CompareColumn[] = entries.map((e) => ({
    key: e.key,
    label: e.name,
    header: <span className="block px-12 type-body font-semibold text-text">{e.name}</span>,
    ...(e.violations ? { caption: <span className="block px-12">{c.outOfRanking}</span> } : {}),
  }))
  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      size="detail"
      columns={columnsOf(entries.length)}
      title={c.title}
      description={c.lead(formatCount(entries.length, t.plural.variants))}
    >
      {load.status === 'loading'
        ? <div aria-busy="true"><Skeleton className="h-(--rav-location-card-height)" /></div>
        : load.status === 'error'
          ? <ErrorState title={t.details.loadError} message={t.loadError.message} />
          : (
              <CompareTable
                caption={c.caption}
                columns={columns}
                groups={compareGroups(entries, { characteristics: load.ctx, baseline, horizonYears, site, widthMarginM })}
                labelWidth="compact"
              />
            )}
    </Modal>
  )
}
