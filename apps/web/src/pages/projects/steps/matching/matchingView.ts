/**
 * Вид шага 2 при открытии — состояние навигации для экранов-состояний 2.1 из /dev/screens:
 * «всё раскрыто» (17093:10) и режим «Сравнить» с отмеченными вариантами (16834:5).
 * В URL не пишется: ссылка на подбор всегда открывает обычный вид.
 */
export interface MatchingViewState {
  /** Разбор балла раскрыт у всех строк рейтинга. */
  readonly expandAll?: boolean
  /** Режим «Сравнить» с этими ключами (`variantKey` или id решения вне рейтинга). */
  readonly compare?: readonly string[]
}

export function matchingViewState(view: MatchingViewState): { readonly matchingView: MatchingViewState } {
  return { matchingView: view }
}

/** Вид из `location.state`; чужое или пустое состояние — обычный вид. */
export function readMatchingView(state: unknown): MatchingViewState {
  if (typeof state !== 'object' || state === null || !('matchingView' in state)) return {}
  const view: unknown = state.matchingView
  if (typeof view !== 'object' || view === null) return {}
  const expandAll = 'expandAll' in view && view.expandAll === true
  const compare = 'compare' in view && Array.isArray(view.compare) && view.compare.every((key): key is string => typeof key === 'string')
    ? view.compare
    : undefined
  return { ...(expandAll ? { expandAll } : {}), ...(compare ? { compare } : {}) }
}

/** Окно 2.1б открыто для вариантов: `?compare=RB-0008:raas,RB-0001:raas` (ключи — `variantKey` или id решения вне рейтинга). */
export const COMPARE_PARAM = 'compare'

export const readCompareParam = (value: string | null): readonly string[] =>
  (value === null ? [] : value.split(',').map((key) => key.trim()).filter((key) => key !== ''))
