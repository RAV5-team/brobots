import { clsx } from 'clsx'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field } from '@/components/ui/Field'
import { FormulaStats } from '@/components/ui/FormulaStats'
import { Input } from '@/components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { HandlingMethod } from '@/domain'
import { formatNumber, formatRub } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { FieldGrid, FormSection, NumberField, type SectionProps } from './FormParts'
import { replaceableMethods, updateStaffRow, type StaffRow } from './processForm'
import { staffStats } from './processStats'

const t = ru.processNew
const s = t.staffTable
/** Звёздочка не отрывается от подписи колонки при переносе. */
const NBSP_STAR = '\u00a0*'

/** Строка группы: выбранная — полужирная, с полем доли времени (15935:1138); остальные — приглушённые. */
function StaffTableRow({ row, form, errors, update }: { readonly row: StaffRow } & Pick<SectionProps, 'form' | 'errors' | 'update'>) {
  const shareError = errors[`staff:${row.role}`]
  return (
    <TableRow selected={row.selected}>
      <TableCell className="w-36">
        <Checkbox
          label={row.role}
          hideLabel
          checked={row.selected}
          onCheckedChange={(selected) => { update({ staff: updateStaffRow(form, row.role, { selected }).staff }) }}
        />
      </TableCell>
      <TableCell className={clsx(row.selected ? 'font-semibold' : 'text-text-secondary')}>{row.role}</TableCell>
      <TableCell className="w-(--rav-staff-count-width) text-text-secondary">{s.people(formatNumber(row.headcount))}</TableCell>
      <TableCell className={clsx('w-(--rav-staff-salary-width)', row.salaryRub === null ? 'text-text-muted' : 'text-text-secondary')}>
        {row.salaryRub === null ? s.salaryMissing : formatRub(row.salaryRub)}
      </TableCell>
      <TableCell className="w-(--rav-staff-share-width)">
        {row.selected ? (
          <Input
            inputMode="decimal"
            aria-label={s.timeShareLabel(row.role)}
            invalid={shareError !== undefined}
            suffix="%"
            value={row.timeSharePct}
            onChange={(e) => { update({ staff: updateStaffRow(form, row.role, { timeSharePct: e.target.value }).staff }) }}
          />
        ) : (
          <span className="text-text-muted">{s.none}</span>
        )}
      </TableCell>
    </TableRow>
  )
}

/** Таблица групп из профиля (15935:1131): вдавленная подложка, подписи колонок без капса. */
function StaffTable(props: SectionProps) {
  const error = props.errors.staff ?? Object.entries(props.errors).find(([key]) => key.startsWith('staff:'))?.[1]
  return (
    <div className="flex flex-col rounded-lg bg-surface-sunken px-16 py-8">
      <Table caption={s.caption} layout="fixed">
        <TableHead>
          <TableRow>
            <TableHeaderCell tone="label" className="w-36"><span className="sr-only">{s.select}</span></TableHeaderCell>
            <TableHeaderCell tone="label">{s.role}</TableHeaderCell>
            <TableHeaderCell tone="label" className="w-(--rav-staff-count-width)">{s.headcount}</TableHeaderCell>
            <TableHeaderCell tone="label" className="w-(--rav-staff-salary-width)">{s.salary}<span aria-hidden>{NBSP_STAR}</span></TableHeaderCell>
            <TableHeaderCell tone="label" className="w-(--rav-staff-share-width)">{s.timeShare}<span aria-hidden>{NBSP_STAR}</span></TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.form.staff.map((row) => <StaffTableRow key={row.role} row={row} {...props} />)}
        </TableBody>
      </Table>
      <p role={error ? 'alert' : undefined} className={clsx('pt-8 pb-4 type-caption', error ? 'font-medium text-danger' : 'text-text-muted')}>
        {error ?? s.note}
      </p>
    </div>
  )
}

interface StaffSectionProps extends SectionProps {
  readonly handlingMethods: readonly HandlingMethod[]
  readonly payrollCoef: number
}

/** Секция 4 «Исполнители и замещение труда» (PRD 9.2; 15935:1127). Коэффициент — строкой на каждый выбранный способ. */
export function StaffSection({ handlingMethods, payrollCoef, ...props }: StaffSectionProps) {
  const { form, errors, update } = props
  const selected = replaceableMethods(form)
  const methodName = (code: string) => handlingMethods.find((m) => m.code === code)?.name ?? code
  const others = handlingMethods
    .filter((m) => m.code !== 'none' && !selected.includes(m.code) && form.replacement[m.code] !== undefined)
    .map((m) => t.replacementOther(m.name, form.replacement[m.code] ?? ''))
    .join(' · ')
  return (
    <FormSection id="staff" title={t.sections.staff.title} description={t.sections.staff.description(others)}>
      <StaffTable {...props} />
      <FormulaStats label={t.staffStats.label} stats={staffStats(form, payrollCoef)} />
      <FieldGrid>
        {selected.map((method) => (
          <Field
            key={method}
            label={t.replacementLabel(methodName(method))}
            hint={t.replacementHints[method]}
            error={errors[`replacement:${method}`]}
          >
            <Input
              inputMode="decimal"
              suffix={t.replacementUnit}
              value={form.replacement[method] ?? ''}
              onChange={(e) => { update({ replacement: { ...form.replacement, [method]: e.target.value } }) }}
            />
          </Field>
        ))}
        <NumberField name="turnoverPct" {...props} />
        <NumberField name="workTimeLossPct" {...props} />
      </FieldGrid>
    </FormSection>
  )
}
