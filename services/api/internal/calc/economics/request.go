package economics

import (
	"fmt"
	"math"
	"strings"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
)

// plan is a calc.Request prepared for the economics service: the payload, the results known
// without the service and what the client added to the input, to report it in the results.
type plan struct {
	payload *evaluationRequestDTO
	// preset are the results decided before the call: nothing to calculate or a missing task value.
	preset []calc.Result
	cands  map[string]*candidatePlan
	// powerUnknown: the location has no available power, the charging power risk is not meaningful.
	powerUnknown bool
	warnings     []string
	assumptions  []calc.AssumptionValue
}

type candidatePlan struct {
	cand        calc.Candidate
	models      []string
	warnings    []string
	assumptions []calc.AssumptionValue
}

// minHorizonYears is the shortest horizon of the economics model (ТЗ 3.5.2: TCO не менее 5 лет).
const minHorizonYears = 5

func buildPlan(req calc.Request, modelVersion string) (plan, error) {
	p := plan{cands: map[string]*candidatePlan{}}
	norms, err := newNormReader(req.Norms)
	if err != nil {
		return p, err
	}
	var cands []*candidatePlan
	for _, c := range req.Candidates {
		models := c.Models(req.AcquisitionModels)
		if len(models) == 0 {
			continue
		}
		cp := &candidatePlan{cand: c, models: models}
		cands = append(cands, cp)
		p.cands[c.SolutionID.String()] = cp
	}
	if len(cands) == 0 {
		return p, nil
	}
	if missing := missingTaskValues(req); len(missing) > 0 {
		reason := "Не хватает данных задачи: " + strings.Join(missing, ", ")
		p.preset = notCalculable(cands, reason)
		return p, nil
	}
	if req.HorizonYears < minHorizonYears {
		p.preset = notCalculable(cands, fmt.Sprintf(
			"Горизонт расчёта %d лет меньше 5: модель экономики считает TCO на горизонте не меньше 5 лет (ТЗ 3.5.2)", req.HorizonYears))
		return p, nil
	}

	dtos := make([]candidateDTO, 0, len(cands))
	for _, cp := range cands {
		dtos = append(dtos, candidateInput(cp, norms))
	}
	task := p.taskInput(req, norms, dtos)
	used := map[string]bool{}
	for _, cp := range cands {
		for _, m := range cp.models {
			used[m] = true
		}
	}
	var scenarios []scenarioDTO
	for _, m := range req.AcquisitionModels {
		if used[m] {
			scenarios = append(scenarios, scenarioDTO{AcquisitionModel: m, PriceFactor: 1, VolumeFactor: 1, LaborFactor: 1,
				ModelVersion: modelVersion})
		}
	}
	p.payload = &evaluationRequestDTO{
		EvaluationID: req.RunID.String(), ProjectID: req.ProjectID.String(), ModelVersion: modelVersion,
		Task: task, Candidates: dtos, Norms: norms.dto(), Scenarios: scenarios, CalculationCurrency: "RUB",
		RankingWeights: norms.rankingWeights(),
	}
	return p, nil
}

func notCalculable(cands []*candidatePlan, reason string) []calc.Result {
	var out []calc.Result
	for _, cp := range cands {
		for _, m := range cp.models {
			out = append(out, calc.Result{SolutionID: cp.cand.SolutionID, AcquisitionModel: m, Reason: domain.Ptr(reason),
				Trace: []calc.TraceItem{}, Warnings: []string{}})
		}
	}
	return out
}

// missingTaskValues lists the task values without which the economics model cannot run.
func missingTaskValues(req calc.Request) []string {
	p := req.Task.Params
	var missing []string
	for _, f := range []struct {
		v     *float64
		label string
	}{
		{p.DailyVolume, "объём операций в сутки"}, {p.WorkHoursPerDay, "часы работы процесса"},
		{p.PeakFactor, "пиковый коэффициент"}, {p.AutomationShare, "доля автоматизации"},
		{p.RouteLengthM, "длина маршрута"}, {p.UnitMassKg, "масса единицы груза"},
	} {
		if f.v == nil {
			missing = append(missing, f.label)
		}
	}
	if p.WorkHoursPerDay != nil && *p.WorkHoursPerDay <= 0 {
		missing = append(missing, "часы работы процесса больше нуля")
	}
	return missing
}

