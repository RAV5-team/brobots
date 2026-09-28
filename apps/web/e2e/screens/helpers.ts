import type { Page } from '@playwright/test'

export const openScenario = (title: string) => async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: title, exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/dev/'))
}

/** 07a, 09: 2D-трассы по 1,7 МБ грузятся отдельными чанками — в dev-сервере дольше стандартных 5 с. */
const TRACES_TIMEOUT_MS = 30_000
export const withTraces = (prepare: (page: Page) => Promise<void>) => async (page: Page): Promise<void> => {
  await prepare(page)
  await page.locator('[data-robot]').first().waitFor({ timeout: TRACES_TIMEOUT_MS })
}

export const click = (name: string | RegExp) => async (page: Page): Promise<void> => {
  await page.getByRole('button', { name }).first().click()
  await page.getByRole('dialog').waitFor()
}
