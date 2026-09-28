package service

import (
	"math"
	"testing"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/store"
	"github.com/google/uuid"
)

func calcParamsRequest() (calc.Request, uuid.UUID, uuid.UUID) {
	robot, other := uuid.New(), uuid.New()
	card := func(id uuid.UUID, price float64) calc.Candidate {
		return calc.Candidate{RobotCard: domain.RobotCard{SolutionID: id, ServiceCostPct: domain.Ptr(10.0),
			Offer:      &domain.Offer{IsDefault: true, Price: domain.Price{AmountRub: domain.Ptr(price), Unit: "item"}},
			Capability: &domain.Capability{ThroughputPerHour: domain.Ptr(8.0)}}}
	}
	req := calc.Request{HorizonYears: 5,
		Task: calc.Task{Params: domain.TaskParams{WorkHoursPerDay: domain.Ptr(16.0), DailyVolume: domain.Ptr(1600.0), AutomationShare: domain.Ptr(0.5)},
			Workers: []domain.TaskWorker{{Headcount: 10, TimeShare: 1, SalaryGrossMonthRub: domain.Ptr(100_000.0)}},
			Derived: domain.TaskDerived{PayrollTaxCoef: 1.3}},
		Candidates: []calc.Candidate{card(robot, 2_000_000), card(other, 3_000_000)},
	}
	return req, robot, other
}

func TestApplyCalcParams(t *testing.T) {
	req, robot, other := calcParamsRequest()
	defaults := baseDefaults(req)
	p := domain.CalcParams{StaffCostRubPerMonth: domain.Ptr(120_000.0), WorkHoursPerDay: domain.Ptr(20.0), RobotPriceRub: domain.Ptr(2_500_000.0),
		ServiceCostRubPerYear: domain.Ptr(1_000_000.0), RobotTripsPerHour: domain.Ptr(9.0), HorizonYears: domain.Ptr(7)}
	applyCalcParams(&req, p, &robot, domain.Ptr(4))

	if req.HorizonYears != 7 || *req.Task.Params.WorkHoursPerDay != 20 || *req.Task.Workers[0].SalaryGrossMonthRub != 120_000 {
		t.Fatalf("task overrides not applied: %+v", req.Task)
	}
	if want := 10 * 120_000.0 * 12 * 1.3; math.Abs(*req.Task.Derived.BasePayrollRubYear-want) > 1e-6 {
		t.Errorf("base payroll = %v, want %v", *req.Task.Derived.BasePayrollRubYear, want)
	}
	c := req.Candidates[0]
	if *c.Offer.Price.AmountRub != 2_500_000 || *c.Capability.ThroughputPerHour != 9 {
		t.Errorf("robot overrides not applied: %+v", c.RobotCard)
	}
	if want := 1_000_000 / (2_500_000.0 * 4) * 100; math.Abs(*c.ServiceCostPct-want) > 1e-9 {
		t.Errorf("service cost pct = %v, want %v", *c.ServiceCostPct, want)
	}
	if *req.Candidates[1].Offer.Price.AmountRub != 3_000_000 || req.Candidates[1].SolutionID != other {
		t.Errorf("another candidate changed: %+v", req.Candidates[1].RobotCard)
	}
	if *defaults.StaffCostRubPerMonth != 100_000 || *defaults.Robots[robot].PriceRub != 2_000_000 {
		t.Errorf("defaults must keep the snapshot values: %+v", defaults)
	}
}

func TestCalcDefaults(t *testing.T) {
	req, robot, _ := calcParamsRequest()
	d := baseDefaults(req)
	req.Defaults = &d
	applyCalcParams(&req, domain.CalcParams{RobotPriceRub: domain.Ptr(9.0)}, &robot, nil)
	results := []store.CalcResult{{Result: calc.Result{SolutionID: robot, AcquisitionModel: calc.Purchase, Calculable: true, Rank: domain.Ptr(1),
		RobotCount: domain.Ptr(4), Details: calc.Details{FleetUtilization: domain.Ptr(0.7)}}}}
	got := calcDefaults(store.CalcRunRecord{Request: req, HorizonYears: 5}, results, nil)

	if got.SolutionID == nil || *got.SolutionID != robot || *got.RobotPriceRub != 2_000_000 || *got.RobotTripsPerHour != 8 {
		t.Fatalf("defaults of the recommended robot = %+v", got)
	}
	if *got.ServiceCostRubPerYear != 2_000_000*4*0.1 || *got.Utilization != 0.7 || *got.HorizonYears != 5 || *got.WorkHoursPerDay != 16 {
		t.Errorf("defaults = %+v", got)
	}
}

func TestReselectKeepsTheCalculatedConfiguration(t *testing.T) {
	req, robot, _ := calcParamsRequest()
	cr := store.CalcRunRecord{ID: uuid.New(), Request: req}
	model := calc.Purchase
	rec := store.ProjectRecord{SelectedSolutionID: &robot, SelectedModel: &model}
	result := store.CalcResult{ID: uuid.New(), Result: calc.Result{SolutionID: robot, AcquisitionModel: calc.Purchase, Calculable: true}}

	reselect(&rec, cr, []store.CalcResult{result})
	if rec.SelectedCalcResultID == nil || *rec.SelectedCalcResultID != result.ID || rec.Snapshot.Robot == nil || rec.Snapshot.Robot.CalcRunID != cr.ID {
		t.Fatalf("selection = %+v", rec)
	}
	result.Calculable = false
	reselect(&rec, cr, []store.CalcResult{result})
	if rec.SelectedSolutionID != nil || rec.Snapshot.Robot != nil {
		t.Errorf("a configuration that is not calculable must drop the selection: %+v", rec)
	}
}
