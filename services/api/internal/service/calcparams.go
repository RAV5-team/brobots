package service

import (
	"slices"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

// «Параметры расчёта» of the matching step (PRD 11.3, ТЗ 3.5.3): the user corrects seven inputs for this project
// only; the snapshot, the location and the catalog stay as they are.

const percent = 100

// validateCalcParams checks the overrides against the bounds of the panel.
func validateCalcParams(v *domain.Validator, p domain.CalcParams) {
	positive := func(field, label string, value *float64, unit string) {
		if value != nil {
			v.Range("calcOverrides."+field, label, value, domain.Ptr(0.0), nil, unit)
		}
	}
	positive("staffCostRubPerMonth", "Оклад исполнителя", p.StaffCostRubPerMonth, "₽")
	positive("robotTripsPerHour", "Рейсов в час", p.RobotTripsPerHour, "")
	positive("robotPriceRub", "Цена единицы", p.RobotPriceRub, "₽")
	positive("serviceCostRubPerYear", "Обслуживание", p.ServiceCostRubPerYear, "₽")
	if p.WorkHoursPerDay != nil {
		v.Range("calcOverrides.workHoursPerDay", "Режим работы", p.WorkHoursPerDay, domain.Ptr(1.0), domain.Ptr(24.0), "ч")
	}
	if p.Utilization != nil {
		v.Range("calcOverrides.utilization", "Загрузка парка", p.Utilization, domain.Ptr(0.0), domain.Ptr(1.0), "")
	}
	if p.HorizonYears != nil {
		v.Range("calcOverrides.horizonYears", "Горизонт расчёта", domain.Ptr(float64(*p.HorizonYears)), domain.Ptr(5.0), domain.Ptr(30.0), "лет")
	}
}

// averageSalary is the monthly gross salary of the task workers weighted by their time on the task; nil — no salary.
func averageSalary(workers []domain.TaskWorker) *float64 {
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
		return nil
	}
	return domain.Ptr(sum / weight)
}

// baseDefaults freezes the values the panel shows when a field is empty.
func baseDefaults(req calc.Request) calc.Defaults {
	d := calc.Defaults{StaffCostRubPerMonth: averageSalary(req.Task.Workers), WorkHoursPerDay: req.Task.Params.WorkHoursPerDay,
		Robots: map[uuid.UUID]calc.RobotDefaults{}}
	for _, c := range req.Candidates {
		rd := calc.RobotDefaults{ServiceCostPct: c.ServiceCostPct}
		if c.Offer != nil {
			rd.PriceRub = c.Offer.Price.AmountRub
		}
		if c.Capability != nil {
			rd.TripsPerHour = c.Capability.ThroughputPerHour
		}
		d.Robots[c.SolutionID] = rd
	}
	return d
}

// applyCalcParams puts the overrides into the calculation input. Robot fields apply to one solution; the service
// cost becomes a share of the price by the fleet of the previous calculation of that solution.
func applyCalcParams(req *calc.Request, p domain.CalcParams, robot *uuid.UUID, previousFleet *int) {
	if p.HorizonYears != nil {
		req.HorizonYears = *p.HorizonYears
	}
	task := domain.Task{Params: req.Task.Params, Workers: slices.Clone(req.Task.Workers)}
	if p.WorkHoursPerDay != nil {
		task.Params.WorkHoursPerDay = p.WorkHoursPerDay
	}
	if p.StaffCostRubPerMonth != nil {
		for i := range task.Workers {
			task.Workers[i].SalaryGrossMonthRub = p.StaffCostRubPerMonth
		}
	}
	if p.WorkHoursPerDay != nil || p.StaffCostRubPerMonth != nil {
		coef := req.Task.Derived.PayrollTaxCoef
		if coef == 0 {
			coef = domain.DefaultPayrollTaxCoef
		}
		task.ComputeDerived(coef)
		req.Task.Params, req.Task.Workers, req.Task.Derived = task.Params, task.Workers, task.Derived
	}
	if robot == nil {
		return
	}
	for i := range req.Candidates {
		c := &req.Candidates[i]
		if c.SolutionID != *robot {
			continue
		}
		if p.RobotPriceRub != nil {
			offer := domain.Offer{Label: "Цена из «Параметров расчёта»", IsDefault: true, Price: domain.Price{Unit: "item", IncludesVat: true}}
			if c.Offer != nil {
				offer = *c.Offer
			}
			offer.Price.AmountRub = p.RobotPriceRub
			c.Offer = &offer
		}
		if p.RobotTripsPerHour != nil && c.Capability != nil {
			capability := *c.Capability
			capability.ThroughputPerHour = p.RobotTripsPerHour
			c.Capability = &capability
		}
		price := p.RobotPriceRub
		if price == nil && c.Offer != nil {
			price = c.Offer.Price.AmountRub
		}
		if p.ServiceCostRubPerYear != nil && price != nil && *price > 0 && previousFleet != nil && *previousFleet > 0 {
			c.ServiceCostPct = domain.Ptr(*p.ServiceCostRubPerYear / (*price * float64(*previousFleet)) * percent)
		}
	}
}

