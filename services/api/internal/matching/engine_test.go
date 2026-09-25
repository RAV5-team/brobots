package matching

import (
	"strings"
	"testing"

	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
)

var op01 = domain.WorkTypeRef{ID: uuid.MustParse("00000000-0000-0000-0000-000000000001"), Code: "OP-01", Name: "Перемещение грузов"}

// palletTask is the «Перемещение паллет» task of РЦ Химки.
func palletTask() domain.Task {
	return domain.Task{
		WorkType: op01,
		Params: domain.TaskParams{
			UnitMassKg: domain.Ptr(800.0), CargoDivisible: domain.Ptr(false), Environment: domain.Ptr("indoor"),
			MinAisleWidthM: domain.Ptr(2.8), WidthClearanceM: domain.Ptr(0.6), MinOperatingTempC: domain.Ptr(5.0),
		},
		HandlingMethods: []domain.HandlingShare{{Code: "forks"}, {Code: "platform"}},
	}
}

type robotOpt func(*domain.Solution, *domain.Capability)

func robot(opts ...robotOpt) Robot {
	s := &domain.Solution{ID: uuid.New(), Name: "Робот", Status: domain.Ptr("operation"), Trl: domain.Ptr(9),
		Price: &domain.Price{AmountRub: domain.Ptr(1_800_000.0), Unit: "item"},
		Spec: &domain.RobotSpec{PayloadKg: domain.Ptr(800.0), WidthMm: domain.Ptr(640), MinTempC: domain.Ptr(5.0),
			HandlingMethodCode: domain.Ptr("platform"), IndoorAllowed: domain.Ptr(true), OutdoorAllowed: domain.Ptr(false),
			SpecsConfirmed: "yes"}}
	c := &domain.Capability{ID: uuid.New(), WorkType: op01, IsActive: true, ThroughputPerHour: domain.Ptr(80.0), ThroughputExact: true}
	for _, o := range opts {
		o(s, c)
	}
	if c.WorkType.ID == uuid.Nil {
		c = nil
	}
	return Robot{Solution: s, Capability: c}
}

func checkOf(t *testing.T, res Result, code string) Check {
	t.Helper()
	for _, c := range res.Checks {
		if c.Code == code {
			return c
		}
	}
	t.Fatalf("check %s not found", code)
	return Check{}
}

func TestEvaluateChecks(t *testing.T) {
	tests := []struct {
		name      string
		robot     Robot
		overrides []Override
		code      string
		status    string
		state     string
	}{
		{"all pass", robot(), nil, "payload", Pass, StatePassed},
		{"payload too low", robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.PayloadKg = domain.Ptr(600.0) }), nil, "payload", Fail, StateExcluded},
		{"payload unknown", robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.PayloadKg = nil }), nil, "payload", Unknown, StateNeedsVerification},
		{"handling not allowed", robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.HandlingMethodCode = domain.Ptr("tow") }), nil, "handling", Fail, StateExcluded},
		{"capability handling overrides spec", robot(func(s *domain.Solution, c *domain.Capability) {
			s.Spec.HandlingMethodCode = domain.Ptr("tow")
			c.HandlingMethodCode = domain.Ptr("forks")
		}), nil, "handling", Pass, StatePassed},
		{"handling unknown", robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.HandlingMethodCode = nil }), nil, "handling", Unknown, StateNeedsVerification},
		{"outdoor only robot", robot(func(s *domain.Solution, _ *domain.Capability) {
			s.Spec.IndoorAllowed, s.Spec.OutdoorAllowed = domain.Ptr(false), domain.Ptr(true)
		}), nil, "environment", Fail, StateExcluded},
		{"environment unknown", robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.IndoorAllowed = nil }), nil, "environment", Unknown, StateNeedsVerification},
		{"capability both environments", robot(func(s *domain.Solution, c *domain.Capability) {
			s.Spec.IndoorAllowed = domain.Ptr(false)
			c.Environment = domain.Ptr("both")
		}), nil, "environment", Pass, StatePassed},
		{"too wide", robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.WidthMm = domain.Ptr(2300) }), nil, "aisle_width", Fail, StateExcluded},
		{"width unknown", robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.WidthMm = nil }), nil, "aisle_width", Unknown, StateNeedsVerification},
		{"exact width fits", robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.WidthMm = domain.Ptr(2200) }), nil, "aisle_width", Pass, StatePassed},
		{"cold zone", robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.MinTempC = domain.Ptr(10.0) }), nil, "min_temperature", Fail, StateExcluded},
		{"no price", robot(func(s *domain.Solution, _ *domain.Capability) { s.Price = nil }), nil, "price", Fail, StateExcluded},
		{"percent price is not absolute", robot(func(s *domain.Solution, _ *domain.Capability) {
			s.Price = &domain.Price{Percent: domain.Ptr(10.0), Unit: "percent_capex"}
		}), nil, "price", Fail, StateExcluded},
		{"lift not required", robot(), nil, "lift_height", NotApplicable, StatePassed},
		{"lift required and unknown", robot(), []Override{{Code: "lift_height", Number: domain.Ptr(1600.0)}}, "lift_height", Unknown, StateNeedsVerification},
		{"lift required and enough", robot(func(_ *domain.Solution, c *domain.Capability) { c.LiftHeightMm = domain.Ptr(1600) }),
			[]Override{{Code: "lift_height", Number: domain.Ptr(1500.0)}}, "lift_height", Pass, StatePassed},
		{"project payload override", robot(), []Override{{Code: "payload", Number: domain.Ptr(1000.0)}}, "payload", Fail, StateExcluded},
		{"project handling override", robot(), []Override{{Code: "handling", List: []string{"forks"}}}, "handling", Fail, StateExcluded},
		{"manual without class", robot(func(_ *domain.Solution, c *domain.Capability) { c.WorkType = domain.WorkTypeRef{} }), nil, "work_type", Fail, StateExcluded},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := Evaluate(BuildConditions(palletTask(), tt.overrides), op01, tt.robot)
			if got := checkOf(t, res, tt.code); got.Status != tt.status {
				t.Errorf("check %s = %s, want %s (%s)", tt.code, got.Status, tt.status, got.Message)
			}
			if res.State != tt.state {
				t.Errorf("state = %s, want %s (%s)", res.State, tt.state, res.Summary)
			}
		})
	}
}

