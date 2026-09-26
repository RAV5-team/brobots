import type { FormulaStat } from '@/components/ui/FormulaStats'
import { formatNumber, formatRubCompact } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { staffTotals, volumeRates } from './processCalc'
import { parseDecimal, type ProcessForm } from './processForm'

const t = ru.processNew
const DASH = t.staffTable.none
const MLN = { perYear: true, fractionDigits: 1 } as const

/** Число поля как введено, но в едином формате: «2 000», «1,5»; пусто — прочерк. */
const shown = (raw: string, digits = 2): string => {
  const value = parseDecimal(raw)
  return value === null ? DASH : formatNumber(value, digits)
}

/** Три расчётных значения секции 2 с формулой на подставленных числах (PRD 9.2). */
export function volumeStats(form: ProcessForm): readonly FormulaStat[] {
  const s = t.volumeStats
  const rates = volumeRates(form)
  const automation = parseDecimal(form.automationPct)
  const share = automation === null ? DASH : formatNumber(automation / 100, 2)
  const volume = shown(form.dailyVolume)
  const hours = shown(form.workHours)
  const value = (n: number | undefined, unit: (v: string) => string) => (n === undefined ? DASH : unit(formatNumber(n)))
  return [
    { key: 'peak', label: s.peak, value: value(rates?.peak, s.opsPerHour), formula: s.peakFormula(volume, hours, shown(form.peakFactor)) },
    {
      key: 'toRobots',
      label: s.toRobots,
      value: value(rates?.toRobots, s.tripsPerHour),
      // В формуле — округлённая пиковая, как в макете; результат считается от точной (PRD 15 · №36, D-19).
      formula: s.toRobotsFormula(rates ? formatNumber(rates.peak) : DASH, share),
    },
    { key: 'average', label: s.average, value: value(rates?.average, s.opsPerHour), formula: s.averageFormula(volume, share, hours) },
  ]
}

/** Итоги по персоналу; при одной группе формула на подставленных числах, как в макете (15935:1161). */
export function staffStats(form: ProcessForm, payrollCoef: number): readonly FormulaStat[] {
  const st = t.staffStats
  const totals = staffTotals(form, payrollCoef)
  if (!totals) {
    return [{ key: 'fte', label: st.fte, value: DASH, formula: st.notEnough }]
  }
  const automation = formatNumber((parseDecimal(form.automationPct) ?? 0) / 100, 2)
  const coef = formatNumber(payrollCoef, 3)
  const [only] = totals.rows.length === 1 ? totals.rows : []
  const fteText = formatNumber(totals.fte, 2)
  return [
    { key: 'fte', label: st.fte, value: fteText, formula: only ? st.fteFormula(formatNumber(only.headcount), `${formatNumber(only.share * 100)}%`, automation) : st.sumFormula },
    { key: 'base', label: st.baseFot, value: formatRubCompact(totals.baseFot, MLN), formula: only ? st.fotFormula(formatNumber(only.headcount), formatNumber(only.salaryRub), coef) : st.sumFormula },
    { key: 'target', label: st.targetFot, value: formatRubCompact(totals.targetFot, MLN), formula: only ? st.fotFormula(fteText, formatNumber(only.salaryRub), coef) : st.sumFormula },
  ]
}

