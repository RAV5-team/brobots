import { expect } from '@playwright/test'
import { SIGNED_IN, type ScreenRegistration } from './types'

/** Список проектов A1 и окно «Новый проект» A2 (доска 16325:2). */
export const PROJECTS_SCREENS: ScreenRegistration = {
  routes: [
    { path: '/projects', roles: SIGNED_IN },
  ],
  visual: [
    // P1, P2 — A1 и A2 доски проекта (латинская A): эталоны не путаются с А1, А2 администрирования (кириллица).
    { id: 'P1', path: '/projects', role: 'user' },
    { id: 'P2', path: '/projects?new=1', role: 'user' },
  ],
  layers: [
    {
      name: 'окно «Новый проект» (A2)',
      path: '/projects?new=1',
      role: 'user',
      open: async (page) => {
        await expect(page.getByRole('dialog')).toBeVisible()
      },
    },
  ],
}
