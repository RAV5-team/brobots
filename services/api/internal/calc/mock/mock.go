// Package mock is a simplified in-process calculation model. It stands in for services/economics
// until the service exists: the formulas follow PRD 4.5–4.6 in a reduced form, and every value is
// traced with its formula and source.
package mock

import (
	"context"
	"math"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
)

// Version identifies the formulas and norms of this model.
const Version = "mock-calc/v1"

const mockWarning = "Предварительная оценка мок-модели: формулы упрощены, сервис экономики ещё не подключён"

// Calculator is the mock model.
type Calculator struct{}

// New creates the mock model.
func New() Calculator { return Calculator{} }

// ModelVersion returns Version.
func (Calculator) ModelVersion(context.Context) (string, error) { return Version, nil }

// Calculate evaluates every candidate under every requested acquisition model.
func (Calculator) Calculate(_ context.Context, req calc.Request) (calc.Response, error) {
	resp := calc.Response{ModelVersion: Version, Results: []calc.Result{}}
	for _, c := range req.Candidates {
		for _, model := range c.Models(req.AcquisitionModels) {
			resp.Results = append(resp.Results, evaluate(req, c, model))
		}
	}
	return resp, nil
}

type tracer struct {
	items []calc.TraceItem
}

func (t *tracer) add(code, label string, v float64, unit, formula, source string) float64 {
	t.items = append(t.items, calc.TraceItem{Code: code, Label: label, Value: domain.Ptr(v), Unit: unit, Formula: formula, Source: source})
	return v
}

// input traces a value given by the request, or the norm when the request has none.
func (t *tracer) input(code, label string, v *float64, norm float64, unit, source string) float64 {
	if v != nil {
		return t.add(code, label, *v, unit, "", source)
	}
	return t.add(code, label, norm, unit, "", "norm")
}

