package economics

import "strings"

// Russian labels of the economics formula ids (services/economics application/calculation.py).
// An id missing here is shown as is; TestLabelsCoverFixture keeps the list complete.
var traceLabels = map[string]string{
	"candidate.labor.replacement_share":                     "Коэффициент замещения труда",
	"candidate.labor.scenario_baseline_payroll":             "ФОТ исполнителей в сценарии",
	"candidate.labor.released_fte":                          "Высвобождаемые ставки",
	"candidate.labor.annual_payroll_saving":                 "Экономия ФОТ в год",
	"candidate.labor.remaining_annual_payroll":              "Оставшийся ФОТ исполнителей",
	"candidate.demand.scenario_operations_per_day":          "Объём операций в сутки",
	"candidate.demand.automatable_operations_per_day":       "Операций к роботизации в сутки",
	"candidate.demand.trips_per_operation":                  "Рейсов на операцию",
	"candidate.demand.operating_hours_per_day":              "Часов работы в сутки",
	"candidate.demand.average_operations_per_hour":          "Операций к роботизации в средний час",
	"candidate.demand.peak_automatable_operations_per_hour": "Операций к роботизации в пиковый час",
	"candidate.demand.peak_trips_per_hour":                  "Рейсов в пиковый час",
	"candidate.productivity.one_way_route_m":                "Длина маршрута в одну сторону",
	"candidate.productivity.operating_speed_mps":            "Эксплуатационная скорость",
	"candidate.productivity.round_trip_movement_seconds":    "Движение туда и обратно",
	"candidate.productivity.round_trip_lift_seconds":        "Лифт туда и обратно",
	"candidate.productivity.cycle_seconds":                  "Время цикла рейса",
	"candidate.productivity.nominal_cycles_per_hour":        "Номинальных циклов в час",
	"candidate.productivity.effective_trips_per_robot_hour": "Эффективных рейсов на робота в час",
	"candidate.fleet.robot_count":                           "Роботов в парке",
	"candidate.fleet.charger_count":                         "Зарядных станций",
	"candidate.fleet.peak_capacity_per_hour":                "Пропускная способность парка в пик",
	"candidate.fleet.average_utilization":                   "Средняя загрузка парка",
	"candidate.fleet.required_charging_power_kw":            "Требуемая мощность зарядки",
	"candidate.price.adjusted_robot_price":                  "Цена робота в сценарии",
	"candidate.price.is_purchase":                           "Покупка (1) или RaaS (0)",
	"candidate.capex.equipment":                             "Оборудование",
	"candidate.capex.charging":                              "Зарядная инфраструктура",
	"candidate.capex.site_preparation":                      "Подготовка объекта",
	"candidate.capex.software":                              "ПО управления флотом",
	"candidate.capex.integration":                           "Интеграция с ИТ-системами",
	"candidate.capex.delivery":                              "Доставка",
	"candidate.capex.commissioning":                         "Пусконаладка; для RaaS — установочный платёж",
	"candidate.capex.training":                              "Обучение персонала",
	"candidate.capex.before_contingency":                    "CAPEX до резерва",
	"candidate.capex.contingency":                           "Резерв на непредвиденные расходы",
	"candidate.capex.total":                                 "CAPEX",
	"candidate.opex.baseline_annual_opex":                   "Текущий процесс: ФОТ исполнителей",
	"candidate.opex.annual_raas_cost":                       "Платёж RaaS",
	"candidate.opex.annual_service_cost":                    "Сервисный контракт",
	"candidate.opex.annual_license_cost":                    "Лицензии ПО",
	"candidate.opex.annual_repair_cost":                     "Ремонт и запчасти",
	"candidate.opex.annual_energy_cost":                     "Электроэнергия",
	"candidate.opex.annual_connectivity_cost":               "Связь и Wi-Fi",
	"candidate.opex.annual_consumables_cost":                "Расходные материалы",
	"candidate.opex.annual_fleet_staff_cost":                "Персонал эксплуатации флота",
	"candidate.opex.annual_financing_cost":                  "Обслуживание кредита",
	"candidate.opex.annual_solution_opex":                   "Новые расходы решения в год",
	"candidate.opex.annual_process_opex":                    "Расходы процесса после внедрения",
	"candidate.effects.change_in_annual_opex":               "Изменение расходов к текущему процессу",
	"candidate.effects.annual_recruitment_saving":           "Экономия на подборе персонала",
	"candidate.effects.annual_other_benefits":               "Иные эффекты",
	"candidate.effects.net_annual_benefit":                  "Годовой денежный эффект",
	"candidate.effects.annual_depreciation":                 "Амортизация в год",
	"candidate.effects.annual_benefit_after_depreciation":   "Эффект после амортизации",
	"candidate.returns.simple_payback_years":                "Простой срок окупаемости",
	"candidate.returns.horizon_years":                       "Горизонт расчёта",
	"candidate.returns.battery_replacement_events":          "Замен АКБ за горизонт",
	"candidate.returns.fleet_battery_replacement_cost":      "Замена АКБ парка",
	"candidate.returns.cumulative_operating_benefit":        "Накопленный эффект за горизонт",
	"candidate.returns.workbook_roi":                        "ROI",
	"candidate.returns.solution_tco":                        "TCO решения",
	"candidate.returns.baseline_process_tco":                "TCO текущего процесса",
	"candidate.returns.robotized_process_tco":               "TCO процесса после внедрения",
	"candidate.returns.change_in_process_tco":               "Изменение TCO процесса",
	"candidate.budget.within_budget":                        "В рамках бюджета",
	"candidate.budget.overage":                              "Превышение бюджета",
	"candidate.budget.overage_share":                        "Превышение бюджета, доля",
	"candidate.interpretation":                              "Интерпретация окупаемости",
}

