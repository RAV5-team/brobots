import { READY_ROUTES } from './readyScreens'
import { expect, openAs, test } from './support'

const NOT_FOUND = 'Страница не найдена'

for (const { path, roles, busy } of READY_ROUTES) {
  for (const role of roles) {
    test(`${path} открывается у роли ${role}`, async ({ page, consoleErrors }) => {
      await openAs(page, path, role, busy ? { busy } : {})
      const heading = page.locator('h1').first()
      await expect(heading).not.toHaveText('')
      await expect(heading).not.toHaveText(NOT_FOUND)
      expect(consoleErrors).toEqual([])
    })
  }
}

test('гостю список проектов закрыт — редирект в каталог (D-82)', async ({ page, consoleErrors }) => {
  await openAs(page, '/projects', 'guest')
  await expect(page).toHaveURL(/\/catalog(\?|$)/)
  expect(consoleErrors).toEqual([])
})

test('замороженные часы не идут сами: кадр опроса А1а не меняется, пока время не сдвинули', async ({ page, consoleErrors }) => {
  await openAs(page, '/admin/catalog/import', 'admin', { busy: true, frozenAfterMs: 500 })
  const firstFrame = page.getByText('Опрашиваем источники · 1 из 3')
  await expect(firstFrame).toBeVisible()
  // Реальное время — больше двух интервалов опроса (1,5 с): при идущих часах экран ушёл бы дальше.
  await page.waitForTimeout(4000)
  await expect(firstFrame).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('отчёт 09 печатается в PDF: A4, колонтитул и разрыв перед каждым разделом (D-107)', async ({ page, consoleErrors }) => {
  await openAs(page, '/projects/PJ-DEMO/report', 'user')
  await page.getByRole('heading', { name: '12. Приложения' }).waitFor()
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('navigation', { name: 'Действия с отчётом' })).toBeHidden()
  const breaks = await page.locator('article section[aria-labelledby^="report-"]').evaluateAll((sections) =>
    sections.map((s) => getComputedStyle(s).breakBefore))
  expect(breaks).toEqual(['auto', ...Array.from({ length: 11 }, () => 'page')])
  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  expect(pages).toBeGreaterThanOrEqual(12)
  expect(consoleErrors).toEqual([])
})
