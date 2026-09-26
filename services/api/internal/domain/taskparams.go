package domain

import (
	"encoding/json"
	"fmt"
)

// TaskParams is the parameter set shared by a process (defaults) and a task (values).
// Shares are fractions from 0 to 1.
type TaskParams struct {
	CargoUnit              *string  `json:"cargoUnit" description:"Единица груза (носитель): паллета на полу, тележка…"`
	UnitMassKg             *float64 `json:"unitMassKg" description:"Масса единицы груза, кг"`
	CargoDivisible         *bool    `json:"cargoDivisible" description:"Груз делимый на несколько рейсов робота"`
	RoutePoints            []string `json:"routePoints" description:"Типовой маршрут: точки «откуда → куда»"`
	DailyVolume            *float64 `json:"dailyVolume" description:"Объём операций в сутки, в единице процесса"`
	WorkHoursPerDay        *float64 `json:"workHoursPerDay" description:"Часов работы процесса в сутки"`
	PeakFactor             *float64 `json:"peakFactor" description:"Пиковый коэффициент: макс. час ÷ средний час"`
	AutomationShare        *float64 `json:"automationShare" description:"Доля автоматизируемых операций, 0–1"`
	RouteLengthM           *float64 `json:"routeLengthM" description:"Средняя длина маршрута в одну сторону, м"`
	SiteSpeedLimitMps      *float64 `json:"siteSpeedLimitMps" description:"Ограничение скорости на объекте, м/с"`
	WidthClearanceM        *float64 `json:"widthClearanceM" description:"Запас по ширине для безопасного движения, м"`
	LiftTripShare          *float64 `json:"liftTripShare" description:"Доля рейсов через лифт, 0–1"`
	LiftTimeS              *float64 `json:"liftTimeS" description:"Ожидание и проезд лифта, с"`
	Environment            *string  `json:"environment" enum:"indoor,outdoor" description:"Среда работы"`
	MinAisleWidthM         *float64 `json:"minAisleWidthM" description:"Минимальная ширина прохода, м"`
	MinOperatingTempC      *float64 `json:"minOperatingTempC" description:"Мин. температура эксплуатации в зоне, °C"`
	RequiredLiftHeightMm   *float64 `json:"requiredLiftHeightMm" description:"Требуемая высота подъёма на ярус, мм"`
	TurnoverRate           *float64 `json:"turnoverRate" description:"Годовая текучесть исполнителей, 0–1"`
	WorkTimeLoss           *float64 `json:"workTimeLoss" description:"Потери рабочего времени, 0–1"`
	FleetOperatorsPerShift *float64 `json:"fleetOperatorsPerShift" description:"Операторов флота на смену"`
	FleetOperatorSalaryRub *float64 `json:"fleetOperatorSalaryRub" description:"Оклад оператора флота, ₽/мес."`
	SitePrepShare          *float64 `json:"sitePrepShare" description:"Подготовка объекта, доля стоимости парка, 0–1"`
	ItIntegrationRub       *float64 `json:"itIntegrationRub" description:"Интеграция с ИТ-системами, ₽"`
	ConsumablesPerRobotRub *float64 `json:"consumablesPerRobotRub" description:"Расходники на робота, ₽/год"`
	OtherEffectsRub        *float64 `json:"otherEffectsRub" description:"Иные измеримые эффекты, ₽/год"`
}

// FieldKind is the value kind of a task parameter.
type FieldKind int

const (
	KindNumber FieldKind = iota
	KindText
	KindBool
	KindTextList
	KindEnvironment
)

// ParamField describes one task parameter: API code, column, label and bounds.
type ParamField struct {
	Code   string
	Column string
	Label  string
	Unit   string
	Kind   FieldKind
	Min    *float64
	Max    *float64
}

var (
	zero = Ptr(0.0)
	one  = Ptr(1.0)
)

