package domain

import (
	"math"
	"testing"

	"github.com/google/uuid"
)

func TestFormatNumber(t *testing.T) {
	tests := map[float64]string{2000: "2 000", 1800000: "1 800 000", 0.6: "0,6", 800: "800", -25: "-25", 2.2: "2,2"}
	for in, want := range tests {
		if got := FormatNumber(in); got != want {
			t.Errorf("FormatNumber(%v) = %q, want %q", in, got, want)
		}
	}
}

func TestCoerceParameter(t *testing.T) {
	area := ParameterDefinition{Code: "wh_total_area", Name: "Общая площадь склада", Unit: Ptr("м²"), ValueType: "number",
		MinValue: Ptr(10000.0), MaxValue: Ptr(100000.0), BaseValueNumber: Ptr(20000.0)}
	if pv, fe := CoerceParameter(area, ParameterInput{Code: area.Code, Value: "20 000"}, "f"); fe != nil || *pv.Number != 20000 {
		t.Errorf("string number: %v %v", pv.Number, fe)
	}
	_, fe := CoerceParameter(area, ParameterInput{Code: area.Code, Value: 5.0}, "f")
	if fe == nil || fe.Code != "out_of_range" || fe.Hint != "Допустимо 10 000–100 000 м²" {
		t.Errorf("out of range: %+v", fe)
	}
	if _, fe := CoerceParameter(area, ParameterInput{Code: area.Code, Value: "много"}, "f"); fe == nil || fe.Code != "invalid_type" {
		t.Errorf("not a number: %+v", fe)
	}
	coef := ParameterDefinition{Code: "c", Name: "Коэффициент", ValueType: "number", IsConstant: true, BaseValueNumber: Ptr(1.302)}
	if _, fe := CoerceParameter(coef, ParameterInput{Code: "c", Value: 1.5}, "f"); fe == nil || fe.Code != "constant" {
		t.Errorf("constant: %+v", fe)
	}
	if pv, fe := CoerceParameter(area, ParameterInput{Code: area.Code, Value: nil}, "f"); fe != nil || pv.Number != nil {
		t.Errorf("null clears: %+v %+v", pv, fe)
	}
}

func TestTaskDerived(t *testing.T) {
	task := Task{
		Params: TaskParams{DailyVolume: Ptr(2000.0), WorkHoursPerDay: Ptr(22.0), PeakFactor: Ptr(1.5), AutomationShare: Ptr(0.95),
			MinAisleWidthM: Ptr(2.8), WidthClearanceM: Ptr(0.6)},
		Workers: []TaskWorker{{StaffGroupID: uuid.New(), Headcount: 25, SalaryGrossMonthRub: Ptr(120000.0), TimeShare: 1}},
	}
	task.ComputeDerived(DefaultPayrollTaxCoef)
	d := task.Derived
	approx := func(name string, got *float64, want float64) {
		t.Helper()
		if got == nil || math.Abs(*got-want) > 0.01 {
			t.Errorf("%s = %v, want %v", name, got, want)
		}
	}
	approx("peak", d.PeakIntensityPerHour, 136.36)
	approx("peak to robotize", d.PeakToRobotizePerHour, 129.55)
	approx("avg hourly", d.AvgHourlyToRobotize, 86.36)
	approx("target FTE", d.TargetFte, 23.75)
	approx("base payroll", d.BasePayrollRubYear, 46_872_000)
	approx("target payroll", d.TargetPayrollRubYear, 44_528_400)
	approx("max width", d.MaxRobotWidthM, 2.2)
}

func TestTaskReadiness(t *testing.T) {
	task := Task{HandlingMethods: []HandlingShare{{Code: "none"}},
		Params: TaskParams{DailyVolume: Ptr(20000.0), PeakFactor: Ptr(1.0), RouteLengthM: Ptr(300.0), Environment: Ptr("indoor")}}
	task.ComputeReadiness()
	if task.Readiness.Ready || task.Readiness.Filled != 7 || task.Readiness.Total != 9 {
		t.Fatalf("readiness = %+v", task.Readiness)
	}
	if task.Readiness.Missing[0].Label != "исполнители" || task.Readiness.Missing[1].Label != "оклад" {
		t.Errorf("missing = %+v, want исполнители, оклад", task.Readiness.Missing)
	}
}

func TestPriceBandBoundaries(t *testing.T) {
	for price, want := range map[float64]string{1_000_000: "lte1m", 1_000_001: "1to3m", 3_000_000: "1to3m", 3_000_001: "gt3m"} {
		s := Solution{Price: &Price{AmountRub: Ptr(price), Unit: "item"}}
		if got := s.PriceBand(); got == nil || *got != want {
			t.Errorf("band(%v) = %v, want %s", price, got, want)
		}
	}
}

func TestCompleteness(t *testing.T) {
	s := Solution{Kind: "robot", Price: &Price{AmountRub: Ptr(1.0), Unit: "item"},
		Spec:         &RobotSpec{PayloadKg: Ptr(800.0), WidthMm: Ptr(640)},
		Capabilities: []Capability{{IsActive: true}}}
	s.ComputeCompleteness()
	if s.CompletenessPct != 29 {
		t.Errorf("completeness = %d, want 29 (4 of 14)", s.CompletenessPct)
	}
	if len(s.MissingSpecs) != 10 {
		t.Errorf("missing = %v", s.MissingSpecs)
	}
}

func TestSpecEnvironment(t *testing.T) {
	spec := &RobotSpec{IndoorAllowed: Ptr(true), OutdoorAllowed: Ptr(true)}
	if got := SpecEnvironment(spec); got == nil || *got != "both" {
		t.Errorf("env = %v, want both", got)
	}
	if got := SpecEnvironment(&RobotSpec{IndoorAllowed: Ptr(true)}); got != nil {
		t.Errorf("env with unknown outdoor = %v, want nil", *got)
	}
}
