import type { CompareEntry, Role } from '@/domain'

/**
 * Набор сравнения каталога (К-1 → К-3, D-58, D-69). Роль нужна, чтобы гостю не сохранять набор (ТЗ 3.1.2).
 * Каждый метод возвращает набор после изменения.
 */
export interface CompareService {
  list(role: Role): Promise<readonly CompareEntry[]>
  /** Набор полон (COMPARE_LIMIT) — ValidationError. Повтор не дублируется. */
  add(role: Role, entry: CompareEntry): Promise<readonly CompareEntry[]>
  remove(role: Role, entry: CompareEntry): Promise<readonly CompareEntry[]>
  clear(role: Role): Promise<readonly CompareEntry[]>
}