// TaskParamFields lists the task parameters in column order.
var TaskParamFields = []ParamField{
	{Code: "cargoUnit", Column: "cargo_unit", Label: "Единица груза", Kind: KindText},
	{Code: "unitMassKg", Column: "unit_mass_kg", Label: "Масса единицы груза", Unit: "кг", Kind: KindNumber, Min: zero, Max: Ptr(50000.0)},
	{Code: "cargoDivisible", Column: "cargo_divisible", Label: "Груз делимый на рейсы", Kind: KindBool},
	{Code: "routePoints", Column: "route_points", Label: "Типовой маршрут", Kind: KindTextList},
	{Code: "dailyVolume", Column: "daily_volume", Label: "Объём операций в сутки", Kind: KindNumber, Min: zero},
	{Code: "workHoursPerDay", Column: "work_hours_per_day", Label: "Часов работы процесса в сутки", Unit: "ч", Kind: KindNumber, Min: Ptr(0.5), Max: Ptr(24.0)},
	{Code: "peakFactor", Column: "peak_factor", Label: "Пиковый коэффициент", Kind: KindNumber, Min: one, Max: Ptr(5.0)},
	{Code: "automationShare", Column: "automation_share", Label: "Доля автоматизируемых операций", Kind: KindNumber, Min: zero, Max: one},
	{Code: "routeLengthM", Column: "route_length_m", Label: "Средняя длина маршрута в одну сторону", Unit: "м", Kind: KindNumber, Min: zero, Max: Ptr(50000.0)},
	{Code: "siteSpeedLimitMps", Column: "site_speed_limit_mps", Label: "Ограничение скорости на объекте", Unit: "м/с", Kind: KindNumber, Min: Ptr(0.1), Max: Ptr(30.0)},
	{Code: "widthClearanceM", Column: "width_clearance_m", Label: "Запас по ширине для безопасного движения", Unit: "м", Kind: KindNumber, Min: zero, Max: Ptr(3.0)},
	{Code: "liftTripShare", Column: "lift_trip_share", Label: "Доля рейсов через лифт", Kind: KindNumber, Min: zero, Max: one},
	{Code: "liftTimeS", Column: "lift_time_s", Label: "Ожидание и проезд лифта", Unit: "с", Kind: KindNumber, Min: zero, Max: Ptr(3600.0)},
	{Code: "environment", Column: "environment", Label: "Среда работы", Kind: KindEnvironment},
	{Code: "minAisleWidthM", Column: "min_aisle_width_m", Label: "Минимальная ширина прохода", Unit: "м", Kind: KindNumber, Min: Ptr(0.1), Max: Ptr(100.0)},
	{Code: "minOperatingTempC", Column: "min_operating_temp_c", Label: "Мин. температура эксплуатации", Unit: "°C", Kind: KindNumber, Min: Ptr(-60.0), Max: Ptr(60.0)},
	{Code: "requiredLiftHeightMm", Column: "required_lift_height_mm", Label: "Требуемая высота подъёма", Unit: "мм", Kind: KindNumber, Min: Ptr(1.0), Max: Ptr(50000.0)},
	{Code: "turnoverRate", Column: "turnover_rate", Label: "Годовая текучесть исполнителей", Kind: KindNumber, Min: zero, Max: one},
	{Code: "workTimeLoss", Column: "work_time_loss", Label: "Потери рабочего времени", Kind: KindNumber, Min: zero, Max: one},
	{Code: "fleetOperatorsPerShift", Column: "fleet_operators_per_shift", Label: "Операторов флота на смену", Unit: "чел.", Kind: KindNumber, Min: zero, Max: Ptr(100.0)},
	{Code: "fleetOperatorSalaryRub", Column: "fleet_operator_salary_rub", Label: "Оклад оператора флота", Unit: "₽/мес.", Kind: KindNumber, Min: zero},
	{Code: "sitePrepShare", Column: "site_prep_share", Label: "Подготовка объекта, доля стоимости парка", Kind: KindNumber, Min: zero, Max: one},
	{Code: "itIntegrationRub", Column: "it_integration_rub", Label: "Интеграция с ИТ-системами", Unit: "₽", Kind: KindNumber, Min: zero},
	{Code: "consumablesPerRobotRub", Column: "consumables_per_robot_rub", Label: "Расходники на робота", Unit: "₽/год", Kind: KindNumber, Min: zero},
	{Code: "otherEffectsRub", Column: "other_effects_rub", Label: "Иные измеримые эффекты", Unit: "₽/год", Kind: KindNumber},
}

// TaskParamField finds a parameter by API code.
func TaskParamField(code string) (ParamField, bool) {
	for _, f := range TaskParamFields {
		if f.Code == code {
			return f, true
		}
	}
	return ParamField{}, false
}

// TaskParamColumns returns the column names in order.
func TaskParamColumns() []string {
	cols := make([]string, len(TaskParamFields))
	for i, f := range TaskParamFields {
		cols[i] = f.Column
	}
	return cols
}

