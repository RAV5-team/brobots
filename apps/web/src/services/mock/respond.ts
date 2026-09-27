import { NotFoundError } from '../errors'

export interface MockOptions {
  /** Искусственная задержка ответа, мс: показывает состояния загрузки. В тестах — 0. */
  readonly latencyMs: number
}

/** Ответ мока: копия данных после задержки — изменения результата не портят фикстуры. */
export function respond<T>(value: T, { latencyMs }: MockOptions): Promise<T> {
  const copy = structuredClone(value)
  if (latencyMs <= 0) return Promise.resolve(copy)
  return new Promise((resolve) => setTimeout(() => { resolve(copy) }, latencyMs))
}

export function findOrReject<T>(items: readonly T[], match: (item: T) => boolean, notFound: string, options: MockOptions): Promise<T> {
  const item = items.find(match)
  return item === undefined ? Promise.reject(new NotFoundError(notFound)) : respond(item, options)
}
