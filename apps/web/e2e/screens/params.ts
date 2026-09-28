import { ALL, type ScreenRegistration } from './types'

/** Шаг 1 «Параметры проекта» (02). Поток шага правит только этот файл. */
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
  ],
}