func (p *plan) assume(code string, value float64, unit string) {
	label := code
	if d, ok := domain.NormDefinitionOf(code); ok {
		label = d.Label
	}
	p.assumptions = append(p.assumptions, calc.AssumptionValue{Code: code, Label: label, Value: value, Unit: unit})
}

func (p *plan) taskInput(req calc.Request, norms normReader, cands []candidateDTO) taskDTO {
	params, derived := req.Task.Params, req.Task.Derived
	hours := *params.WorkHoursPerDay

	shifts, ok := req.Location.Roles["shifts_per_day"]
	if !ok || shifts <= 0 {
		shiftHours := req.Location.Roles["shift_hours"]
		if shiftHours <= 0 {
			shiftHours = 8
		}
		shifts = math.Max(1, math.Ceil(hours/shiftHours))
		p.warnings = append(p.warnings, fmt.Sprintf("Число смен в профиле локации не указано — принято %s по часам работы процесса",
			domain.FormatNumber(shifts)))
		p.assumptions = append(p.assumptions, calc.AssumptionValue{Code: "shifts_per_day", Label: "Смен в сутки", Value: shifts, Unit: "смен"})
	}
	power, ok := req.Location.Roles["available_power_kw"]
	if !ok {
		p.powerUnknown = true
		p.warnings = append(p.warnings, "Доступная мощность локации не указана — достаточность мощности для зарядки не проверялась")
	}
	speedLimit := 0.0
	if params.SiteSpeedLimitMps != nil && *params.SiteSpeedLimitMps > 0 {
		speedLimit = *params.SiteSpeedLimitMps
	} else {
		// The model takes min(robot speed, site limit): the fastest candidate means «no limit».
		for _, c := range cands {
			if c.MaxSpeedMps != nil {
				speedLimit = math.Max(speedLimit, float64(*c.MaxSpeedMps))
			}
		}
		if speedLimit <= 0 {
			speedLimit = 1
		}
	}
	timeLoss := norms.get("staff_time_loss_share")
	if params.WorkTimeLoss != nil {
		timeLoss = *params.WorkTimeLoss
	} else {
		p.assume("staff_time_loss_share", timeLoss, "доля")
	}
	if derived.TargetPayrollRubYear == nil {
		p.warnings = append(p.warnings, "Нет окладов исполнителей задачи — экономия ФОТ не посчитана")
	}
	divisible := false
	if params.CargoDivisible != nil {
		divisible = *params.CargoDivisible
	} else {
		p.warnings = append(p.warnings, "Делимость груза не указана — груз считается неделимым: одна единица за рейс")
	}
	var budget *moneyDTO
	if b := req.Location.CapexBudget.Amount; b != nil && *b > 0 {
		budget = rubPtr(b)
	}
	replacement := []pair{}
	for _, h := range req.Task.HandlingMethods {
		if h.Code != "" && h.LaborReplacementRatio != nil {
			replacement = append(replacement, pair{Code: h.Code, Value: Dec(*h.LaborReplacementRatio)})
		}
	}
	return taskDTO{
		ProjectID: req.ProjectID.String(), TaskID: req.Task.ID.String(),
		OperationsPerDay: Dec(*params.DailyVolume), PeakFactor: Dec(*params.PeakFactor),
		AutomatableShare: Dec(*params.AutomationShare), OperatingHoursPerDay: Dec(hours),
		OneWayRouteM: Dec(*params.RouteLengthM), SiteSpeedLimitMps: Dec(speedLimit),
		LoadUnitMassKg: Dec(*params.UnitMassKg), LoadIsDivisible: divisible, AvailableChargingPowerKw: Dec(power),
		TargetFte: Dec(deref(derived.TargetFte)), TargetAnnualPayroll: rub(deref(derived.TargetPayrollRubYear)),
		BaselineAnnualOpex:     rub(deref(derived.BasePayrollRubYear)),
		FleetOperatorsPerShift: Dec(deref(params.FleetOperatorsPerShift)), ShiftsPerDay: Dec(shifts),
		StaffTimeLossShare: Dec(timeLoss), FleetOperatorMonthlySalary: rub(deref(params.FleetOperatorSalaryRub)),
		TargetMonthlySalary: rub(averageSalary(req.Task.Workers)), AnnualStaffTurnover: Dec(deref(params.TurnoverRate)),
		AnnualOtherBenefits: rub(deref(params.OtherEffectsRub)), ReplacementByHandling: replacement,
		HorizonYears: req.HorizonYears, Budget: budget,
		Source: sourceDTO{Source: fmt.Sprintf("project:%s task:%s", req.ProjectID, req.Task.ID), Origin: "user",
			Confirmation: "partial", Note: domain.Ptr("Снимок задачи и локации проекта RAV5")},
		LiftTripShare: Dec(deref(params.LiftTripShare)), OneWayLiftSeconds: Dec(deref(params.LiftTimeS)),
		IntegrationCost: rubPtr(params.ItIntegrationRub), AnnualConsumablesPerRobot: rubPtr(params.ConsumablesPerRobotRub),
	}
}