func TestExcludedSummaryHasValues(t *testing.T) {
	r := robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.PayloadKg = domain.Ptr(10.0) })
	res := Evaluate(BuildConditions(palletTask(), nil), op01, r)
	want := "Грузоподъёмность: нужно ≥ 800 кг, есть 10 кг"
	if !strings.Contains(res.Summary, want) {
		t.Errorf("summary = %q, want it to contain %q", res.Summary, want)
	}
}

func TestDivisibleCargoSkipsPayloadLimit(t *testing.T) {
	task := palletTask()
	task.Params.CargoDivisible = domain.Ptr(true)
	r := robot(func(s *domain.Solution, _ *domain.Capability) { s.Spec.PayloadKg = domain.Ptr(10.0) })
	res := Evaluate(BuildConditions(task, nil), op01, r)
	if c := checkOf(t, res, "payload"); c.Status != Pass {
		t.Errorf("payload = %s, want pass for divisible cargo", c.Status)
	}
}

func TestTaskWithoutCargo(t *testing.T) {
	task := palletTask()
	task.HandlingMethods = []domain.HandlingShare{{Code: "brushes"}}
	r := robot(func(s *domain.Solution, _ *domain.Capability) {
		s.Spec.PayloadKg = nil
		s.Spec.HandlingMethodCode = domain.Ptr("brushes")
	})
	res := Evaluate(BuildConditions(task, nil), op01, r)
	if c := checkOf(t, res, "payload"); c.Status != NotApplicable {
		t.Errorf("payload = %s, want not_applicable", c.Status)
	}
	if res.State != StatePassed {
		t.Errorf("state = %s: %s", res.State, res.Summary)
	}
}

func TestRisksAndTransferFlag(t *testing.T) {
	r := robot(func(s *domain.Solution, c *domain.Capability) {
		s.Status = domain.Ptr("rnd")
		s.Spec.SpecsConfirmed = "partial"
		c.ThroughputPerHour = nil
	})
	res := Evaluate(BuildConditions(palletTask(), nil), op01, r)
	for _, risk := range []string{RiskSpecsUnconfirmed, RiskThroughputUnknown, RiskHypothesisOnly} {
		found := false
		for _, got := range res.Risks {
			found = found || got == risk
		}
		if !found {
			t.Errorf("risk %s missing in %v", risk, res.Risks)
		}
	}
	if res.TransferFlag == nil || *res.TransferFlag != "P3" {
		t.Errorf("transfer flag = %v, want P3", res.TransferFlag)
	}
}

func TestBuildConditionsAisleFormula(t *testing.T) {
	c := BuildConditions(palletTask(), nil)
	if c.AisleWidth.Number == nil || *c.AisleWidth.Number != 2.2 {
		t.Fatalf("max width = %v, want 2.2", c.AisleWidth.Number)
	}
	if c.AisleWidth.Source != SourceFormula {
		t.Errorf("source = %s, want formula", c.AisleWidth.Source)
	}
	if c.Payload.Number == nil || *c.Payload.Number != 800 {
		t.Errorf("payload = %v, want 800", c.Payload.Number)
	}
}

func TestSortAndCount(t *testing.T) {
	cs := []Candidate{
		{Solution: CandidateSolution{Name: "Б"}, Result: Result{State: StateExcluded}},
		{Solution: CandidateSolution{Name: "В"}, IsManual: true, Result: Result{State: StatePassed}},
		{Solution: CandidateSolution{Name: "Г"}, Result: Result{State: StateNeedsVerification}},
		{Solution: CandidateSolution{Name: "А"}, Result: Result{State: StatePassed}},
	}
	Sort(cs)
	var names []string
	for _, c := range cs {
		names = append(names, c.Solution.Name)
	}
	if got := strings.Join(names, ""); got != "АВГБ" {
		t.Errorf("order = %s, want АВГБ", got)
	}
	m := Count(cs)
	if m.Total != 4 || m.Passed != 2 || m.NeedsVerification != 1 || m.Excluded != 1 || m.Manual != 1 {
		t.Errorf("counts = %+v", m)
	}
}
