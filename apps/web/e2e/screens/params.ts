import type { Page } from '@playwright/test'
import { openScenario } from './helpers'
import { ALL, type ScreenRegistration } from './types'

/**
 * Сценарий /dev/screens и курсор в угол: после щелчка по ссылке сценария курсор остаётся над таблицей процессов
 * и подсвечивает строку под собой — на макете наведения нет.
 */
const scenario = (title: string) => async (page: Page): Promise<void> => {
  await openScenario(title)(page)
  await page.mouse.move(0, 0)
}

/** Шаг 1 «Параметры проекта» (доска 16325, экран 1.1). Поток шага правит только этот файл. */
export const PARAMS_SCREENS: ScreenRegistration = {
  routes: [
    // Шаги проекта: гостю открыты (D-14, D-82); сохранённая оценка — только просмотр (D-17).
    { path: '/projects/PJ-DEMO/params', roles: ALL },
    // Шаг 1 с блокировкой подбора: инвентаризация без частоты пересчёта (PRD 11.2).
    { path: '/projects/PJ-07/params', roles: ALL },
  ],
  visual: [
    { id: '02', path: '/projects/PJ-DEMO/params', role: 'user' },
    { id: '02-guest', path: '/projects/PJ-DEMO/params', role: 'guest' },
    { id: '02-blocked', path: '/projects/PJ-07/params', role: 'user' },
    // 1.1 «всё раскрыто» (16992:10) — сценарий /dev/screens: все группы, разбор нагрузки и все параметры локации.
    { id: '02-open', path: '/dev/screens', role: 'user', prepare: scenario('Параметры проекта · всё раскрыто') },
    // 1.2 комплектация (17009:3…985) и 1.3 упаковка (17009:1010…1840). Поповер статуса на фрагментах открыт, но открытый
    // диалог снимается только окном — эталон без него, на всю высоту; поповер проверяет axe (layers).
    { id: '02-picking', path: '/dev/screens', role: 'user', prepare: scenario('Параметры проекта · комплектация заказов') },
    { id: '02-packing', path: '/dev/screens', role: 'user', prepare: scenario('Параметры проекта · упаковка') },
    // 1.4 уборка (17009:1865…2709) и 1.5 инвентаризация (17009:2734…3590).
    { id: '02-cleaning', path: '/dev/screens', role: 'user', prepare: scenario('Параметры проекта · уборка помещений') },
    { id: '02-inventory', path: '/dev/screens', role: 'user', prepare: scenario('Параметры проекта · инвентаризация, подбор недоступен') },
  ],
  layers: [
    {
      name: 'поповер статуса процесса',
      path: '/projects/PJ-DEMO/params',
      role: 'user',
      open: async (page) => {
        await page.getByRole('button', { name: 'Не хватает данных: Перемещение паллет' }).click()
        await page.getByRole('dialog').waitFor()
      },
    },
    {
      name: 'поповер «Блокирует подбор»',
      path: '/projects/PJ-07/params',
      role: 'user',
      open: async (page) => {
        await page.getByRole('button', { name: 'Блокирует подбор: Инвентаризация' }).click()
        await page.getByRole('dialog').waitFor()
      },
    },
  ],
}
