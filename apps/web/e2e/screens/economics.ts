import { openScenario, withTraces } from './helpers'
import { ALL, SIGNED_IN, type ScreenRegistration } from './types'

/** Шаг 4 «Итог и экономика» (08–08b) и отчёт PDF (09). Поток шага правит только этот файл. */
export const ECONOMICS_SCREENS: ScreenRegistration = {
  routes: [
    // Итог и экономика (08): переключатель сценария — в адресе (08a); сохранённая оценка — только просмотр (D-17, D-106).
    { path: '/projects/PJ-DEMO/economics', roles: ALL },
    { path: '/projects/PJ-DEMO/economics?scenario=purchase', roles: ALL },
    { path: '/projects/PJ-01/economics', roles: SIGNED_IN },
    // Отчёт PDF (09): печатный лист без меню кабинета, 12 разделов PRD 11.6 (D-107).
    { path: '/projects/PJ-DEMO/report', roles: ALL },
    { path: '/projects/PJ-01/report', roles: SIGNED_IN },
  ],
  visual: [
    // Итог и экономика: RaaS черновика, гость, сохранённая PJ-01; 08a и 08b — сценарии /dev/screens (D-106).
    { id: '08', path: '/projects/PJ-DEMO/economics', role: 'user' },
    { id: '08-guest', path: '/projects/PJ-DEMO/economics', role: 'guest' },
    { id: '08-saved', path: '/projects/PJ-01/economics', role: 'user' },
    { id: '08a', path: '/dev/screens', role: 'user', prepare: openScenario('Итог · выбран сценарий «покупка» (демо-проект)') },
    { id: '08b', path: '/dev/screens', role: 'user', prepare: openScenario('Итог · КП запрошено (демо-проект)') },
    // Отчёт 09: кадр 2D-схемы в разделе 9 ждёт трассы; «сформировано» — по замороженным часам (FIXED_NOW).
    { id: '09', path: '/dev/screens', role: 'user', prepare: withTraces(async (page) => { await page.goto('/projects/PJ-DEMO/report?as=user') }) },
  ],
}
