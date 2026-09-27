// Источник: экран 06 «Дашборд» (15935:115) и PRD 8.2–8.3; ГКБ №17 — PRD 8.3 и экран 12.
// Ручная работа по локациям хранится готовой, пока нет экономической модели; итог «591 млн ₽» не хранится — считается.
// Разрешённые расхождения — apps/web/src/mocks/fixtures/README.md.
import type { DashboardInputs } from '@/domain'

export const DASHBOARD_INPUTS: DashboardInputs = {
  laborCosts: [
    { locationId: 'LOC-01', annualRub: 231_000_000 },
    { locationId: 'LOC-02', annualRub: 84_000_000 },
    { locationId: 'LOC-03', annualRub: 183_000_000 },
    { locationId: 'LOC-04', annualRub: 93_000_000 },
  ],
  // На макете видны два пункта из восьми; остальные тексты не придумываем (источник пунктов — открытый вопрос PRD 8.3).
  checks: {
    total: 8,
    preview: ['Подтвердить допустимую нагрузку на пол', 'Проверить покрытие Wi‑Fi на маршрутах'],
  },
}
