import { expect, test as base, type Page } from '@playwright/test'
import type { Role } from './readyScreens'

/** Дата «сегодня» в тестах — день сквозного примера PRD 11 (расчёт 26.09.2026). */
export const FIXED_NOW = new Date('2026-09-26T12:00:00+03:00')
/** pauseAt двигает часы только вперёд: ставим их чуть раньше FIXED_NOW. */
const CLOCK_LEAD_MS = 1000

/** Адрес с ролью: `?as=` работает в dev-сборке (D-24). */
export function withRole(path: string, role: Role): string {
  const url = new URL(path, 'http://localhost')
  url.searchParams.set('as', role)
  return `${url.pathname}${url.search}`
}

export interface ScreenOptions {
  /** Экран «занят» по замыслу (А1а — идёт опрос источников): `aria-busy` не ждём. */
  readonly busy?: boolean
  /**
   * Подменить таймеры и прокрутить столько миллисекунд: экран с опросом по таймеру замирает на одном кадре.
   * Без этого — только фиксированная дата, задержки моков (setTimeout) идут как обычно.
   */
  readonly frozenAfterMs?: number
}

/** Экран готов: шрифты загружены, загрузка данных закончилась, заголовок на месте. */
export async function waitForScreen(page: Page, { busy = false }: ScreenOptions = {}): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  if (!busy) await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  await expect(page.locator('h1').first()).toBeVisible()
}

/** Открыть экран под ролью: `new Date()` и `Date.now()` отдают FIXED_NOW. */
export async function openAs(page: Page, path: string, role: Role, options: ScreenOptions = {}): Promise<void> {
  if (options.frozenAfterMs === undefined) {
    await page.clock.setFixedTime(FIXED_NOW)
    await page.goto(withRole(path, role))
  } else {
    // install() подменяет таймеры, но часы идут вместе с реальным временем; pauseAt останавливает их —
    // дальше время двигает только runFor, и медленная машина не успевает «дожить» до следующего опроса.
    await page.clock.install({ time: FIXED_NOW.getTime() - CLOCK_LEAD_MS })
    await page.clock.pauseAt(FIXED_NOW)
    await page.goto(withRole(path, role))
    await page.clock.runFor(options.frozenAfterMs)
  }
  await waitForScreen(page, options)
}

/** Тест с проверкой консоли: ошибки браузера и необработанные исключения валят тест. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, provide) => {
    const errors: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('pageerror', (error) => { errors.push(error.message) })
    await provide(errors)
    expect(errors, 'ошибки в консоли браузера').toEqual([])
  },
})

export { expect }