func evaluate(req calc.Request, c calc.Candidate, model string) calc.Result {
	t := &tracer{}
	r := calc.Result{SolutionID: c.SolutionID, AcquisitionModel: model, Warnings: []string{mockWarning}}
	done := func(reason string) calc.Result {
		if reason != "" {
			r.Reason = &reason
		} else {
			r.Calculable = true
		}
		r.Trace = t.items
		return r
	}
	p, d := req.Task.Params, req.Task.Derived
	unit := req.Task.WorkType.UnitLabel
	if req.Task.KpiUnit != nil {
		unit = *req.Task.KpiUnit
	}

	if d.PeakToRobotizePerHour == nil || p.WorkHoursPerDay == nil {
		return done("Не хватает данных задачи: объём в сутки, часы работы, пиковый коэффициент и доля автоматизации")
	}
	peak := t.add("peak_demand", "Пик к роботизации", *d.PeakToRobotizePerHour, unit+"/ч",
		"объём ÷ часы работы × пиковый коэффициент × доля автоматизации", "task")
	perRobot, ok := throughput(t, req.Task, c, unit, &r)
	if !ok {
		return done("Нет производительности робота: ни в строке класса операции, ни по скорости и длине маршрута")
	}
	util := t.add("utilization", "Загрузка робота", utilization, "доля", "", "norm")
	avail := t.add("availability", "Техническая готовность", availability, "доля", "", "norm")
	reserve := t.add("fleet_reserve", "Резерв парка", fleetReserve, "доля", "", "norm")
	effective := t.add("effective_throughput", "Эффективная производительность", perRobot*util*avail, unit+"/ч",
		"производительность × загрузка × готовность", "derived")
	robots := math.Max(1, math.Ceil(peak/effective*(1+reserve)))
	t.add("robot_count", "Роботов в парке", robots, "шт.", "⌈пик ÷ эффективная производительность × (1 + резерв)⌉", "derived")
	chargers := chargerCount(t, c.Spec, robots)
	r.RobotCount, r.ChargerCount = domain.Ptr(int(robots)), domain.Ptr(int(chargers))

	if c.Offer == nil || c.Offer.Price.AmountRub == nil {
		return done("Нет цены робота в каталоге — экономику не посчитать")
	}
	if c.Offer.Price.Unit != "item" {
		return done("Цена робота указана не за единицу — мок-модель такую цену не считает")
	}
	price := t.add("robot_price", "Цена робота", *c.Offer.Price.AmountRub, "₽", "", "robot")
	fleetCost := t.add("fleet_cost", "Стоимость парка", robots*price, "₽", "роботов × цена", "derived")
	prep := t.input("site_prep_share", "Подготовка объекта", p.SitePrepShare, sitePrepShare, "доля", "task")
	sitePrep := t.add("site_prep", "Подготовка объекта", fleetCost*prep, "₽", "стоимость парка × доля подготовки", "derived")
	integration := t.input("it_integration", "Интеграция с ИТ-системами", p.ItIntegrationRub, 0, "₽", "task")

	hours := *p.WorkHoursPerDay
	power := t.input("robot_power", "Средняя мощность робота", specValue(c.Spec, func(s *domain.RobotSpec) *float64 { return s.AvgPowerKw }), robotPowerKw, "кВт", "robot")
	tariff := t.add("energy_tariff", "Тариф на электроэнергию", energyTariffRub, "₽/кВт·ч", "", "norm")
	energy := t.add("energy", "Электроэнергия", robots*power*hours*daysPerYear*tariff, "₽/год", "роботов × мощность × часов в сутки × 365 × тариф", "derived")
	consumables := t.add("consumables", "Расходники", robots*t.input("consumables_per_robot", "Расходники на робота", p.ConsumablesPerRobotRub, 0, "₽/год", "task"),
		"₽/год", "роботов × расходники на робота", "derived")
	operators := operatorsCost(t, p, d, hours)

	var capex, opex float64
	if model == calc.RaaS {
		rentShare := t.add("raas_rent_share", "Аренда робота в год", raasRentShare, "доля цены", "", "norm")
		rent := t.add("raas_rent", "Аренда парка", fleetCost*rentShare, "₽/год", "стоимость парка × доля аренды", "derived")
		capex = t.add("capex", "CAPEX запуска", sitePrep+integration, "₽", "подготовка объекта + интеграция; станции входят в аренду", "derived")
		opex = t.add("opex", "OPEX", rent+energy+consumables+operators, "₽/год", "аренда + электроэнергия + расходники + операторы", "derived")
	} else {
		chargerPrice := t.add("charger_price", "Цена зарядной станции", chargerPriceRub, "₽", "", "norm")
		chargersCost := t.add("chargers_cost", "Зарядные станции", chargers*chargerPrice, "₽", "станций × цена", "derived")
		service := t.add("service", "Обслуживание", fleetCost*share(t, "service_share", "Обслуживание в год", c.ServiceCostPct, serviceShare), "₽/год",
			"стоимость парка × доля обслуживания", "derived")
		software := t.add("software", "ПО", fleetCost*share(t, "software_share", "ПО в год", c.SoftwareCostPct, softwareShare), "₽/год",
			"стоимость парка × доля ПО", "derived")
		capex = t.add("capex", "CAPEX", fleetCost+chargersCost+sitePrep+integration, "₽", "парк + станции + подготовка объекта + интеграция", "derived")
		opex = t.add("opex", "OPEX", service+software+energy+consumables+operators, "₽/год", "обслуживание + ПО + электроэнергия + расходники + операторы", "derived")
	}

	savings := 0.0
	if d.TargetPayrollRubYear != nil {
		savings = *d.TargetPayrollRubYear
	} else {
		r.Warnings = append(r.Warnings, "Нет окладов исполнителей задачи — экономия ФОТ не посчитана")
	}
	t.add("labor_savings", "Экономия ФОТ", savings, "₽/год", "ФОТ исполнителей × доля автоматизации", "task")
	other := t.input("other_effects", "Иные эффекты", p.OtherEffectsRub, 0, "₽/год", "task")
	net := t.add("net_effect", "Чистый годовой эффект", savings+other-opex, "₽/год", "экономия ФОТ + иные эффекты − OPEX", "derived")
	horizon := float64(req.HorizonYears)
	if req.HorizonYears <= 0 {
		horizon = horizonYears
	}
	t.add("horizon", "Горизонт расчёта", horizon, "лет", "", "task")
	tco := t.add("tco", "TCO", capex+opex*horizon, "₽", "CAPEX + OPEX × горизонт", "derived")

	r.CapexRub, r.OpexYearRub, r.LaborSavingsYearRub = money(capex), money(opex), money(savings)
	r.NetEffectYearRub, r.TcoRub = money(net), money(tco)
	if net > 0 {
		r.PaybackYears = domain.Ptr(round(capex/net, 2))
		t.add("payback", "Окупаемость", *r.PaybackYears, "лет", "CAPEX ÷ чистый годовой эффект", "derived")
	} else {
		r.Warnings = append(r.Warnings, "Чистый годовой эффект не положительный — не окупается")
	}
	if capex > 0 {
		r.Roi = domain.Ptr(round((net*horizon-capex)/capex, 3))
		t.add("roi", "ROI", *r.Roi, "доля", "(эффект × горизонт − CAPEX) ÷ CAPEX", "derived")
	}
	if b := req.Location.CapexBudget.Amount; b != nil && *b > 0 {
		budget := t.add("capex_budget", "Бюджет CAPEX", *b, "₽", "", "location")
		over := math.Max(0, capex-budget)
		r.BudgetOverRub, r.BudgetOverPct = money(over), domain.Ptr(round(over/budget, 3))
		t.add("budget_over", "Превышение бюджета", over, "₽", "max(0, CAPEX − бюджет)", "derived")
	} else {
		r.Warnings = append(r.Warnings, "Бюджет CAPEX локации не задан — соответствие бюджету не оценено")
	}
	return done("")
}

