package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Norm kinds (PRD 6.8, экран А5): a norm comes from the organizer data or the methodology,
// an assumption is a team value that has to be justified in the documentation.
const (
	NormKindNorm       = "norm"
	NormKindAssumption = "assumption"
)

// NormValue is one calculation norm of a norm set.
type NormValue struct {
	Code   string  `json:"code"`
	Group  string  `json:"group" enum:"staff,fleet,capex,opex,finance,interpretation,robot_defaults,ranking"`
	Label  string  `json:"label"`
	Value  float64 `json:"value"`
	Unit   string  `json:"unit"`
	Kind   string  `json:"kind" enum:"norm,assumption"`
	Source string  `json:"source" description:"Основание значения: датасет, ТЗ или допущение команды"`
}

// NormSet is an immutable version of the calculation norms. New projects pin the latest
// version; a project keeps calculating on its own version until the snapshot is refreshed.
type NormSet struct {
	ID        uuid.UUID   `json:"id"`
	Version   int         `json:"version"`
	Label     string      `json:"label"`
	Note      *string     `json:"note"`
	CreatedAt time.Time   `json:"createdAt"`
	Values    []NormValue `json:"values"`
}

// NormSetSummary is a norm set without its values, for the version list.
type NormSetSummary struct {
	ID        uuid.UUID `json:"id"`
	Version   int       `json:"version"`
	Label     string    `json:"label"`
	Note      *string   `json:"note"`
	CreatedAt time.Time `json:"createdAt"`
}

// Value returns the value of a norm by code.
func (s NormSet) Value(code string) (float64, bool) {
	for _, v := range s.Values {
		if v.Code == code {
			return v.Value, true
		}
	}
	return 0, false
}

// NormDefinition describes a norm: its place on screen А5, bounds and the default value.
type NormDefinition struct {
	NormValue
	Min *float64
	Max *float64
}

// Ranking weight codes: the eight criteria of the ranking-v1 methodology of services/economics.
var RankingWeightCodes = []string{
	"ranking_weight_payback", "ranking_weight_roi", "ranking_weight_annual_effect", "ranking_weight_budget_fit",
	"ranking_weight_tco_savings", "ranking_weight_maturity", "ranking_weight_data_quality", "ranking_weight_fleet_utilization",
}

func norm(code, group, label string, value float64, unit, kind, source string, min, max *float64) NormDefinition {
	return NormDefinition{NormValue: NormValue{Code: code, Group: group, Label: label, Value: value, Unit: unit, Kind: kind,
		Source: source}, Min: min, Max: max}
}

var (
	fraction = [2]*float64{Ptr(0.0), Ptr(1.0)}
	positive = Ptr(0.000001)
)

