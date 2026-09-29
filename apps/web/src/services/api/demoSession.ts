import type { ApiSchemas } from '@/api/contract'
import type { ProjectInputs } from '@/domain'

/**
 * Состояние демо-проекта в браузере (ролевая модель, §5): решения по шагам и последний пересчёт. Сервер демо-проект
 * не меняет — гость ничего не сохраняет, два гостя друг другу не мешают. Живёт до закрытия вкладки: в памяти и копией
 * в sessionStorage, чтобы пережить перезагрузку страницы. Хранилище браузера может быть недоступно (приватный режим,
 * запрет сайта) — тогда состояние живёт только в памяти.
 */
export interface DemoState {
  readonly inputs: ProjectInputs
  /** Последний пересчёт гостя (`POST /projects/{id}/preview`); нет — цифры из сида демо-проекта. */
  readonly evaluation: ApiSchemas['Evaluation'] | null
}

export interface DemoSession {
  get(projectId: string): DemoState | null
  set(projectId: string, state: DemoState): void
}

const KEY_PREFIX = 'rav5.demo.'

function browserStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

export function createDemoSession(storage: Storage | null = browserStorage()): DemoSession {
  const memory = new Map<string, DemoState>()
  return {
    get: (projectId) => {
      const cached = memory.get(projectId)
      if (cached) return cached
      try {
        const raw = storage?.getItem(KEY_PREFIX + projectId)
        if (!raw) return null
        const state = JSON.parse(raw) as DemoState
        memory.set(projectId, state)
        return state
      } catch {
        return null
      }
    },
    set: (projectId, state) => {
      memory.set(projectId, state)
      try {
        storage?.setItem(KEY_PREFIX + projectId, JSON.stringify(state))
      } catch (error: unknown) {
        // Переполнено или запрещено: состояние остаётся в памяти до перезагрузки.
        console.warn('Состояние демо-проекта не записано в sessionStorage', error)
      }
    },
  }
}
