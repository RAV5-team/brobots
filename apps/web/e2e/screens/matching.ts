import { expect, type Page } from '@playwright/test'
import { openScenario } from './helpers'
import { ALL, SIGNED_IN, type ScreenRegistration } from './types'

/** Окно 2.1а открыто поверх загруженного 2.1 и «Обзор» дорисован: иначе снимок ловит страницу до окна. */
const detailsReady = async (page: Page): Promise<void> => {
  await expect(page.getByRole('dialog').getByRole('region', { name: 'Идентификация' })).toBeVisible()
}

/** Окно 2.1б открыто и таблица сравнения дорисована (справочники характеристик грузятся с окном). */
const compareReady = async (page: Page): Promise<void> => {
  await expect(page.getByRole('dialog').getByRole('table', { name: 'Сравнение выбранных вариантов подбора' })).toBeVisible()
}

/** Окно 2.1а: открыть вкладку и дождаться её первой группы. */
const openTab = (tab: string, region: string) => async (page: Page): Promise<void> => {
  await detailsReady(page)
  await page.getByRole('tab', { name: tab }).click()
  await expect(page.getByRole('region', { name: region })).toBeVisible()
}
const openEconomics = openTab('Экономика', 'Цена и источник')

/** Шаг 2 «Подбор решений» (2.1 доски 16325; панель 03a удалена вместе с 2.2). Поток шага правит только этот файл. */
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
    // Состояния 2.1 — сценарии /dev/screens: всё раскрыто (17093:10), режим «Сравнить» (16834:5), строка вне рейтинга (16834:69).
    { id: '03-expanded', path: '/dev/screens', role: 'user', prepare: openScenario('Подбор решений · всё раскрыто (демо-проект)') },
    { id: '03-compare', path: '/dev/screens', role: 'user', prepare: openScenario('Подбор решений · режим «Сравнить» (демо-проект)') },
    // Окно 2.1а «Подробнее о решении» — в адресе: выбранный вариант RaaS (16666:10) и невыбранная покупка (17103:735).
    { id: '03-details', path: '/projects/PJ-DEMO/matching?details=RB-0008:raas', role: 'user', prepare: detailsReady },
    { id: '03-details-purchase', path: '/projects/PJ-DEMO/matching?details=RB-0008:purchase', role: 'user', prepare: detailsReady },
    // Вкладка «Экономика» (16832:677) — для обеих моделей: числа совпадают с рейтингом 2.1.
    { id: '03-details-economics', path: '/projects/PJ-DEMO/matching?details=RB-0008:raas', role: 'user', prepare: openEconomics },
    { id: '03-details-economics-purchase', path: '/projects/PJ-DEMO/matching?details=RB-0008:purchase', role: 'user', prepare: openEconomics },
    // Окно 2.1б «Сравнение вариантов» (16833:10) — в адресе; два варианта, как на макете.
    { id: '03-compare-dialog', path: '/projects/PJ-DEMO/matching?compare=RB-0008:raas,RB-0001:raas', role: 'user', prepare: compareReady },
    // Вкладки 2.1а на характеристиках К-4: «Технические» (16830:10), «Инфраструктура» (16832:10), «Качество данных» (16832:1463).
    { id: '03-details-technical', path: '/projects/PJ-DEMO/matching?details=RB-0008:raas', role: 'user', prepare: openTab('Технические', 'Технические характеристики') },
    { id: '03-details-infrastructure', path: '/projects/PJ-DEMO/matching?details=RB-0008:raas', role: 'user', prepare: openTab('Инфраструктура', 'Требование робота → данные локации → результат') },
    { id: '03-details-quality', path: '/projects/PJ-DEMO/matching?details=RB-0008:raas', role: 'user', prepare: openTab('Качество данных', 'Качество данных') },
    { id: '03-manual', path: '/dev/screens', role: 'user', prepare: openScenario('Подбор решений · добавлено вручную, вне рейтинга (демо-проект)') },
  ],
  layers: [
    {
      name: 'окно «Сравнение вариантов»',
      path: '/projects/PJ-DEMO/matching?compare=RB-0008:raas,RB-0001:raas',
      role: 'guest',
      open: compareReady,
    },
    {
      name: 'окно «Подробнее о решении»',
      path: '/projects/PJ-DEMO/matching',
      role: 'guest',
      open: async (page) => {
        await page.getByRole('button', { name: 'Подробнее о решении' }).click()
        await expect(page.getByRole('dialog', { name: 'AMR 800' }).getByText('AMR 800 · базовая комплектация')).toBeVisible()
      },
    },
    {
      name: 'боковая панель «Параметры расчёта»',
      path: '/projects/PJ-DEMO/matching',
      role: 'guest',
      open: async (page) => {
        await page.getByRole('button', { name: 'Изменить параметры расчёта' }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
      },
    },
  ],
}
