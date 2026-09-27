package mock

import (
	"context"
	"math"
	"testing"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
)

func ptr[T any](v T) *T { return &v }

// request builds a pallet task: 2000/day over 16 h, peak 1.5, 90 % automated → 168.75 per hour.
func request(mutate func(*calc.Request)) calc.Request {
	task := domain.Task{
		Name:     "Перемещение паллет",
		WorkType: domain.WorkTypeRef{Code: "OP-01", UnitLabel: "паллет"},
		Params: domain.TaskParams{DailyVolume: ptr(2000.0), WorkHoursPerDay: ptr(16.0), PeakFactor: ptr(1.5),
			AutomationShare: ptr(0.9), RouteLengthM: ptr(100.0)},
		Workers: []domain.TaskWorker{{RoleName: "Водитель погрузчика", Headcount: 10, SalaryGrossMonthRub: ptr(80_000.0), TimeShare: 1}},
	}
	task.ComputeDerived(1.3)
	req := calc.Request{
		HorizonYears:      5,
		AcquisitionModels: []string{calc.Purchase, calc.RaaS},
		Location:          calc.Location{Name: "Склад", CapexBudget: domain.Budget{Amount: ptr(30_000_000.0), Currency: "RUB"}},
		Task: calc.Task{Name: task.Name, WorkType: task.WorkType, Params: task.Params, Workers: task.Workers,
			Derived: task.Derived},
		Candidates: []calc.Candidate{{MatchState: "passed", RobotCard: domain.RobotCard{
			SolutionID: uuid.New(), Name: "AMR 800",
			Spec:       &domain.RobotSpec{AutonomyH: ptr(8.0), ChargeTimeMin: ptr(60.0), MaxSpeedMps: ptr(1.5)},
			Capability: &domain.Capability{ThroughputPerHour: ptr(20.0), ThroughputExact: true},
			Offer:      &domain.Offer{Price: domain.Price{AmountRub: ptr(2_500_000.0), Unit: "item"}, IsDefault: true},
		}}},
	}
	if mutate != nil {
		mutate(&req)
	}
	return req
}

