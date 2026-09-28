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
  // Шаги проекта (каркас, пункт 3): гостю открыты (D-14, D-82); сохранённая оценка — только просмотр (D-17).
  { path: '/projects/PJ-DEMO/params', roles: ALL },
  // Шаг 1 с блокировкой подбора: инвентаризация без частоты пересчёта (PRD 11.2).
  { path: '/projects/PJ-07/params', roles: ALL },
  { path: '/projects/PJ-DEMO/matching', roles: ALL },
  // Шаг 2 у сохранённой оценки — только просмотр (D-17); у PJ-04 подбор не рассчитан.
  { path: '/projects/PJ-01/matching', roles: SIGNED_IN },
  { path: '/projects/PJ-DEMO/simulation', roles: ALL },
  // Этап 1 симуляции (04); у сохранённой оценки состав только для просмотра (D-17, D-101).
  { path: '/projects/PJ-DEMO/simulation?stage=scope', roles: ALL },
  { path: '/projects/PJ-01/simulation?stage=scope', roles: SIGNED_IN },
  // Этап 2 симуляции (05): условия; у сохранённой оценки — только просмотр (D-17, D-102).
  { path: '/projects/PJ-DEMO/simulation?stage=conditions', roles: ALL },
  { path: '/projects/PJ-01/simulation?stage=conditions', roles: SIGNED_IN },
  // Этап 3 симуляции (06): без прогона в сессии — последний прогон; у сохранённой оценки — только вердикт (D-103).
  { path: '/projects/PJ-DEMO/simulation?stage=run', roles: ALL },
  { path: '/projects/PJ-01/simulation?stage=run', roles: SIGNED_IN },
  // Этап 4 симуляции (07): вердикт прогона; у сохранённой оценки план только для просмотра (D-104). Вкладка графиков — 07a.
  { path: '/projects/PJ-01/simulation?stage=verdict', roles: SIGNED_IN },
  { path: '/projects/PJ-01/simulation?stage=verdict&tab=charts', roles: SIGNED_IN },
  // 07a: графики и 2D-плееры; трассы грузятся отдельными чанками, плеер стоит на паузе в первом пиковом часе (D-105).
  { path: '/projects/PJ-DEMO/simulation?stage=verdict&tab=charts', roles: ALL },
  // Итог и экономика (08): переключатель сценария — в адресе (08a); сохранённая оценка — только просмотр (D-17, D-106).
  { path: '/projects/PJ-DEMO/economics', roles: ALL },
  { path: '/projects/PJ-DEMO/economics?scenario=purchase', roles: ALL },
  { path: '/projects/PJ-01/economics', roles: SIGNED_IN },
  // Отчёт PDF (09): печатный лист без меню кабинета, 12 разделов PRD 11.6 (D-107).
  { path: '/projects/PJ-DEMO/report', roles: ALL },
  { path: '/projects/PJ-01/report', roles: SIGNED_IN },
  // Спайк 2D-плеера (D-87): служебная страница, трассы грузятся отдельными чанками.
  { path: '/dev/spike-2d', roles: ['user'] },
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

const runSimulation = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Запустить симуляцию' }).click()
  await page.getByRole('heading', { name: 'Прогон завершён' }).waitFor({ timeout: 15_000 })
  // Строка сохранения появляется после перечитывания проекта — без неё кадр снимается раньше и прыгает.
  await page.getByRole('status').filter({ hasText: /^(Черновик сохранён · \d{2}:\d{2}|Демо-режим: изменения не сохраняются)$/ }).waitFor()
}

