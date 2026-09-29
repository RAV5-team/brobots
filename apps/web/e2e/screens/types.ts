import type { Page } from '@playwright/test'

export type Role = 'guest' | 'user' | 'admin'

export const ALL: readonly Role[] = ['guest', 'user', 'admin']
export const SIGNED_IN: readonly Role[] = ['user', 'admin']
export const ADMIN: readonly Role[] = ['admin']

/**
 * Готовый маршрут и роли, которым он открыт (PRD 5.3, D-24, D-82).
 * Параметры маршрута — демо-идентификаторы фикстур. Добавили экран в router.tsx — добавьте строку.
 */
export interface ReadyRoute {
  readonly path: string
  readonly roles: readonly Role[]
  /** Экран «занят» по замыслу: `aria-busy` не ждём. */
  readonly busy?: true
}

/** Экран чистовой серии для эталона: номер из screens.md, адрес, роль и действия до скриншота. */
export interface VisualScreen {
  readonly id: string
  readonly path: string
  readonly role: Role
  /** Довести экран до состояния макета: открыть модалку, выбрать позиции, запустить сценарий /dev/screens. */
  readonly prepare?: (page: Page) => Promise<void>
  /** Экран «занят» по замыслу: `aria-busy` не ждём. */
  readonly busy?: true
  /** Экран с опросом по таймеру: подменить таймеры и снять кадр через столько миллисекунд. */
  readonly frozenAfterMs?: number
}

/** Слой, которого нет в исходном состоянии экрана (меню, список, окно, панель): axe проверяет его открытым. */
export interface OpenLayer {
  readonly name: string
  readonly path: string
  readonly role: Role
  /** Открыть слой и дождаться его появления. */
  readonly open: (page: Page) => Promise<void>
  /**
   * Проверять только слой. Radix Select прячет от скринридера всё вне списка (`aria-hidden` на #root),
   * и axe видит страницу без main и h1 — это состояние модального списка, а не дефект экрана.
   */
  readonly scope?: string
}

/** Что раздел регистрирует в e2e: готовые маршруты, эталоны visual и слои для axe. */
export interface ScreenRegistration {
  readonly routes: readonly ReadyRoute[]
  readonly visual: readonly VisualScreen[]
  readonly layers?: readonly OpenLayer[]
}