// NormDefinitions are the norms of screen А5 (PRD 6.8) with the values of the first version.
// Codes of the economic norms match the NormsDto fields of services/economics. Shares are
// fractions from 0 to 1, as everywhere in the API.
var NormDefinitions = []NormDefinition{
	norm("payroll_multiplier", "staff", "Коэффициент начислений на ФОТ (страховые взносы)", 1.302, "коэф.", NormKindNorm,
		"Датасет: ОПФ 22% + ОМС 5,1% + ОСС 2,9% + НСиПЗ 0,2% [ДС-Легенда]", Ptr(1.0), Ptr(2.0)),
	norm("staff_time_loss_share", "staff", "Коэффициент потерь рабочего времени (по умолчанию)", 0.25, "доля", NormKindNorm,
		"Датасет «Склад»; для аэропорта и медучреждения — допущение [ДС-Склад]", fraction[0], fraction[1]),
	norm("recruitment_months_salary", "staff", "Стоимость замены сотрудника (подбор и адаптация)", 0.5, "окладов", NormKindAssumption,
		"Допущение команды · HR-бенчмарк", Ptr(0.0), Ptr(24.0)),

	norm("productive_time_share", "fleet", "Коэффициент загрузки робота", 0.8, "доля", NormKindNorm,
		"Датасет, лист «Легенда»: типовой KPI AMR 70–85% [ДС-Легенда]", fraction[0], fraction[1]),
	norm("technical_availability", "fleet", "Коэффициент технической готовности", 0.95, "доля", NormKindAssumption,
		"Допущение команды · SLA вендоров 95–98%", fraction[0], fraction[1]),
	norm("fleet_reserve_share", "fleet", "Резерв парка на пиковую нагрузку", 0.15, "доля", NormKindNorm,
		"Датасет, лист «Легенда»: 15–20% [ДС-Легенда]", fraction[0], fraction[1]),
	norm("operating_speed_factor", "fleet", "Эксплуатационная скорость к максимальной", 0.6, "коэф.", NormKindAssumption,
		"Допущение команды · проверяется симуляцией", positive, fraction[1]),
	norm("robots_per_charger", "fleet", "Роботов на одну зарядную станцию", 4, "шт.", NormKindAssumption,
		"Допущение команды", positive, Ptr(100.0)),

	norm("charger_installed_price", "capex", "Зарядная станция с монтажом", 250_000, "₽", NormKindAssumption,
		"Допущение команды · оценка рынка", Ptr(0.0), nil),
	norm("charger_power_kw", "capex", "Мощность зарядной станции", 5, "кВт", NormKindAssumption,
		"Допущение команды · типовые 3–10 кВт", positive, Ptr(1000.0)),
	norm("fms_upfront_share", "capex", "ПО управления флотом (разово)", 0.10, "доля оборудования", NormKindAssumption,
		"Допущение команды", fraction[0], fraction[1]),
	norm("delivery_share", "capex", "Доставка оборудования", 0.02, "доля оборудования", NormKindAssumption,
		"Допущение · доставка не входит в цену [Доп. 6]", fraction[0], fraction[1]),
	norm("commissioning_share", "capex", "Пусконаладочные работы", 0.05, "доля оборудования", NormKindAssumption,
		"Допущение · ПНР не входят в цену [Доп. 6]", fraction[0], fraction[1]),
	norm("training_cost", "capex", "Обучение персонала (на проект)", 300_000, "₽", NormKindAssumption,
		"Допущение команды", Ptr(0.0), nil),
	norm("capex_contingency_share", "capex", "Резерв на непредвиденные расходы", 0.10, "доля CAPEX", NormKindNorm,
		"Датасет, лист «Легенда» [ДС-Легенда]", fraction[0], fraction[1]),
	norm("site_preparation_share", "capex", "Подготовка объекта", 0.05, "доля оборудования", NormKindAssumption,
		"Допущение команды; в экране А5 строки нет — PRD 6.8 просит добавить норматив подготовки пола", fraction[0], fraction[1]),

	norm("annual_service_share", "opex", "Сервисный контракт вендора", 0.08, "доля оборудования в год", NormKindAssumption,
		"Допущение · отраслевой диапазон 5–10%", fraction[0], fraction[1]),
	norm("annual_license_share", "opex", "Лицензии ПО (подписка)", 0.03, "доля оборудования в год", NormKindAssumption,
		"Допущение команды", fraction[0], fraction[1]),
	norm("annual_repair_share", "opex", "Внеплановый ремонт и запчасти", 0.02, "доля оборудования в год", NormKindAssumption,
		"Допущение команды", fraction[0], fraction[1]),
	norm("electricity_price", "opex", "Тариф на электроэнергию", 7.5, "₽/кВт·ч", NormKindAssumption,
		"Допущение · уточнить по объекту", Ptr(0.0), Ptr(100.0)),
	norm("annual_connectivity_cost", "opex", "Связь и Wi-Fi для флота", 60_000, "₽/год", NormKindAssumption,
		"Допущение команды", Ptr(0.0), nil),
	norm("battery_life_years", "opex", "Срок службы АКБ до замены", 4, "лет", NormKindNorm,
		"Датасет, лист «Легенда»: 3–5 лет [ДС-Легенда]", positive, Ptr(30.0)),
	norm("battery_replacement_share", "opex", "Стоимость комплекта АКБ", 0.10, "доля цены робота", NormKindAssumption,
		"Допущение команды", fraction[0], fraction[1]),

	norm("horizon_years", "finance", "Горизонт расчёта (по умолчанию)", 5, "лет", NormKindNorm,
		"Датасет «Склад» · аэропорт и медучреждение — 7 лет [ДС-Склад, ДС-Аэропорт, ДС-Мед]", Ptr(5.0), Ptr(30.0)),
	norm("equipment_life_years", "finance", "Срок службы оборудования (амортизация линейная)", 7, "лет", NormKindNorm,
		"Метод — [Доп. 2.2]; значение — допущение", positive, Ptr(50.0)),
	norm("monthly_raas_share", "finance", "Ставка RaaS (аренда)", 0.03, "доля цены в месяц", NormKindAssumption,
		"Допущение · рынок 2,5–4%/мес [Доп. 2.4]", fraction[0], fraction[1]),
	norm("raas_setup_share", "finance", "Установочный платёж RaaS", 0.05, "доля оборудования", NormKindAssumption,
		"Допущение команды [Доп. 2.4]", fraction[0], fraction[1]),
	norm("loan_share", "finance", "Доля заёмного финансирования", 0, "доля", NormKindNorm,
		"Методика: база — собственные средства [Доп. 2.1]", fraction[0], fraction[1]),
	norm("loan_interest_rate", "finance", "Ставка по кредиту", 0.20, "доля в год", NormKindAssumption,
		"Допущение · уточнить на дату расчёта [Доп. 2.1]", fraction[0], fraction[1]),
	norm("loan_term_years", "finance", "Срок кредита", 3, "лет", NormKindAssumption,
		"Допущение команды [Доп. 2.1]", positive, Ptr(30.0)),
	norm("discount_rate", "finance", "Ставка дисконтирования (для NPV)", 0.15, "доля в год", NormKindAssumption,
		"Допущение команды; в модели economics-v1.1 не используется (VAL-004)", fraction[0], fraction[1]),

	norm("good_payback_years", "interpretation", "Граница «высокой целесообразности»", 3, "лет", NormKindNorm,
		"Методика: интервалы до 3 / 3–5 / более 5 лет [ТЗ 3.5.7]", positive, Ptr(50.0)),
	norm("medium_payback_years", "interpretation", "Граница «средней целесообразности»", 5, "лет", NormKindNorm,
		"Методика: интервалы до 3 / 3–5 / более 5 лет [ТЗ 3.5.7]", positive, Ptr(50.0)),
	norm("sensitivity_step", "interpretation", "Шаг анализа чувствительности", 0.20, "доля", NormKindAssumption,
		"Шаг — допущение; 3 параметра — [ТЗ 3.5.6]", fraction[0], fraction[1]),
	norm("simulation_tolerance", "interpretation", "Допуск расхождения симуляции и расчёта", 0.10, "доля", NormKindNorm,
		"Допущение; требование подтверждать расчёт — [ТЗ 3.6.2]", fraction[0], fraction[1]),

	norm("default_handling_seconds", "robot_defaults", "Погрузка или разгрузка, если в ТТХ нет", 30, "с", NormKindAssumption,
		"Допущение команды: у большинства позиций каталога нет ТТХ [Доп. 3.2, 4]", Ptr(0.0), Ptr(3600.0)),
	norm("default_avg_power_kw", "robot_defaults", "Средняя мощность робота, если в ТТХ нет", 0.5, "кВт", NormKindAssumption,
		"Допущение команды: у большинства позиций каталога нет ТТХ [Доп. 3.2, 4]", Ptr(0.0), Ptr(1000.0)),

	norm("ranking_weight_payback", "ranking", "Вес критерия «Окупаемость»", 30, "%", NormKindAssumption,
		"PRD 11.3: веса — решение команды, организатором не заданы", Ptr(0.0), Ptr(100.0)),
	norm("ranking_weight_roi", "ranking", "Вес критерия «ROI»", 15, "%", NormKindAssumption,
		"PRD 11.3", Ptr(0.0), Ptr(100.0)),
	norm("ranking_weight_annual_effect", "ranking", "Вес критерия «Годовой эффект»", 10, "%", NormKindAssumption,
		"PRD 11.3; в ranking-v1 по умолчанию 15 (расхождение 116)", Ptr(0.0), Ptr(100.0)),
	norm("ranking_weight_budget_fit", "ranking", "Вес критерия «CAPEX к бюджету»", 10, "%", NormKindAssumption,
		"PRD 11.3", Ptr(0.0), Ptr(100.0)),
	norm("ranking_weight_tco_savings", "ranking", "Вес критерия «TCO»", 10, "%", NormKindAssumption,
		"PRD 11.3", Ptr(0.0), Ptr(100.0)),
	norm("ranking_weight_maturity", "ranking", "Вес критерия «Зрелость решения»", 10, "%", NormKindAssumption,
		"PRD 11.3", Ptr(0.0), Ptr(100.0)),
	norm("ranking_weight_data_quality", "ranking", "Вес критерия «Полнота данных»", 10, "%", NormKindAssumption,
		"PRD 11.3; в ranking-v1 по умолчанию 5 (расхождение 116)", Ptr(0.0), Ptr(100.0)),
	norm("ranking_weight_fleet_utilization", "ranking", "Вес критерия «Загрузка парка»", 5, "%", NormKindAssumption,
		"PRD 11.3", Ptr(0.0), Ptr(100.0)),
}

