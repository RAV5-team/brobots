import type { AcquisitionModel, CostItem, MatchBaseline, RankedVariant } from '@/domain'
import { formatCount, formatDate, formatNumber, formatPercent, formatRub, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { PeakDemand } from '../params/paramsModel'
import { rubMillions } from './matchingModel'

const t = ru.project.matching
const e = t.details.economics

/** Строка «подпись — значение» с пояснением под значением («оценка, допущение модели»). */
export interface DetailRow {
  readonly key: string
  readonly label: string
  /** null — «нет данных». */
  readonly value: string | null
  readonly caption?: string
}

/** Статья суммы: подпись слева, сумма справа; `total` — итоговая строка. */
export interface AmountRow {
  readonly key: string
  readonly label: string
  readonly value: string
  readonly total?: boolean
}

export interface EconomicsView {
  readonly price: readonly DetailRow[]
  readonly capex: { readonly title: string; readonly items: readonly AmountRow[] }
  readonly opex: { readonly title: string; readonly caption: string | null; readonly items: readonly AmountRow[] }
  readonly effect: readonly AmountRow[]
  /** Условия RaaS — только у варианта RaaS; `pending` — расчёт условий не отдал. */
  readonly raas: { readonly rows: readonly DetailRow[]; readonly pending: boolean } | null
  readonly formulas: readonly DetailRow[]
}

export interface EconomicsInput {
  readonly variant: RankedVariant
  /** Способы приобретения решения, которые есть в рейтинге: «Покупка, RaaS (расчётный сценарий)». */
  readonly acquisitions: readonly AcquisitionModel[]
  readonly baseline: MatchBaseline | null
  readonly horizonYears: number
  /** Пиковая потребность процесса — в формуле числа роботов; null — не посчитана. */
  readonly demand: PeakDemand | null
}

const money = (value: number): string => rubMillions(value)
const signed = (value: number): string => `${value < 0 ? '−' : '+'} ${rubMillions(Math.abs(value))}`
const sentence = (items: readonly string[]): string | null =>
  items.length === 0 ? null : items.join(', ').replace(/^./u, (c) => c.toLocaleUpperCase('ru'))

function priceRows(v: RankedVariant, acquisitions: readonly AcquisitionModel[]): readonly DetailRow[] {
  const p = v.priceOffer
  const own = v.ownership
  // У RaaS ПО и обслуживание входят в тариф: расчёт их отдельно не считает.
  const inTariff = v.acquisition === 'raas' ? e.inTariff : null
  const software = own && own.softwareOneOffRub !== null && own.softwareRubPerYear !== null
    ? e.softwareValue(money(own.softwareOneOffRub), money(own.softwareRubPerYear))
    : inTariff
  const vat = p?.vatIncluded == null ? null : p.vatIncluded ? e.vatIncluded : e.vatExcluded
  const implementation = own?.implementationRub
  const life = own?.serviceLifeYears
  return [
    { key: 'unitPrice', label: e.rows.unitPrice, value: p ? formatRub(p.unitPriceRub) : null },
    { key: 'currency', label: e.rows.currency, value: p ? e.rub : null },
    { key: 'vat', label: e.rows.vat, value: vat },
    { key: 'included', label: e.rows.included, value: p ? sentence(p.included) : null },
    { key: 'excluded', label: e.rows.excluded, value: p ? sentence(p.excluded) : null },
    { key: 'offer', label: e.rows.offer, value: p?.offerName ?? null },
    { key: 'source', label: e.rows.source, value: p ? (p.date ? `${p.source} · ${formatDate(p.date)}` : p.source) : null },
    { key: 'software', label: e.rows.software, value: software },
    {
      key: 'implementation', label: e.rows.implementation, value: implementation ? money(implementation.value) : null,
      ...(implementation?.note ? { caption: implementation.note } : {}),
    },
    { key: 'service', label: e.rows.service, value: own?.serviceRubPerYear == null ? inTariff : e.servicePerYear(money(own.serviceRubPerYear)) },
    { key: 'acquisition', label: e.rows.acquisition, value: acquisitions.map((a) => (a === 'raas' ? e.raasScenario : t.acquisition.purchase)).join(', ') },
    {
      key: 'serviceLife', label: e.rows.serviceLife, value: life ? formatCount(life.value, t.plural.years) : null,
      ...(life?.note ? { caption: life.assumption ? e.assumed(life.note) : life.note } : {}),
    },
  ]
}

const amounts = (items: readonly CostItem[]): readonly AmountRow[] => items.map((i) => ({ key: i.code, label: i.label, value: money(i.amountRub) }))

function opexCaption(v: RankedVariant, baseline: MatchBaseline | null): string | null {
  if (!baseline) return null
  const delta = v.opexRubPerYear - baseline.opexRubPerYear
  const share = formatPercent(Math.abs(delta) / baseline.opexRubPerYear, 0)
  return e.opexNow(money(baseline.opexRubPerYear), money(Math.abs(delta)), share, delta <= 0)
}

function effectRows(v: RankedVariant): readonly AmountRow[] {
  const items = (v.netEffectItems ?? []).map((i): AmountRow => ({ key: i.code, label: i.label, value: signed(i.amountRub) }))
  return [...items, { key: 'total', label: e.effectTotal, value: money(v.annualEffectRub), total: true }]
}

/** Условия RaaS (PRD 11.3, 12 строк). Платёж за парк — из варианта рейтинга, чтобы совпадал с 2.1. */
function raasRows(v: RankedVariant): { readonly rows: readonly DetailRow[]; readonly pending: boolean } | null {
  if (v.acquisition !== 'raas') return null
  const r = v.raasTerms
  const row = (key: keyof typeof e.raasRows, value: string | null, caption?: string): DetailRow =>
    ({ key, label: e.raasRows[key], value, ...(caption ? { caption } : {}) })
  const monthly = v.raasMonthlyRub === null ? null : rubMillions(v.raasMonthlyRub, 2)
  // Ждёт решения (proposed, поток B): условия RaaS в данных есть только у AMR 800 · RaaS — у остальных «нет данных».
  if (!r) return { pending: true, rows: [row('monthly', monthly)] }
  return {
    pending: false,
    rows: [
      row('tariff', e.tariffs[r.tariffStructure]),
      row('base', r.billingBase),
      row('rate', formatRub(r.rateRub)),
      row('usage', r.usageNote),
      row('monthly', monthly),
      row('included', sentence(r.includedServices)),
      row('extra', sentence(r.extraCosts)),
      row('contract', r.contractMonths === null ? null : e.months(r.contractMonths)),
      row('renewal', r.renewal ?? e.renewalUnknown, r.renewalAssumption ? e.withAssumption(r.renewalAssumption) : undefined),
      row('buyout', r.buyout ?? e.buyoutNone),
      row('indexation', r.indexationPerYear === null ? null : e.indexationValue(formatPercent(r.indexationPerYear, 0)), r.indexationAssumed ? e.assumption : undefined),
      row('source', r.source),
    ],
  }
}

/** «Как рассчитано»: формулы с числами варианта; результат — те же значения, что в рейтинге и сравнении с процессом 2.1. */
function formulaRows(v: RankedVariant, horizonYears: number, demand: PeakDemand | null): readonly DetailRow[] {
  const years = formatCount(horizonYears, t.plural.years)
  const capex = money(v.capexRub)
  const effect = money(v.annualEffectRub)
  const productivity = v.effectiveProductivity?.tripsPerHour ?? null
  const h = t.howCalc
  return [
    { key: 'payback', label: e.formulaRows.payback, value: v.paybackYears === null ? h.noPayback : e.paybackFormula(capex, effect, formatYears(v.paybackYears)) },
    { key: 'roi', label: e.formulaRows.roi(years), value: v.roi === null ? null : e.roiFormula(effect, years, capex, formatPercent(v.roi)) },
    { key: 'tco', label: e.formulaRows.tco(years), value: v.tcoRub === null ? null : e.tcoFormula(capex, money(v.opexRubPerYear), years, money(v.tcoRub)) },
    {
      key: 'robots',
      label: e.formulaRows.robots,
      value: demand === null || productivity === null
        ? null
        : h.robotsFormula(h.perHour(formatNumber(demand.perHour), demand.unit), h.trips(formatNumber(productivity, 1)), formatNumber(demand.perHour / productivity, 1)),
      caption: e.robotsResult(formatCount(v.robots, ru.plural.robots)),
    },
  ]
}

/** Вкладка «Экономика» окна 2.1а (16832:677; PRD 11.3, 11.5) для варианта «Покупка» или «RaaS». */
export function economicsView({ variant: v, acquisitions, baseline, horizonYears, demand }: EconomicsInput): EconomicsView {
  return {
    price: priceRows(v, acquisitions),
    capex: { title: e.capexTitle(money(v.capexRub)), items: amounts(v.capexItems) },
    opex: { title: e.opexTitle(money(v.opexRubPerYear)), caption: opexCaption(v, baseline), items: amounts(v.opexItems) },
    effect: effectRows(v),
    raas: raasRows(v),
    formulas: formulaRows(v, horizonYears, demand),
  }
}
