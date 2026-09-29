import type { CharacteristicStatus } from './characteristic'

/**
 * Статус проверки значения в проектном виде (окно 2.1а, 16830:10): подтверждено, по аналогу, оценка,
 * ещё не проверено (ждёт симуляции), требует проверки. Отдельно от `CharacteristicStatus`: К-3 и К-4 считают
 * серые ячейки и «17 подтверждено · 10 оценка · 3 нет данных» по трём статусам каталога (D-76, D-77).
 */
export type VerificationStatus = 'confirmed' | 'analog' | 'estimate' | 'pending' | 'needs_check'

const FROM_CHARACTERISTIC: Readonly<Record<CharacteristicStatus, VerificationStatus>> = {
  confirmed: 'confirmed',
  estimate: 'estimate',
  // Значения нет — в проекте его надо запросить у поставщика, а не ждать симуляции.
  missing: 'needs_check',
}

/** Статус характеристики каталога в проектном виде; «по аналогу» и «ещё не проверено» каталог не знает. */
export const verificationOf = (status: CharacteristicStatus): VerificationStatus => FROM_CHARACTERISTIC[status]