// calcRobot is the solution the robot fields of the panel refer to: named by the user, else the selected one.
func calcRobot(p domain.CalcParams, rec store.ProjectRecord) *uuid.UUID {
	if p.SolutionID != nil {
		return p.SolutionID
	}
	return rec.SelectedSolutionID
}

// fleetOf is the robot count of the purchase result of a solution.
func fleetOf(results []store.CalcResult, solutionID uuid.UUID) *int {
	for _, r := range results {
		if r.SolutionID == solutionID && r.AcquisitionModel == calc.Purchase && r.Calculable {
			return r.RobotCount
		}
	}
	return nil
}

// calcDefaults are the values shown in the empty fields of the panel for the robot of the panel, else the
// recommended one: the snapshot and the catalog as they were in the calculation, before the user's changes.
func calcDefaults(cr store.CalcRunRecord, results []store.CalcResult, robot *uuid.UUID) domain.CalcParams {
	d := baseDefaults(cr.Request)
	if cr.Request.Defaults != nil {
		d = *cr.Request.Defaults
	}
	out := domain.CalcParams{StaffCostRubPerMonth: d.StaffCostRubPerMonth, WorkHoursPerDay: d.WorkHoursPerDay,
		HorizonYears: domain.Ptr(cr.HorizonYears)}
	if robot == nil {
		robot = referenceRobot(results)
	}
	norms := cr.Request.Norms
	if v, ok := norms.Value("productive_time_share"); ok {
		out.Utilization = &v
	}
	if robot == nil {
		return out
	}
	out.SolutionID = robot
	rd := d.Robots[*robot]
	out.RobotPriceRub, out.RobotTripsPerHour = rd.PriceRub, rd.TripsPerHour
	servicePct := rd.ServiceCostPct
	if servicePct == nil {
		if v, ok := norms.Value("annual_service_share"); ok {
			servicePct = domain.Ptr(v * percent)
		}
	}
	for _, r := range results {
		if r.SolutionID != *robot || r.AcquisitionModel != calc.Purchase || !r.Calculable {
			continue
		}
		if r.Details.FleetUtilization != nil {
			out.Utilization = r.Details.FleetUtilization
		}
		if servicePct != nil && rd.PriceRub != nil && r.RobotCount != nil {
			out.ServiceCostRubPerYear = domain.Ptr(*rd.PriceRub * float64(*r.RobotCount) * *servicePct / percent)
		}
	}
	return out
}

// referenceRobot is the recommended robot, or the first calculated one when the calculator does not rank.
func referenceRobot(results []store.CalcResult) *uuid.UUID {
	var first *uuid.UUID
	for _, r := range results {
		if !r.Calculable || r.AcquisitionModel != calc.Purchase {
			continue
		}
		if r.Rank != nil && *r.Rank == 1 {
			return &r.SolutionID
		}
		if first == nil {
			first = &r.SolutionID
		}
	}
	return first
}
