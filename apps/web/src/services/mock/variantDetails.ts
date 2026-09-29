import type { MatchingEvaluation } from '@/domain'
import { VARIANT_DETAILS_BY_PROCESS, variantKey } from '@/mocks/fixtures/projectMatchingDetails'

/**
 * Поля окна 2.1а, которых нет в API (цена с источником, условия RaaS, оборудование, разбор балла), — к вариантам
 * подбора процесса. Модуль грузится лениво (`import()` в моке проектов): фикстура не раздувает стартовый бандл.
 */
export function withVariantDetails(evaluation: MatchingEvaluation, processId: string): MatchingEvaluation {
  const details = VARIANT_DETAILS_BY_PROCESS[processId]
  if (!details) return evaluation
  return {
    ...evaluation,
    variants: evaluation.variants.map((v) => ({ ...v, ...details[variantKey(v.solutionId, v.acquisition)] })),
  }
}