// NormDefinitionOf finds a definition by code.
func NormDefinitionOf(code string) (NormDefinition, bool) {
	for _, d := range NormDefinitions {
		if d.Code == code {
			return d, true
		}
	}
	return NormDefinition{}, false
}

// DefaultNormValues returns the values of the first norm set.
func DefaultNormValues() []NormValue {
	out := make([]NormValue, len(NormDefinitions))
	for i, d := range NormDefinitions {
		out[i] = d.NormValue
	}
	return out
}

// ValidateNormValues checks a complete set: every definition present, bounds, and ranking
// weights summing to 100 (services/economics rejects any other sum).
func ValidateNormValues(values []NormValue) []FieldError {
	var v Validator
	byCode := make(map[string]float64, len(values))
	for _, nv := range values {
		byCode[nv.Code] = nv.Value
	}
	for _, d := range NormDefinitions {
		value, ok := byCode[d.Code]
		if !ok {
			v.Add("values."+d.Code, "required", fmt.Sprintf("Норматив «%s» не задан", d.Label), "Укажите значение")
			continue
		}
		v.Range("values."+d.Code, d.Label, &value, d.Min, d.Max, d.Unit)
	}
	sum := 0.0
	for _, code := range RankingWeightCodes {
		sum += byCode[code]
	}
	if sum < 99.999 || sum > 100.001 {
		v.Add("values.ranking", "invalid_sum", fmt.Sprintf("Сумма весов критериев рейтинга — %s%%, нужно 100%%", FormatNumber(sum)),
			"Перераспределите веса так, чтобы в сумме было 100")
	}
	return v.errs
}
