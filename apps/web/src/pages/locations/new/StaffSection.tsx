import { clsx } from 'clsx'
import { Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { FieldGrid, FormSection } from '@/components/ui/FormSection'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { TextButton } from '@/components/ui/TextLink'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import {
  STAFF_PRESETS,
  addStaffRow,
  fieldDomId,
  parameterRange,
  payrollCoef,
  removeStaffRow,
  updateStaffRow,
  type ParameterIndex,
  type Range,
  type StaffGroupRow,
} from './locationForm'
import { LocationNumberField, type LocationSectionProps } from './LocationSections'

const t = ru.locationNew
const s = t.staffTable
const THOUSAND = 1000

const span = (range: Range | null, divisor = 1): string =>
  range ? `${formatNumber(range.min / divisor)}–${formatNumber(range.max / divisor)}` : ''

interface RowHint {
  readonly text: string
  /** Оклад пуст, но понадобится позже — подсказка и поле подсвечены лаймом (15950:2121, 15950:2125). */
  readonly attention: boolean
}

/** Подсказка строки: диапазоны датасета (численность, оклад в тыс. ₽); без оклада — когда он понадобится (PRD 10.2). */
function rowHint(row: StaffGroupRow, params: ParameterIndex): RowHint | null {
  const preset = STAFF_PRESETS.find((p) => p.headcountCode === row.key)
  const people = preset ? span(parameterRange(preset.headcountCode, params)) : ''
  if (row.salary.trim() === '') return { text: s.salaryLater(people), attention: true }
  if (!preset) return null
  const salary = preset.salaryCode === null ? null : span(parameterRange(preset.salaryCode, params), THOUSAND)
  return { text: s.hint(people, salary), attention: false }
}

function StaffGroupTableRow({ row, form, errors, update, params }: LocationSectionProps & { readonly row: StaffGroupRow }) {
  const key = `staff:${row.key}`
  const hint = rowHint(row, params)
  const rowError = errors[`${key}:role`] ?? errors[`${key}:headcount`] ?? errors[`${key}:salary`]
  const change = (patch: Partial<Pick<StaffGroupRow, 'role' | 'headcount' | 'salary'>>) => {
    update({ staff: updateStaffRow(form.staff, row.key, patch) })
  }
  return (
    <TableRow>
      <TableCell>
        {/* В режиме просмотра 17а (`fieldset disabled`) роль и подсказка приглушены вместе с полями строки (16068:378). */}
        <div className="flex flex-col gap-4 in-[fieldset:disabled]:opacity-(--rav-disabled-opacity)">
          {row.preset ? (
            <span className="font-semibold">{row.role}</span>
          ) : (
            <Input
              id={fieldDomId(`${key}:role`)}
              aria-label={s.roleLabel}
              placeholder={s.rolePlaceholder}
              invalid={errors[`${key}:role`] !== undefined}
              value={row.role}
              onChange={(e) => { change({ role: e.target.value }) }}
            />
          )}
          {rowError ? (
            <span role="alert" className="type-caption font-medium text-danger">{rowError}</span>
          ) : (
            hint && <span className={clsx('type-caption', hint.attention ? 'text-on-accent' : 'text-text-muted')}>{hint.text}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-(--rav-location-staff-count-width)">
        <Input
          id={fieldDomId(`${key}:headcount`)}
          inputMode="numeric"
          autoComplete="off"
          aria-label={s.headcountLabel(row.role)}
          invalid={errors[`${key}:headcount`] !== undefined}
          suffix={s.people}
          value={row.headcount}
          onChange={(e) => { change({ headcount: e.target.value }) }}
        />
      </TableCell>
      <TableCell className="w-(--rav-location-staff-salary-width)">
        <Input
          id={fieldDomId(`${key}:salary`)}
          inputMode="numeric"
          autoComplete="off"
          aria-label={s.salaryLabel(row.role)}
          invalid={errors[`${key}:salary`] !== undefined}
          attention={hint?.attention === true}
          placeholder={s.empty}
          suffix={s.salaryUnit}
          value={row.salary}
          onChange={(e) => { change({ salary: e.target.value }) }}
        />
      </TableCell>
      <TableCell className="w-36">
        <IconButton
          size={24}
          variant="ghost"
          icon={X}
          label={s.removeLabel(row.role)}
          onClick={() => { update({ staff: removeStaffRow(form.staff, row.key) }) }}
        />
      </TableCell>
    </TableRow>
  )
}

/** Таблица групп персонала (15950:2090): утопленная подложка, правило и «+ Добавить группу персонала» под таблицей. */
function StaffGroupsTable(props: LocationSectionProps) {
  const { form, errors, update } = props
  const ruleError = errors.staff
  return (
    <div id={fieldDomId('staff')} tabIndex={-1} className="flex flex-col rounded-lg bg-surface-sunken px-16 py-8 outline-none">
      <Table caption={s.caption} layout="fixed">
        <TableHead>
          <TableRow>
            <TableHeaderCell tone="label">{s.role}</TableHeaderCell>
            <TableHeaderCell tone="label" className="w-(--rav-location-staff-count-width)">{s.headcount}</TableHeaderCell>
            <TableHeaderCell tone="label" className="w-(--rav-location-staff-salary-width)">{s.salary}</TableHeaderCell>
            <TableHeaderCell tone="label" className="w-36"><span className="sr-only">{s.remove}</span></TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {form.staff.map((row) => <StaffGroupTableRow key={row.key} row={row} {...props} />)}
        </TableBody>
      </Table>
      <p role={ruleError ? 'alert' : undefined} className={clsx('pt-8 type-caption', ruleError ? 'font-medium text-danger' : 'text-text-secondary')}>
        {ruleError ?? s.rule}
      </p>
      <TextButton icon={Plus} className="self-start py-12" onClick={() => { update({ staff: addStaffRow(form.staff) }) }}>
        {s.add}
      </TextButton>
    </div>
  )
}

/** Норматив начислений на ФОТ: только чтение, плашка «норматив» (15950:2081; PRD 6.8). */
function PayrollField({ params }: { readonly params: ParameterIndex }) {
  const coef = payrollCoef(params)
  if (coef === null) return null
  return (
    <Field label={t.payroll.label} hint={t.payroll.hint} badge={<Badge kind="norm" />}>
      <Input computed suffix={t.payroll.unit} value={formatNumber(coef, 3)} />
    </Field>
  )
}

/** Секция 4 «Персонал» (PRD 10.2; 15950:2069): численность и норматив, таблица групп, поля под таблицей. */
export function StaffSection(props: LocationSectionProps) {
  return (
    <FormSection id="staff" title={t.sections.staff.title} description={t.sections.staff.description}>
      <FieldGrid>
        <LocationNumberField name="staffTotal" {...props} />
        <PayrollField params={props.params} />
      </FieldGrid>
      <StaffGroupsTable {...props} />
      <FieldGrid>
        <LocationNumberField name="pickerProductivity" {...props} />
        <LocationNumberField name="workTimeLoss" {...props} />
        <LocationNumberField name="turnover" {...props} />
      </FieldGrid>
    </FormSection>
  )
}

