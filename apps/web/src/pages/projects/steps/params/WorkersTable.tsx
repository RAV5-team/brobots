import { Table, TableBody, TableCell, TableHead, TableHeaderCell } from '@/components/ui/Table'
import type { ParamsProcessEntry, ProjectParamsSnapshot } from '@/domain'
import { formatCount, formatNumber, formatRub } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { locationNumber, processStaff, valueAnchor, type AssumptionRow } from './paramsModel'

const t = ru.project.params

interface WorkersTableProps {
  readonly entry: ParamsProcessEntry
  readonly snapshot: ProjectParamsSnapshot
  readonly assumptions: readonly AssumptionRow[]
}

/**
 * Группа «Исполнители» (16992:462): группа персонала локации, численность, оклад, доля времени.
 * Нет исполнителей или оклада — ячейка-якорь для «↓» из поповера статуса.
 */
export function WorkersTable({ entry, snapshot, assumptions }: WorkersTableProps) {
  const staff = processStaff(entry, snapshot)
  if (staff?.headcount == null) {
    return (
      <p id={valueAnchor('workers')} tabIndex={-1} className="flex flex-col rounded-xs py-8">
        <span className="type-body font-semibold text-text">{t.workers.none}</span>
        <span className="type-caption text-text-muted">{t.workers.bindHint}</span>
      </p>
    )
  }
  const share = assumptions.find((a) => a.code === 'operator_time_share_pct')?.value ?? staff.timeShare * 100
  const shifts = locationNumber(snapshot, 'wh_shifts')
  return (
    <div className="flex flex-col gap-8">
      <Table caption={t.groupTitles.workers ?? ''} layout="fixed">
        <TableHead>
          <tr>
            <TableHeaderCell>{t.workers.group}</TableHeaderCell>
            <TableHeaderCell align="end" className="w-(--rav-location-staff-count-width)">{t.workers.headcount}</TableHeaderCell>
            <TableHeaderCell align="end" className="w-(--rav-location-staff-salary-width)">{t.workers.salary}</TableHeaderCell>
            <TableHeaderCell className="w-(--rav-staff-share-width) pl-12">{t.workers.share}</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {/* Одна группа персонала — строка без разделителя и без подсветки: TableRow рисует границу снизу. */}
          <tr>
            <TableCell className="font-semibold">{staff.role}</TableCell>
            <TableCell align="end">
              <span className="block font-semibold">{formatNumber(staff.headcount)}</span>
              {shifts !== null && <span className="block type-caption whitespace-nowrap text-text-secondary">{t.workers.shifts(formatCount(shifts, ru.plural.shifts))}</span>}
            </TableCell>
            {staff.salaryRub === null
              ? (
                  <TableCell id={valueAnchor('salary')} tabIndex={-1} align="end">
                    <span className="block text-text-muted">{t.workers.noSalary}</span>
                    <span className="block type-caption text-text-muted">{t.workers.fillInStaff}</span>
                  </TableCell>
                )
              : <TableCell align="end" className="font-semibold">{formatRub(staff.salaryRub)}</TableCell>}
            <TableCell className="pl-12 font-medium">{formatNumber(share)} %</TableCell>
          </tr>
        </TableBody>
      </Table>
      <p className="type-caption text-text-muted">{t.workers.source}</p>
    </div>
  )
}