// throughput is the robot output per hour: from the capability row, or from the trip cycle.
func throughput(t *tracer, task calc.Task, c calc.Candidate, unit string, r *calc.Result) (float64, bool) {
	if c.Capability != nil && c.Capability.ThroughputPerHour != nil && *c.Capability.ThroughputPerHour > 0 {
		if !c.Capability.ThroughputExact {
			r.Warnings = append(r.Warnings, "Производительность робота неточная — взята нижняя граница диапазона")
		}
		return t.add("throughput", "Производительность робота", *c.Capability.ThroughputPerHour, unit+"/ч", "", "robot"), true
	}
	speed := specValue(c.Spec, func(s *domain.RobotSpec) *float64 { return s.MaxSpeedMps })
	route := task.Params.RouteLengthM
	if speed == nil || *speed <= 0 || route == nil || *route <= 0 {
		return 0, false
	}
	v := t.add("robot_speed", "Скорость робота", *speed, "м/с", "", "robot")
	if limit := task.Params.SiteSpeedLimitMps; limit != nil && *limit > 0 && *limit < v {
		v = t.add("site_speed_limit", "Ограничение скорости на объекте", *limit, "м/с", "", "task")
	}
	length := t.add("route_length", "Длина маршрута", *route, "м", "", "task")
	load := t.input("load_time", "Погрузка", specValue(c.Spec, func(s *domain.RobotSpec) *float64 { return s.LoadTimeS }), handlingTimeS, "с", "robot")
	unload := t.input("unload_time", "Разгрузка", specValue(c.Spec, func(s *domain.RobotSpec) *float64 { return s.UnloadTimeS }), handlingTimeS, "с", "robot")
	cycle := t.add("cycle_time", "Время цикла", 2*length/v+load+unload, "с", "2 × маршрут ÷ скорость + погрузка + разгрузка", "derived")
	r.Warnings = append(r.Warnings, "Производительность робота оценена по циклу рейса: одна единица груза за рейс")
	return t.add("throughput", "Производительность робота", 3600/cycle, unit+"/ч", "3600 ÷ время цикла", "derived"), true
}

// chargerCount sizes charging stations by the share of time robots spend charging.
func chargerCount(t *tracer, spec *domain.RobotSpec, robots float64) float64 {
	if spec != nil && spec.AutonomyH != nil && spec.ChargeTimeMin != nil && *spec.AutonomyH > 0 {
		autonomy := t.add("autonomy", "Автономность", *spec.AutonomyH, "ч", "", "robot")
		charge := t.add("charge_time", "Время зарядки", *spec.ChargeTimeMin/60, "ч", "", "robot")
		n := math.Max(1, math.Ceil(robots*charge/(autonomy+charge)))
		return t.add("charger_count", "Зарядных станций", n, "шт.", "⌈роботов × зарядка ÷ (автономность + зарядка)⌉", "derived")
	}
	perCharger := t.add("robots_per_charger", "Роботов на станцию", robotsPerCharger, "шт.", "", "norm")
	return t.add("charger_count", "Зарядных станций", math.Max(1, math.Ceil(robots/perCharger)), "шт.", "⌈роботов ÷ роботов на станцию⌉", "derived")
}

// operatorsCost is the yearly payroll of fleet operators across the working shifts.
func operatorsCost(t *tracer, p domain.TaskParams, d domain.TaskDerived, hours float64) float64 {
	if p.FleetOperatorsPerShift == nil || p.FleetOperatorSalaryRub == nil {
		return t.add("operators", "Операторы флота", 0, "₽/год", "не заданы в задаче", "task")
	}
	perShift := t.add("operators_per_shift", "Операторов на смену", *p.FleetOperatorsPerShift, "чел.", "", "task")
	shifts := t.add("shifts", "Смен операторов", math.Ceil(hours/shiftHours), "шт.", "⌈часов работы ÷ 8⌉", "derived")
	salary := t.add("operator_salary", "Оклад оператора", *p.FleetOperatorSalaryRub, "₽/мес.", "", "task")
	coef := d.PayrollTaxCoef
	if coef <= 0 {
		coef = 1
	}
	coef = t.add("payroll_tax_coef", "Коэффициент начислений на ФОТ", coef, "", "", "location")
	return t.add("operators", "Операторы флота", perShift*shifts*salary*12*coef, "₽/год", "операторов × смен × оклад × 12 × начисления", "derived")
}

// share converts a catalog percentage into a fraction, or takes the norm.
func share(t *tracer, code, label string, pct *float64, norm float64) float64 {
	if pct != nil {
		return t.add(code, label, *pct/100, "доля", "% из каталога ÷ 100", "robot")
	}
	return t.add(code, label, norm, "доля", "", "norm")
}

func specValue(spec *domain.RobotSpec, get func(*domain.RobotSpec) *float64) *float64 {
	if spec == nil {
		return nil
	}
	return get(spec)
}

func money(v float64) *float64 { return domain.Ptr(math.Round(v)) }

func round(v float64, digits int) float64 {
	p := math.Pow(10, float64(digits))
	return math.Round(v*p) / p
}
