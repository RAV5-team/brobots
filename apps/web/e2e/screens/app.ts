import { expect } from '@playwright/test'
import { click, openScenario } from './helpers'
import { ADMIN, ALL, SIGNED_IN, type ScreenRegistration } from './types'

/** Экраны вне проекта: вход, дашборд, каталог, процессы, локации, администрирование. */
export const APP_SCREENS: ScreenRegistration = {
  routes: [
    { path: '/login', roles: ['guest'] },
    { path: '/', roles: ALL },
    { path: '/catalog', roles: ALL },
    { path: '/catalog/compare', roles: ALL },
    { path: '/catalog/RB-0008', roles: ALL },
    { path: '/processes', roles: ALL },
    // Формы создания гостю закрыты маршрутом (ролевая модель, §3): у него «нет доступа», проверка — routes.e2e.ts.
    { path: '/processes/new', roles: SIGNED_IN },
    { path: '/processes/PR-0001', roles: ALL },
    { path: '/locations', roles: ALL },
    { path: '/locations/new', roles: SIGNED_IN },
    { path: '/locations/LOC-01', roles: ALL },
    { path: '/locations/LOC-01/processes', roles: ALL },
    { path: '/locations/LOC-01/processes/LP-01', roles: ALL },
    { path: '/locations/LOC-01/params', roles: ALL },
    { path: '/locations/LOC-01/documents', roles: ALL },
    { path: '/admin/catalog', roles: ADMIN },
    // А3 «Робот добавлен» — состояние А1 (D-48).
    { path: '/admin/catalog?added=RB-0008', roles: ADMIN },
    { path: '/admin/catalog/import', roles: ADMIN, busy: true },
    { path: '/admin/catalog/new', roles: ADMIN },
    { path: '/admin/norms', roles: ADMIN },
    { path: '/admin/sources', roles: ADMIN },
    { path: '/admin/operation-classes', roles: ADMIN },
  ],
  visual: [
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
    // А3: состояние А1 после «Сохранить робота» — плашка «Каталог обновлён» (D-48).
    { id: 'А3', path: '/admin/catalog?added=RB-0008', role: 'admin' },
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
  ],
  layers: [
    {
      name: 'меню кабинета',
      path: '/',
      role: 'user',
      open: async (page) => {
        const button = page.getByRole('button', { name: /Меню кабинета/ })
        await button.click()
        await expect(button).toHaveAttribute('aria-expanded', 'true')
      },
    },
    {
      name: 'выпадающий список фильтра',
      path: '/processes',
      role: 'user',
      open: async (page) => {
        await page.getByRole('combobox').first().click()
        await expect(page.getByRole('listbox')).toBeVisible()
      },
      scope: '[role="listbox"]',
    },
  ],
}
