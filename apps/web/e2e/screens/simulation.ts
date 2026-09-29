import type { Page } from '@playwright/test'
import { openScenario } from './helpers'
import { ALL, SIGNED_IN, type ScreenRegistration } from './types'

/** 06-sim: конечное состояние прогона (3.3) — готовность по атрибуту карточки, а не по заголовку или времени. */
const runSimulation = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Запустить симуляцию' }).click()
  await page.locator('[data-run-status="done"]').waitFor({ timeout: 15_000 })
  // Статус вверху: у пользователя «Черновик сохранён» появляется после перечитывания проекта — без него кадр прыгает;
  // у гостя вместо него демо-плашка каркаса.
  await page.getByText(/^(Черновик сохранён · \d{2}:\d{2}|Демо-режим · изменения не сохраняются)$/).waitFor()
}

/** 07c: план вердикта «подтверждено» с составом +1 робот — непроверенный состав и «Проверить состав прогоном». */
const ownFleet = async (page: Page): Promise<void> => {
  await openScenario('Симуляция · вердикт · подтверждено (демо-проект)')(page)
  await page.getByRole('spinbutton', { name: 'Роботов' }).press('ArrowUp')
  await page.getByRole('button', { name: 'Проверить состав прогоном' }).waitFor()
}

/** 2D-трассы по 1,7 МБ грузятся отдельными чанками — в dev-сервере дольше стандартных 5 с. */
const PLAYERS_TIMEOUT_MS = 30_000

/**
 * 07a (3.5): готовность — атрибут карточки плееров `data-players="ready"` (обе схемы с роботами нарисованы), а не время.
 * Плеер при открытии на паузе в начале первого пикового часа — кадр не зависит от времени снимка (D-105).
 */
const withPlayers = (prepare: (page: Page) => Promise<void>) => async (page: Page): Promise<void> => {
  await prepare(page)
  await page.locator('[data-players="ready"]').waitFor({ timeout: PLAYERS_TIMEOUT_MS })
}

/** Шаг 3 «Симуляция» (04–07c). Поток шага правит только этот файл. */
export const SIMULATION_SCREENS: ScreenRegistration = {
  routes: [
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
  ],
  visual: [
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
    // 3.6 «Вердикт · состав подтверждён» (16325:194) — у пользователя; гостевой вид — 07-confirmed-guest.
    { id: '07-confirmed', path: '/dev/screens', role: 'user', prepare: openScenario('Симуляция · вердикт · подтверждено (демо-проект)') },
    { id: '07-confirmed-guest', path: '/dev/screens', role: 'guest', prepare: openScenario('Симуляция · вердикт · подтверждено (демо-проект)') },
    { id: '07b-need-more', path: '/dev/screens', role: 'user', prepare: openScenario('Симуляция · вердикт · нужно докупить (демо-проект)') },
    { id: '07-layout', path: '/dev/screens', role: 'user', prepare: openScenario('Симуляция · вердикт · узкое место планировки (демо-проект)') },
    // 07c: макета нет (D-86) — состояние по PRD 11.4.
    { id: '07c', path: '/dev/screens', role: 'user', prepare: ownFleet },
    { id: '07-unreachable', path: '/dev/screens', role: 'user', prepare: openScenario('Симуляция · вердикт · поток недостижим (демо-проект)') },
    // Плеер на паузе в фиксированной точке — начале первого пикового часа (D-105): кадр не зависит от времени снимка.
    { id: '07a', path: '/dev/screens', role: 'user', prepare: withPlayers(openScenario('Симуляция · графики и 2D-сравнение · можно уменьшить (демо-проект)')) },
    // Через /dev/screens: прямой адрес ждёт загрузку только 5 с, трассе нужно дольше.
    { id: '07a-confirmed-guest', path: '/dev/screens', role: 'guest', prepare: withPlayers(async (page) => { await page.goto('/projects/PJ-DEMO/simulation?stage=verdict&tab=charts&as=guest') }) },
  ],
}