// averageSalary is the monthly gross salary of the task workers weighted by their time on the task.
func averageSalary(workers []domain.TaskWorker) float64 {
	var sum, weight float64
	for _, w := range workers {
		if w.SalaryGrossMonthRub == nil {
			continue
		}
		k := float64(w.Headcount) * w.TimeShare
		sum += *w.SalaryGrossMonthRub * k
		weight += k
	}
	if weight == 0 {
		return 0
	}
	return sum / weight
}

func candidateInput(cp *candidatePlan, norms normReader) candidateDTO {
	c := cp.cand
	spec := c.Spec
	if spec == nil {
		spec = &domain.RobotSpec{}
	}
	confirmation := map[string]string{"yes": "confirmed", "partial": "partial", "no": "unconfirmed"}[spec.SpecsConfirmed]
	if confirmation == "" {
		confirmation = "unknown"
	}
	source := sourceDTO{Source: "Каталог RAV5 · " + c.Code, Origin: "recorded", Confirmation: confirmation, Note: spec.SpecsSourceText}
	in := candidateDTO{CandidateID: c.SolutionID.String(), RobotCode: c.Code, CatalogStatus: "unknown",
		Confirmation: confirmation, Source: source}
	if c.Status != nil {
		in.CatalogStatus = *c.Status
	}
	if c.Offer != nil && c.Offer.Price.Unit == "item" && c.Offer.Price.AmountRub != nil && *c.Offer.Price.AmountRub > 0 {
		in.Price = rubPtr(c.Offer.Price.AmountRub)
	}
	in.PayloadKg = nonNegative(spec.PayloadKg)
	if spec.MaxSpeedMps != nil && *spec.MaxSpeedMps > 0 {
		in.MaxSpeedMps = decPtr(*spec.MaxSpeedMps)
	}
	in.LoadingSeconds = cp.orNorm(spec.LoadTimeS, norms, "default_handling_seconds", "Погрузка", "с")
	in.UnloadingSeconds = cp.orNorm(spec.UnloadTimeS, norms, "default_handling_seconds", "Разгрузка", "с")
	in.AveragePowerKw = cp.orNorm(spec.AvgPowerKw, norms, "default_avg_power_kw", "Средняя мощность", "кВт")
	switch {
	case c.Capability != nil && c.Capability.Effective.HandlingMethodCode != nil:
		in.HandlingMethod = c.Capability.Effective.HandlingMethodCode
	case c.Capability != nil && c.Capability.HandlingMethodCode != nil:
		in.HandlingMethod = c.Capability.HandlingMethodCode
	default:
		in.HandlingMethod = spec.HandlingMethodCode
	}
	if c.Trl != nil && *c.Trl >= 1 && *c.Trl <= 9 {
		in.MaturityTrl = &sourcedValueDTO{Value: Dec(*c.Trl), Unit: "TRL", Source: source}
	}
	if c.CompletenessPct != nil && *c.CompletenessPct >= 0 && *c.CompletenessPct <= 100 {
		in.CatalogCompletenessPercent = &sourcedValueDTO{Value: Dec(*c.CompletenessPct), Unit: "%", Source: source}
	}
	return in
}

