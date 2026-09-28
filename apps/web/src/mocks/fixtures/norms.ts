// Источник: PRD (`docs/RAV5_PRD.docx`), раздел 6.8 «Все нормативы на экране — 34 строки в 6 группах»; подписи — экран А5 (15997:371).
// В seed services/api нормативов пока нет. Разрешённые расхождения — apps/web/src/mocks/fixtures/README.md.
import type { Norm } from '@/domain'

export const NORMS: readonly Norm[] = [
  { code: 'payroll_tax_ratio', name: 'Коэффициент начислений на ФОТ (страховые взносы)', group: 'staff', kind: 'norm', value: 1.302, unit: 'коэф.', source: 'Датасет: ОПФ 22% + ОМС 5,1% + ОСС 2,9% + НСиПЗ 0,2%' },
  { code: 'work_time_loss_pct', name: 'Коэффициент потерь рабочего времени (по умолчанию)', group: 'staff', kind: 'norm', value: 25, unit: '%', source: 'Датасет «Склад»; для аэропорта и медучреждения — допущение' },
  { code: 'staff_replacement_salaries', name: 'Стоимость замены сотрудника (подбор и адаптация)', group: 'staff', kind: 'assumption', value: 0.5, unit: 'окладов', source: 'Допущение команды · HR-бенчмарк' },

  { code: 'robot_utilization_pct', name: 'Коэффициент загрузки робота', group: 'fleet', kind: 'norm', value: 80, unit: '%', source: 'Датасет, лист «Легенда»: типовой KPI AMR 70–85%' },
  { code: 'robot_availability_pct', name: 'Коэффициент технической готовности', group: 'fleet', kind: 'assumption', value: 95, unit: '%', source: 'Допущение команды · SLA вендоров 95–98%' },
  { code: 'fleet_peak_reserve_pct', name: 'Резерв парка на пиковую нагрузку', group: 'fleet', kind: 'norm', value: 15, unit: '%', source: 'Датасет, лист «Легенда»: 15–20%' },
  { code: 'operating_speed_ratio', name: 'Эксплуатационная скорость к максимальной', group: 'fleet', kind: 'assumption', value: 0.6, unit: 'коэф.', source: 'Допущение команды · проверяется симуляцией' },
  { code: 'robots_per_charger', name: 'Роботов на одну зарядную станцию', group: 'fleet', kind: 'assumption', value: 4, unit: 'шт.', source: 'Допущение команды' },
  { code: 'width_margin_m', name: 'Запас по ширине прохода (с двух сторон робота)', group: 'fleet', kind: 'norm', value: 0.6, unit: 'м', source: 'Правило карточки робота А2: ширина робота + 0,6 м ≤ проход, по 0,3 м с каждой стороны' },

  { code: 'charger_cost_rub', name: 'Зарядная станция с монтажом', group: 'capex', kind: 'assumption', value: 250_000, unit: '₽', source: 'Допущение команды · оценка рынка' },
  { code: 'charger_power_kw', name: 'Мощность зарядной станции', group: 'capex', kind: 'assumption', value: 5, unit: 'кВт', source: 'Допущение команды · типовые 3–10 кВт' },
  { code: 'fleet_software_pct', name: 'ПО управления флотом (разово)', group: 'capex', kind: 'assumption', value: 10, unit: '% оборудования', source: 'Допущение команды' },
  { code: 'delivery_pct', name: 'Доставка оборудования', group: 'capex', kind: 'assumption', value: 2, unit: '% оборудования', source: 'Допущение · доставка не входит в цену' },
  { code: 'commissioning_pct', name: 'Пусконаладочные работы', group: 'capex', kind: 'assumption', value: 5, unit: '% оборудования', source: 'Допущение · ПНР не входят в цену' },
  { code: 'training_cost_rub', name: 'Обучение персонала (на проект)', group: 'capex', kind: 'assumption', value: 300_000, unit: '₽', source: 'Допущение команды' },
  { code: 'contingency_pct', name: 'Резерв на непредвиденные расходы', group: 'capex', kind: 'norm', value: 10, unit: '% CAPEX', source: 'Датасет, лист «Легенда»' },

  { code: 'vendor_service_pct', name: 'Сервисный контракт вендора', group: 'opex', kind: 'assumption', value: 8, unit: '% оборуд./год', source: 'Допущение · отраслевой диапазон 5–10%' },
  { code: 'software_license_pct', name: 'Лицензии ПО (подписка)', group: 'opex', kind: 'assumption', value: 3, unit: '% оборуд./год', source: 'Допущение команды' },
  { code: 'unplanned_repair_pct', name: 'Внеплановый ремонт и запчасти', group: 'opex', kind: 'assumption', value: 2, unit: '% оборуд./год', source: 'Допущение команды' },
  { code: 'electricity_tariff_rub_kwh', name: 'Тариф на электроэнергию', group: 'opex', kind: 'assumption', value: 7.5, unit: '₽/кВт·ч', source: 'Допущение · уточнить по объекту' },
  { code: 'fleet_network_rub_year', name: 'Связь и Wi-Fi для флота', group: 'opex', kind: 'assumption', value: 60_000, unit: '₽/год на объект', source: 'Допущение команды' },
  { code: 'battery_life_years', name: 'Срок службы АКБ до замены', group: 'opex', kind: 'norm', value: 4, unit: 'года', source: 'Датасет, лист «Легенда»: 3–5 лет' },
  { code: 'battery_cost_pct', name: 'Стоимость комплекта АКБ', group: 'opex', kind: 'assumption', value: 10, unit: '% цены робота', source: 'Допущение команды' },

  { code: 'horizon_years', name: 'Горизонт расчёта (по умолчанию)', group: 'finance', kind: 'norm', value: 5, unit: 'лет', source: 'Датасет «Склад» · аэропорт и медучреждение — 7 лет' },
  { code: 'depreciation_years', name: 'Срок службы оборудования (амортизация линейная)', group: 'finance', kind: 'norm', value: 7, unit: 'лет', source: 'Методика расчёта: линейный метод' },
  { code: 'raas_rate_pct_month', name: 'Ставка RaaS (аренда)', group: 'finance', kind: 'assumption', value: 3, unit: '% цены в месяц', source: 'Допущение · рынок 2,5–4%/мес' },
  { code: 'raas_setup_fee_pct', name: 'Установочный платёж RaaS', group: 'finance', kind: 'assumption', value: 5, unit: '% оборудования', source: 'Допущение команды' },
  { code: 'debt_share_pct', name: 'Доля заёмного финансирования', group: 'finance', kind: 'norm', value: 0, unit: '%', source: 'Методика: база — собственные средства' },
  { code: 'loan_rate_pct', name: 'Ставка по кредиту', group: 'finance', kind: 'assumption', value: 20, unit: '% в год', source: 'Допущение · уточнить на дату расчёта' },
  { code: 'loan_term_years', name: 'Срок кредита', group: 'finance', kind: 'assumption', value: 3, unit: 'года', source: 'Допущение команды' },
  { code: 'discount_rate_pct', name: 'Ставка дисконтирования (для NPV)', group: 'finance', kind: 'assumption', value: 15, unit: '% в год', source: 'Допущение команды' },

  { code: 'payback_high_years', name: 'Граница «высокой целесообразности»', group: 'interpretation', kind: 'norm', value: 3, unit: 'года', source: 'Методика: интервалы до 3 / 3–5 / более 5 лет' },
  { code: 'payback_medium_years', name: 'Граница «средней целесообразности»', group: 'interpretation', kind: 'norm', value: 5, unit: 'лет', source: 'Методика: интервалы до 3 / 3–5 / более 5 лет' },
  { code: 'sensitivity_step_pct', name: 'Шаг анализа чувствительности', group: 'interpretation', kind: 'assumption', value: 20, symmetric: true, unit: '%', source: 'Допущение · минимум 3 параметра в анализе' },
  { code: 'simulation_tolerance_pct', name: 'Допуск расхождения симуляции и расчёта', group: 'interpretation', kind: 'norm', value: 10, symmetric: true, unit: '%', source: 'Методика: расчёт подтверждён, если отклонение симуляции в пределах допуска' },
]
