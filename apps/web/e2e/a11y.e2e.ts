import { A11Y_LAYERS, READY_ROUTES } from './readyScreens'
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

// Слои, которых нет в исходном состоянии экрана, — регистрирует раздел (e2e/screens).
for (const layer of A11Y_LAYERS) {
  test(`axe: ${layer.name} (${layer.path})`, async ({ page, consoleErrors }) => {
    await openAs(page, layer.path, layer.role)
    await layer.open(page)
    expect(await axeFindings(page, layer.scope)).toEqual([])
    expect(consoleErrors).toEqual([])
  })
}
