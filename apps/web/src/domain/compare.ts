import type { LaunchItemId } from './catalogItem'
import type { RobotId } from './robot'

/** Больше четырёх позиций в сравнении не помещается (D-58, PRD 7.6: «2 из 4 выбрано»). */
export const COMPARE_LIMIT = 4

/** Позиция набора сравнения: робот или позиция для запуска, по id (D-69). */
export type CompareEntry =
  | { readonly kind: 'robot'; readonly id: RobotId }
  | { readonly kind: 'launch-item'; readonly id: LaunchItemId }

const isSameEntry = (a: CompareEntry, b: CompareEntry): boolean => a.kind === b.kind && a.id === b.id

export const hasEntry = (entries: readonly CompareEntry[], entry: CompareEntry): boolean => entries.some((e) => isSameEntry(e, entry))

/** Добавить позицию: повтор не дублируется; набор полон — null. */
export function addEntry(entries: readonly CompareEntry[], entry: CompareEntry): readonly CompareEntry[] | null {
  if (hasEntry(entries, entry)) return entries
  if (entries.length >= COMPARE_LIMIT) return null
  return [...entries, entry]
}

export function removeEntry(entries: readonly CompareEntry[], entry: CompareEntry): readonly CompareEntry[] {
  return entries.filter((e) => !isSameEntry(e, entry))
}