/** 07a: 2D-трассы по 1,7 МБ грузятся отдельными чанками — в dev-сервере дольше стандартных 5 с. */
const TRACES_TIMEOUT_MS = 30_000
const withTraces = (prepare: (page: Page) => Promise<void>) => async (page: Page): Promise<void> => {
  await prepare(page)
  await page.locator('[data-robot]').first().waitFor({ timeout: TRACES_TIMEOUT_MS })
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
  { id: '02', path: '/projects/PJ-DEMO/params', role: 'user' },
  { id: '02-guest', path: '/projects/PJ-DEMO/params', role: 'guest' },
  { id: '02-blocked', path: '/projects/PJ-07/params', role: 'user' },
  { id: '03', path: '/projects/PJ-DEMO/matching', role: 'user' },
  { id: '03-guest', path: '/projects/PJ-DEMO/matching', role: 'guest' },
  { id: '04', path: '/projects/PJ-DEMO/simulation?stage=scope', role: 'user' },
  { id: '04-guest', path: '/projects/PJ-DEMO/simulation?stage=scope', role: 'guest' },
  // Номер 05 занят экраном входа чистовой серии — у экрана проекта суффикс «-sim».
  { id: '05-sim', path: '/projects/PJ-DEMO/simulation?stage=conditions', role: 'user' },
  { id: '05-sim-guest', path: '/projects/PJ-DEMO/simulation?stage=conditions', role: 'guest' },
  // Эталон — конечное состояние прогона (D-103): мок завершает задание за пять опросов раз в секунду.
  { id: '06-sim', path: '/projects/PJ-DEMO/simulation?stage=conditions', role: 'user', prepare: runSimulation },
  { id: '06-sim-guest', path: '/projects/PJ-DEMO/simulation?stage=conditions', role: 'guest', prepare: runSimulation },
  // Вердикты — сценарии /dev/screens (D-104): на макете «можно уменьшить», остальные — состояния по PRD 11.4.
  { id: '07-can-reduce', path: '/dev/screens', role: 'user', prepare: openScenario('Симуляция · вердикт · можно уменьшить (демо-проект)') },
  { id: '07-confirmed-guest', path: '/dev/screens', role: 'guest', prepare: openScenario('Симуляция · вердикт · подтверждено (демо-проект)') },
  { id: '07b-need-more', path: '/dev/screens', role: 'user', prepare: openScenario('Симуляция · вердикт · нужно докупить (демо-проект)') },
  { id: '07-layout', path: '/dev/screens', role: 'user', prepare: openScenario('Симуляция · вердикт · узкое место планировки (демо-проект)') },
  { id: '07-unreachable', path: '/dev/screens', role: 'user', prepare: openScenario('Симуляция · вердикт · поток недостижим (демо-проект)') },
  // Плеер на паузе в фиксированной точке — начале первого пикового часа (D-105): кадр не зависит от времени снимка.
  { id: '07a', path: '/dev/screens', role: 'user', prepare: withTraces(openScenario('Симуляция · графики и 2D-сравнение · можно уменьшить (демо-проект)')) },
  // Через /dev/screens: прямой адрес ждёт загрузку только 5 с, трассе нужно дольше.
  // Итог и экономика: RaaS черновика, гость, сохранённая PJ-01; 08a и 08b — сценарии /dev/screens (D-106).
  { id: '08', path: '/projects/PJ-DEMO/economics', role: 'user' },
  { id: '08-guest', path: '/projects/PJ-DEMO/economics', role: 'guest' },
  { id: '08-saved', path: '/projects/PJ-01/economics', role: 'user' },
  { id: '08a', path: '/dev/screens', role: 'user', prepare: openScenario('Итог · выбран сценарий «покупка» (демо-проект)') },
  { id: '08b', path: '/dev/screens', role: 'user', prepare: openScenario('Итог · КП запрошено (демо-проект)') },
  // Отчёт 09: кадр 2D-схемы в разделе 9 ждёт трассы; «сформировано» — по замороженным часам (FIXED_NOW).
  { id: '09', path: '/dev/screens', role: 'user', prepare: withTraces(async (page) => { await page.goto('/projects/PJ-DEMO/report?as=user') }) },
  { id: '07a-confirmed-guest', path: '/dev/screens', role: 'guest', prepare: withTraces(async (page) => { await page.goto('/projects/PJ-DEMO/simulation?stage=verdict&tab=charts&as=guest') }) },
]
