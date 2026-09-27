import type { Page } from '@playwright/test'

export type Role = 'guest' | 'user' | 'admin'

const ALL: readonly Role[] = ['guest', 'user', 'admin']
const SIGNED_IN: readonly Role[] = ['user', 'admin']
const ADMIN: readonly Role[] = ['admin']

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

export const READY_ROUTES: readonly ReadyRoute[] = [
  { path: '/login', roles: ['guest'] },
  { path: '/', roles: ALL },
  { path: '/projects', roles: SIGNED_IN },
  { path: '/catalog', roles: ALL },
  { path: '/catalog/compare', roles: ALL },
  { path: '/catalog/RB-0008', roles: ALL },
  { path: '/processes', roles: ALL },
  { path: '/processes/new', roles: ALL },
  { path: '/processes/PR-0001', roles: ALL },
  { path: '/locations', roles: ALL },
  { path: '/locations/new', roles: ALL },
  { path: '/locations/LOC-01', roles: ALL },
  { path: '/locations/LOC-01/processes', roles: ALL },
  { path: '/locations/LOC-01/processes/LP-01', roles: ALL },
  { path: '/locations/LOC-01/params', roles: ALL },
  { path: '/locations/LOC-01/documents', roles: ALL },
  { path: '/admin/catalog', roles: ADMIN },
  { path: '/admin/catalog/import', roles: ADMIN, busy: true },
  { path: '/admin/catalog/new', roles: ADMIN },
  { path: '/admin/norms', roles: ADMIN },
  { path: '/admin/sources', roles: ADMIN },
  { path: '/admin/operation-classes', roles: ADMIN },
]

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

const openScenario = (title: string) => async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: title, exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/dev/'))
}

const click = (name: string | RegExp) => async (page: Page): Promise<void> => {
  await page.getByRole('button', { name }).first().click()
  await page.getByRole('dialog').waitFor()
}

export const VISUAL_SCREENS: readonly VisualScreen[] = [
  { id: '05', path: '/login', role: 'guest' },
  { id: '06', path: '/', role: 'user' },
  { id: '06-guest', path: '/', role: 'guest' },
  { id: '07', path: '/processes', role: 'user' },
  { id: '09а', path: '/processes/new', role: 'user' },
  { id: '11', path: '/processes/PR-0001', role: 'user' },
  { id: '12', path: '/locations', role: 'user' },
  { id: '12а', path: '/dev/screens', role: 'user', prepare: openScenario('Локации · список · локация добавлена') },
  { id: '14', path: '/dev/screens', role: 'user', prepare: openScenario('Локации · новая локация · форма') },
  { id: '15', path: '/locations/LOC-01', role: 'user' },
  { id: '15а', path: '/locations/LOC-01/processes', role: 'user', prepare: click('Добавить процесс из шаблона') },
  { id: '16', path: '/locations/LOC-01/processes/LP-01', role: 'user' },
  { id: '17', path: '/locations/LOC-01/processes', role: 'user' },
  { id: '17а', path: '/locations/LOC-01/params', role: 'user' },
  { id: '17б', path: '/locations/LOC-01/documents', role: 'user' },
  { id: '17в', path: '/locations/LOC-01/processes', role: 'user', prepare: click('Удалить процесс «Перемещение паллет» с локации') },
  { id: 'locprocsempty', path: '/dev/screens', role: 'user', prepare: openScenario('Локации · процессы · пусто (D-07)') },
  { id: 'А1', path: '/admin/catalog', role: 'admin' },
  // Первый кадр опроса: ответ мока (150 мс) пришёл, следующий опрос (1,5 с) ещё не начался.
  { id: 'А1а', path: '/admin/catalog/import', role: 'admin', busy: true, frozenAfterMs: 500 },
  { id: 'А2', path: '/admin/catalog/new', role: 'admin' },
  { id: 'А5', path: '/admin/norms', role: 'admin' },
  { id: 'А6', path: '/admin/sources', role: 'admin' },
  { id: 'А7', path: '/admin/sources', role: 'admin', prepare: click('Добавить источник') },
  {
    id: 'А7б',
    path: '/admin/sources',
    role: 'admin',
    prepare: async (page) => {
      await click('Добавить источник')(page)
      await page.getByRole('dialog').getByText('Ссылка', { exact: true }).click()
    },
  },
  { id: 'А8', path: '/admin/operation-classes', role: 'admin' },
  { id: 'А10', path: '/admin/operation-classes', role: 'admin', prepare: click('Добавить класс') },
  { id: 'К-1', path: '/catalog', role: 'user' },
  { id: 'К-1-guest', path: '/catalog', role: 'guest' },
  { id: 'К-2', path: '/catalog?class=OP-01', role: 'user' },
  {
    id: 'К-3',
    path: '/catalog',
    role: 'user',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Сравнить: AMR 800' }).click()
      await page.getByRole('button', { name: 'Сравнить: Ronavi H1500' }).click()
      await page.getByRole('button', { name: /^Сравнить \(2\)/ }).click()
      await page.waitForURL('**/catalog/compare**')
    },
  },
  { id: 'К-4', path: '/catalog/RB-0008', role: 'user' },
  { id: 'A1', path: '/projects', role: 'user' },
  { id: 'A2', path: '/projects?new=1', role: 'user' },
]