// Targets returns pointers to the fields in TaskParamFields order, for scanning.
func (p *TaskParams) Targets() []any {
	return []any{
		&p.CargoUnit, &p.UnitMassKg, &p.CargoDivisible, &p.RoutePoints,
		&p.DailyVolume, &p.WorkHoursPerDay, &p.PeakFactor, &p.AutomationShare,
		&p.RouteLengthM, &p.SiteSpeedLimitMps, &p.WidthClearanceM, &p.LiftTripShare, &p.LiftTimeS,
		&p.Environment, &p.MinAisleWidthM, &p.MinOperatingTempC, &p.RequiredLiftHeightMm,
		&p.TurnoverRate, &p.WorkTimeLoss, &p.FleetOperatorsPerShift, &p.FleetOperatorSalaryRub,
		&p.SitePrepShare, &p.ItIntegrationRub, &p.ConsumablesPerRobotRub, &p.OtherEffectsRub,
	}
}

// Values returns the field values in TaskParamFields order, for inserting.
func (p *TaskParams) Values() []any {
	points := p.RoutePoints
	if points == nil {
		points = []string{}
	}
	return []any{
		p.CargoUnit, p.UnitMassKg, p.CargoDivisible, points,
		p.DailyVolume, p.WorkHoursPerDay, p.PeakFactor, p.AutomationShare,
		p.RouteLengthM, p.SiteSpeedLimitMps, p.WidthClearanceM, p.LiftTripShare, p.LiftTimeS,
		p.Environment, p.MinAisleWidthM, p.MinOperatingTempC, p.RequiredLiftHeightMm,
		p.TurnoverRate, p.WorkTimeLoss, p.FleetOperatorsPerShift, p.FleetOperatorSalaryRub,
		p.SitePrepShare, p.ItIntegrationRub, p.ConsumablesPerRobotRub, p.OtherEffectsRub,
	}
}

// Number returns the pointer slot of a numeric field.
func (p *TaskParams) Number(code string) (**float64, bool) {
	for i, f := range TaskParamFields {
		if f.Code == code && f.Kind == KindNumber {
			slot, ok := p.Targets()[i].(**float64)
			return slot, ok
		}
	}
	return nil, false
}

// IsSet reports whether the field has a value.
func (p *TaskParams) IsSet(code string) bool {
	for i, f := range TaskParamFields {
		if f.Code != code {
			continue
		}
		switch t := p.Targets()[i].(type) {
		case **float64:
			return *t != nil
		case **string:
			return *t != nil
		case **bool:
			return *t != nil
		case *[]string:
			return len(*t) > 0
		}
	}
	return false
}

// Copy returns a deep copy.
func (p TaskParams) Copy() TaskParams {
	c := p
	c.RoutePoints = append([]string(nil), p.RoutePoints...)
	return c
}

// Validate checks ranges and enumerations; field paths are prefixed with prefix.
func (p *TaskParams) Validate(prefix string) []FieldError {
	var v Validator
	for i, f := range TaskParamFields {
		field := prefix + f.Code
		switch t := p.Targets()[i].(type) {
		case **float64:
			v.Range(field, f.Label, *t, f.Min, f.Max, f.Unit)
		case **string:
			if f.Kind == KindEnvironment && *t != nil {
				v.OneOf(field, f.Label, **t, Codes(TaskEnvironments))
			}
		}
	}
	return v.errs
}

// ApplyPatch sets the fields present in raw (null clears) and returns the changed codes.
// Unknown keys are ignored so that the caller can mix params with other fields.
func (p *TaskParams) ApplyPatch(raw map[string]json.RawMessage, prefix string) ([]string, []FieldError) {
	var changed []string
	var errs []FieldError
	targets := p.Targets()
	for i, f := range TaskParamFields {
		msg, ok := raw[f.Code]
		if !ok {
			continue
		}
		if err := json.Unmarshal(msg, targets[i]); err != nil {
			errs = append(errs, FieldError{
				Field: prefix + f.Code, Code: "invalid_type",
				Message: fmt.Sprintf("Поле «%s»: неверный формат значения", f.Label),
				Hint:    typeHint(f.Kind),
			})
			continue
		}
		changed = append(changed, f.Code)
	}
	return changed, errs
}

func typeHint(k FieldKind) string {
	switch k {
	case KindNumber:
		return "Укажите число, например 2000 или 0.95"
	case KindBool:
		return "Укажите true или false"
	case KindTextList:
		return "Укажите список строк"
	case KindEnvironment:
		return "Укажите indoor или outdoor"
	}
	return "Укажите текст"
}
