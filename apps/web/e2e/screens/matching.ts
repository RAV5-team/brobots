import { expect } from '@playwright/test'
import { click } from './helpers'
import { ALL, SIGNED_IN, type ScreenRegistration } from './types'

/** Шаг 2 «Подбор решения» (03, 03a). Поток шага правит только этот файл. */
export const MATCHING_SCREENS: ScreenRegistration = {
  routes: [
    { path: '/projects/PJ-DEMO/matching', roles: ALL },
    // Шаг 2 у сохранённой оценки — только просмотр (D-17); у PJ-04 подбор не рассчитан.
    { path: '/projects/PJ-01/matching', roles: SIGNED_IN },
    { path: '/projects/PJ-04/matching', roles: SIGNED_IN },
  ],
  visual: [
    { id: '03', path: '/projects/PJ-DEMO/matching', role: 'user' },
    { id: '03-guest', path: '/projects/PJ-DEMO/matching', role: 'guest' },
    // 03a: боковая панель «Как рассчитано» у рекомендации поверх 03 (16202:490).
    { id: '03a', path: '/projects/PJ-DEMO/matching', role: 'user', prepare: click(/^Как рассчитано$/) },
  ],
  layers: [
    {
      name: 'боковая панель «Как рассчитано»',
      path: '/projects/PJ-DEMO/matching',
      role: 'guest',
      open: async (page) => {
        await page.getByRole('button', { name: 'Как рассчитано' }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
      },
    },
  ],
}