func results(t *testing.T, req calc.Request) map[string]calc.Result {
	t.Helper()
	resp, err := New().Calculate(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.ModelVersion != Version {
		t.Fatalf("model version = %q", resp.ModelVersion)
	}
	if len(resp.Results) != len(req.Candidates)*len(req.AcquisitionModels) {
		t.Fatalf("results = %d, want one per candidate and model", len(resp.Results))
	}
	out := map[string]calc.Result{}
	for _, r := range resp.Results {
		out[r.AcquisitionModel] = r
	}
	return out
}

func traced(r calc.Result, code string) *float64 {
	for _, it := range r.Trace {
		if it.Code == code {
			return it.Value
		}
	}
	return nil
}

func TestFleetAndPurchaseEconomics(t *testing.T) {
	r := results(t, request(nil))[calc.Purchase]
	if !r.Calculable {
		t.Fatalf("not calculable: %v", *r.Reason)
	}
	// ⌈168.75 ÷ (20 × 0.8 × 0.95) × 1.15⌉ = ⌈12.77⌉; stations ⌈13 × 1 ÷ (8 + 1)⌉ = 2.
	if *r.RobotCount != 13 || *r.ChargerCount != 2 {
		t.Errorf("fleet = %d robots, %d chargers; want 13 and 2", *r.RobotCount, *r.ChargerCount)
	}
	// 13 × 2.5 M + 2 × 350 k + 5 % site preparation.
	if want := 13*2_500_000 + 2*350_000 + 0.05*13*2_500_000; *r.CapexRub != want {
		t.Errorf("capex = %v, want %v", *r.CapexRub, want)
	}
	// Payroll 10 × 80 000 × 12 × 1.3 × 0.9 automated.
	if want := 10 * 80_000 * 12 * 1.3 * 0.9; math.Abs(*r.LaborSavingsYearRub-want) > 1 {
		t.Errorf("labor savings = %v, want %v", *r.LaborSavingsYearRub, want)
	}
	if *r.NetEffectYearRub != *r.LaborSavingsYearRub-*r.OpexYearRub {
		t.Errorf("net effect %v ≠ savings − opex", *r.NetEffectYearRub)
	}
	if r.PaybackYears == nil || math.Abs(*r.PaybackYears - *r.CapexRub / *r.NetEffectYearRub) > 0.01 {
		t.Errorf("payback = %v", r.PaybackYears)
	}
	if *r.BudgetOverRub != *r.CapexRub-30_000_000 || *r.BudgetOverPct <= 0 {
		t.Errorf("budget over = %v (%v)", *r.BudgetOverRub, *r.BudgetOverPct)
	}
	for _, code := range []string{"peak_demand", "throughput", "robot_count", "charger_count", "capex", "opex", "net_effect", "tco", "payback", "roi"} {
		if traced(r, code) == nil {
			t.Errorf("trace has no %s", code)
		}
	}
}

func TestRaasMovesFleetIntoRent(t *testing.T) {
	rs := results(t, request(nil))
	purchase, raas := rs[calc.Purchase], rs[calc.RaaS]
	if *raas.RobotCount != *purchase.RobotCount {
		t.Errorf("fleet differs between models: %d vs %d", *raas.RobotCount, *purchase.RobotCount)
	}
	if *raas.CapexRub >= *purchase.CapexRub || *raas.OpexYearRub <= *purchase.OpexYearRub {
		t.Errorf("raas capex %v / opex %v vs purchase %v / %v", *raas.CapexRub, *raas.OpexYearRub, *purchase.CapexRub, *purchase.OpexYearRub)
	}
	if traced(raas, "raas_rent") == nil {
		t.Error("raas trace has no rent")
	}
}

func TestThroughputFromTripCycle(t *testing.T) {
	r := results(t, request(func(req *calc.Request) {
		req.Candidates[0].Capability.ThroughputPerHour = nil
	}))[calc.Purchase]
	// 2 × 100 m ÷ 1.5 m/s + 30 s + 30 s ≈ 193.3 s → 18.6 per hour.
	if v := traced(r, "throughput"); v == nil || math.Abs(*v-3600/(200/1.5+60)) > 1e-9 {
		t.Errorf("throughput = %v", v)
	}
	if traced(r, "cycle_time") == nil {
		t.Error("trace has no cycle time")
	}
}

func TestNotCalculable(t *testing.T) {
	for name, mutate := range map[string]func(*calc.Request){
		"no throughput and speed": func(req *calc.Request) {
			req.Candidates[0].Capability.ThroughputPerHour = nil
			req.Candidates[0].Spec.MaxSpeedMps = nil
		},
		"no price":       func(req *calc.Request) { req.Candidates[0].Offer = nil },
		"percent price":  func(req *calc.Request) { req.Candidates[0].Offer.Price.Unit = "percent_capex" },
		"no task volume": func(req *calc.Request) { req.Task.Derived.PeakToRobotizePerHour = nil },
	} {
		t.Run(name, func(t *testing.T) {
			r := results(t, request(mutate))[calc.Purchase]
			if r.Calculable || r.Reason == nil || *r.Reason == "" {
				t.Errorf("calculable = %v, reason = %v", r.Calculable, r.Reason)
			}
			if r.CapexRub != nil {
				t.Errorf("capex = %v, want none", *r.CapexRub)
			}
		})
	}
}

func TestNoPaybackWithoutEffect(t *testing.T) {
	r := results(t, request(func(req *calc.Request) {
		req.Task.Derived.TargetPayrollRubYear = nil
	}))[calc.Purchase]
	if !r.Calculable || r.PaybackYears != nil || *r.NetEffectYearRub >= 0 {
		t.Errorf("payback = %v, net = %v", r.PaybackYears, *r.NetEffectYearRub)
	}
	if len(r.Warnings) < 3 {
		t.Errorf("warnings = %v, want mock, payroll and payback notes", r.Warnings)
	}
}

func TestNoBudget(t *testing.T) {
	r := results(t, request(func(req *calc.Request) { req.Location.CapexBudget.Amount = nil }))[calc.Purchase]
	if r.BudgetOverRub != nil || r.BudgetOverPct != nil {
		t.Errorf("budget over = %v, want unknown", r.BudgetOverRub)
	}
}

func TestSameInputSameResult(t *testing.T) {
	a, b := results(t, request(nil))[calc.Purchase], results(t, request(nil))[calc.Purchase]
	if *a.CapexRub != *b.CapexRub || *a.TcoRub != *b.TcoRub || len(a.Trace) != len(b.Trace) {
		t.Error("the mock model is not deterministic")
	}
}