// capexItems and opexItems are the cost articles shown on the economics tab, in screen order.
var capexItems = []string{
	"candidate.capex.equipment", "candidate.capex.charging", "candidate.capex.site_preparation", "candidate.capex.software",
	"candidate.capex.integration", "candidate.capex.delivery", "candidate.capex.commissioning", "candidate.capex.training",
	"candidate.capex.contingency",
}

var opexItems = []string{
	"candidate.labor.remaining_annual_payroll", "candidate.opex.annual_raas_cost", "candidate.opex.annual_service_cost",
	"candidate.opex.annual_license_cost", "candidate.opex.annual_repair_cost", "candidate.opex.annual_energy_cost",
	"candidate.opex.annual_connectivity_cost", "candidate.opex.annual_consumables_cost",
	"candidate.opex.annual_fleet_staff_cost", "candidate.opex.annual_financing_cost",
}

var unitLabels = map[string]string{
	"RUB": "₽", "RUB/year": "₽/год", "fraction": "доля", "years": "лет", "hours/day": "ч/сут",
	"operations/day": "операций/сут", "operations/hour": "операций/ч", "trips": "рейсов", "trips/hour": "рейсов/ч",
	"cycles/hour": "циклов/ч", "m": "м", "m/s": "м/с", "seconds": "с", "robots": "шт.", "chargers": "шт.",
	"kW": "кВт", "FTE": "ставок", "events": "раз", "boolean": "да/нет", "TRL": "УГТ", "%": "%",
}

func unitRu(u string) string {
	if ru, ok := unitLabels[u]; ok {
		return ru
	}
	return u
}

var criterionLabels = map[string]string{
	"payback": "Окупаемость", "roi": "ROI", "annual_effect": "Годовой эффект", "budget_fit": "CAPEX к бюджету",
	"tco_savings": "TCO", "maturity": "Зрелость решения", "data_quality": "Полнота данных", "fleet_utilization": "Загрузка парка",
}

var catalogStatuses = map[string]string{"operation": "эксплуатация", "piloting": "пилотирование", "rnd": "разработка"}

const riskChargingPower = "Available charging power is insufficient."

var riskTexts = map[string]string{
	"Catalog price is missing; economics are unresolved.":          "Нет цены робота в каталоге — экономику не посчитать",
	"Maximum speed is missing; productivity is unresolved.":        "Нет максимальной скорости робота — производительность не посчитать",
	"Loading time is missing; productivity is unresolved.":         "Нет времени погрузки робота — производительность не посчитать",
	"Unloading time is missing; productivity is unresolved.":       "Нет времени разгрузки робота — производительность не посчитать",
	"Average power is missing; OPEX is unresolved.":                "Нет средней мощности робота — OPEX не посчитать",
	"Handling method is missing; labor replacement is unresolved.": "Не указан способ обработки груза — замещение труда не посчитать",
	"Payload is missing for a divisible-load calculation.":         "Нет грузоподъёмности робота — для делимого груза число рейсов не посчитать",
	"Catalog technical specifications require confirmation.":       "Характеристики из каталога требуют подтверждения",
	"CAPEX exceeds the planning budget.":                           "CAPEX превышает бюджет локации",
	riskChargingPower:                                              "Доступной мощности локации не хватает для зарядных станций",
	"The modeled net annual benefit is not positive.":              "Годовой денежный эффект не положительный — решение не окупается",
}

// riskRu translates a risk of the economics service; an unknown text is kept as is.
func riskRu(risk string) string {
	if ru, ok := riskTexts[risk]; ok {
		return ru
	}
	if status, ok := strings.CutPrefix(risk, "Catalog maturity status is "); ok {
		status = strings.TrimSuffix(status, ".")
		if ru, ok := catalogStatuses[status]; ok {
			status = ru
		}
		return "Статус решения в каталоге: " + status
	}
	if rest, ok := strings.CutPrefix(risk, "Average fleet utilization is below "); ok {
		return "Средняя загрузка парка ниже " + strings.TrimSuffix(rest, ".")
	}
	return risk
}

// feasibility maps the interpretation of the economics service to a code and a Russian text.
func feasibility(interpretation string) (code, text string, ok bool) {
	switch {
	case interpretation == "High suitability.":
		return "high", "Высокая целесообразность", true
	case interpretation == "Medium suitability; pilot recommended.":
		return "medium", "Средняя целесообразность, рекомендован пилот", true
	case interpretation == "Low suitability; requires clarification.":
		return "low", "Низкая целесообразность, требуется уточнение", true
	case strings.HasPrefix(interpretation, "Does not pay back"):
		return "none", "Не окупается: годовой эффект не положительный", true
	}
	return "", interpretation, false
}
