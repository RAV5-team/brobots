import { formatNumber } from './number'

/** Формы слова для 1, 2 и 5: ['робот', 'робота', 'роботов']. */
export type PluralForms = readonly [one: string, few: string, many: string]

const rules = new Intl.PluralRules('ru-RU')

/** Склонение по Intl.PluralRules (D-19). Дробные числа получают форму «few»: «0,7 года». */
export function pluralize(count: number, [one, few, many]: PluralForms): string {
  switch (rules.select(count)) {
    case 'one':
      return one
    case 'few':
    case 'other':
      return few
    default:
      return many
  }
}

/** «3 робота», «1 200 проб». */
export function formatCount(count: number, forms: PluralForms, maxFractionDigits = 0): string {
  return `${formatNumber(count, maxFractionDigits)}\u00a0${pluralize(count, forms)}`
}

const YEARS: PluralForms = ['год', 'года', 'лет']

/** Срок окупаемости: «0,7 года», «1 год», «5 лет». */
export function formatYears(years: number): string {
  return formatCount(years, YEARS, 1)
}
