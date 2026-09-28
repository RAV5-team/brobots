import { VISUAL_SCREENS } from './readyScreens'
import { expect, openAs, test, waitForScreen } from './support'

// Эталоны сняты в Docker-образе Playwright; на другой ОС шрифты рендерятся иначе и тест бессмысленен.
test.beforeAll(() => {
  if (process.env.PW_VISUAL_DOCKER !== '1') {
    throw new Error('test:visual запускается только в Docker: npm run test:visual (обновить эталоны — npm run test:visual:update)')
  }
})

for (const { id, path, role, prepare, ...options } of VISUAL_SCREENS) {
  test(`экран ${id}`, async ({ page, consoleErrors }) => {
    // Открытие экрана + снимок до 30 с: под нагрузкой полного прогона тяжёлые экраны (08b, 09) не укладывались в стандартные 30 с на тест.
    test.setTimeout(60_000)
    await openAs(page, path, role, options)
    if (prepare) {
      await prepare(page)
      await waitForScreen(page, options)
    }
    // Модалка закрывает только окно: снимаем окно 1366×768, остальные экраны — страницей целиком.
    const isModal = await page.getByRole('dialog').isVisible()
    await expect(page).toHaveScreenshot(`${id}.png`, {
      fullPage: !isModal,
      // Высокие экраны (07, 09а, 16, А5, К-1) снимаются дольше стандартных 5 с.
      timeout: 30_000,
      // Динамика: «Черновик сохранён · HH:MM» и другие статусы со временем.
      mask: [page.getByRole('status').filter({ hasText: /\d{2}:\d{2}/ })],
    })
    expect(consoleErrors).toEqual([])
  })
}