// orNorm takes a robot characteristic, or the norm with a warning when the catalog has none.
func (cp *candidatePlan) orNorm(v *float64, norms normReader, code, label, unit string) *Dec {
	if v != nil && *v >= 0 {
		return decPtr(*v)
	}
	value := norms.get(code)
	cp.warnings = append(cp.warnings, fmt.Sprintf("%s робота не указана в каталоге — принято по нормативу: %s %s",
		label, domain.FormatNumber(value), unit))
	cp.assumptions = append(cp.assumptions, calc.AssumptionValue{Code: code, Label: label + " робота", Value: value, Unit: unit})
	return decPtr(value)
}

func nonNegative(v *float64) *Dec {
	if v == nil || *v < 0 {
		return nil
	}
	return decPtr(*v)
}

func decPtr(v float64) *Dec {
	d := Dec(v)
	return &d
}

func deref(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}

// normReader reads a norm set that has every economic norm.
type normReader struct {
	set    domain.NormSet
	values map[string]float64
}

// newNormReader reads a norm set; a norm defined after the set was saved takes its default value.
func newNormReader(set domain.NormSet) (normReader, error) {
	if len(set.Values) == 0 {
		return normReader{}, fmt.Errorf("%w: the project has no norm set", calc.ErrRejected)
	}
	r := normReader{set: set, values: make(map[string]float64, len(domain.NormDefinitions))}
	for _, d := range domain.NormDefinitions {
		r.values[d.Code] = d.Value
	}
	for _, v := range set.Values {
		r.values[v.Code] = v.Value
	}
	return r, nil
}

func (r normReader) get(code string) float64 { return r.values[code] }

func (r normReader) rankingWeights() []pair {
	out := make([]pair, 0, len(domain.RankingWeightCodes))
	for _, code := range domain.RankingWeightCodes {
		out = append(out, pair{Code: strings.TrimPrefix(code, "ranking_weight_"), Value: Dec(r.get(code))})
	}
	return out
}

func (r normReader) dto() normsDTO {
	d := func(code string) Dec { return Dec(r.get(code)) }
	m := func(code string) moneyDTO { return rub(r.get(code)) }
	version := fmt.Sprintf("norms-v%d", r.set.Version)
	return normsDTO{
		PayrollMultiplier: d("payroll_multiplier"), ProductiveTimeShare: d("productive_time_share"),
		TechnicalAvailability: d("technical_availability"), FleetReserveShare: d("fleet_reserve_share"),
		OperatingSpeedFactor: d("operating_speed_factor"), RobotsPerCharger: d("robots_per_charger"),
		ChargerInstalledPrice: m("charger_installed_price"), ChargerPowerKw: d("charger_power_kw"),
		FmsUpfrontShare: d("fms_upfront_share"), DeliveryShare: d("delivery_share"),
		CommissioningShare: d("commissioning_share"), TrainingCost: m("training_cost"),
		CapexContingencyShare: d("capex_contingency_share"), AnnualServiceShare: d("annual_service_share"),
		AnnualLicenseShare: d("annual_license_share"), AnnualRepairShare: d("annual_repair_share"),
		ElectricityPrice: m("electricity_price"), BatteryLifeYears: d("battery_life_years"),
		BatteryReplacementShare: d("battery_replacement_share"), AnnualConnectivityCost: m("annual_connectivity_cost"),
		EquipmentLifeYears: d("equipment_life_years"), DiscountRate: d("discount_rate"), LoanShare: d("loan_share"),
		LoanInterestRate: d("loan_interest_rate"), LoanTermYears: d("loan_term_years"),
		MonthlyRaasShare: d("monthly_raas_share"), RaasSetupShare: d("raas_setup_share"),
		RecruitmentMonthsSalary: d("recruitment_months_salary"), GoodPaybackYears: d("good_payback_years"),
		MediumPaybackYears: d("medium_payback_years"), SitePreparationShare: d("site_preparation_share"),
		Source: sourceDTO{Source: "Нормативы А5 · " + r.set.Label, Origin: "admin_norm", Confirmation: "partial",
			Version: &version},
	}
}
