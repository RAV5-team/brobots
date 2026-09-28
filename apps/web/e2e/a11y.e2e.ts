import type { Page } from '@playwright/test'
import { READY_ROUTES, type Role } from './readyScreens'
import { axeFindings, expect, openAs, test } from './support'

// axe на каждом готовом маршруте у каждой роли — исходное состояние экрана (аудит 2026-09-28, §7b).
for (const { path, roles, busy } of READY_ROUTES) {
  for (const role of roles) {
    test(`axe: ${path} у роли ${role}`, async ({ page, consoleErrors }) => {
      await openAs(page, path, role, busy ? { busy } : {})
      expect(await axeFindings(page)).toEqual([])
      expect(consoleErrors).toEqual([])
    })
  }
}

interface OpenLayer {
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

// Слои, которых нет в исходном состоянии экрана: меню, выпадающий список, модальное окно, боковая панель.
const LAYERS: readonly OpenLayer[] = [
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
  {
    name: 'окно «Новый проект» (A2)',
    path: '/projects?new=1',
    role: 'user',
    open: async (page) => {
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
  {
    name: 'боковая панель «Как рассчитано»',
    path: '/projects/PJ-DEMO/matching',
    role: 'guest',
    open: async (page) => {
      await page.getByRole('button', { name: 'Как рассчитано' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
  },
]

for (const layer of LAYERS) {
  test(`axe: ${layer.name} (${layer.path})`, async ({ page, consoleErrors }) => {
    await openAs(page, layer.path, layer.role)
    await layer.open(page)
    expect(await axeFindings(page, layer.scope)).toEqual([])
    expect(consoleErrors).toEqual([])
  })
}
