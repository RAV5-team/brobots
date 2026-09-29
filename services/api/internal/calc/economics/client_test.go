package economics

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/brobots/api/internal/calc"
	"github.com/brobots/api/internal/domain"
	"github.com/google/uuid"
)

// Fixed ids keep testdata/evaluation_response.json aligned with sampleRequest.
var (
	fullRobot    = uuid.MustParse("0190a000-0000-7000-8000-000000000001")
	noSpeedRobot = uuid.MustParse("0190a000-0000-7000-8000-000000000002")
	purchaseOnly = uuid.MustParse("0190a000-0000-7000-8000-000000000003")
)

// sampleRequest is the demo pallet flow of PRD 11: 2 000 pallets a day, 25 forklift operators.
func sampleRequest() calc.Request {
	norms := domain.NormSet{ID: uuid.MustParse("0190a000-0000-7000-8000-0000000000aa"), Version: 1, Label: "test",
		Values: domain.DefaultNormValues()}
	task := calc.Task{ID: uuid.MustParse("0190a000-0000-7000-8000-0000000000bb"), Name: "Перемещение паллет",
		Params: domain.TaskParams{
			DailyVolume: domain.Ptr(2000.0), WorkHoursPerDay: domain.Ptr(22.0), PeakFactor: domain.Ptr(1.5),
			AutomationShare: domain.Ptr(0.95), RouteLengthM: domain.Ptr(100.0), UnitMassKg: domain.Ptr(800.0),
			CargoDivisible: domain.Ptr(false), TurnoverRate: domain.Ptr(0.2), WorkTimeLoss: domain.Ptr(0.25),
			FleetOperatorsPerShift: domain.Ptr(1.0), FleetOperatorSalaryRub: domain.Ptr(90_000.0),
		},
		HandlingMethods: []domain.HandlingShare{{Code: "forks", LaborReplacementRatio: domain.Ptr(0.6)}},
		Workers: []domain.TaskWorker{{RoleName: "Оператор погрузчика", Headcount: 25,
			SalaryGrossMonthRub: domain.Ptr(120_000.0), TimeShare: 1}},
		Derived: domain.TaskDerived{TargetFte: domain.Ptr(23.75), BasePayrollRubYear: domain.Ptr(46_872_000.0),
			TargetPayrollRubYear: domain.Ptr(44_528_400.0), PayrollTaxCoef: 1.302},
	}
	card := func(id uuid.UUID, code string, spec *domain.RobotSpec, models ...string) calc.Candidate {
		completeness := 80
		return calc.Candidate{MatchState: "passed", RobotCard: domain.RobotCard{
			SolutionID: id, Code: code, Name: code, Status: domain.Ptr("operation"), Trl: domain.Ptr(8),
			AcquisitionModels: models, CompletenessPct: &completeness, Spec: spec,
			Capability: &domain.Capability{Effective: domain.Effective{HandlingMethodCode: domain.Ptr("forks")}},
			Offer:      &domain.Offer{Price: domain.Price{AmountRub: domain.Ptr(2_244_000.0), Unit: "item", IncludesVat: true}},
		}}
	}
	full := &domain.RobotSpec{PayloadKg: domain.Ptr(1000.0), MaxSpeedMps: domain.Ptr(1.5), AvgPowerKw: domain.Ptr(0.8),
		LoadTimeS: domain.Ptr(20.0), UnloadTimeS: domain.Ptr(20.0), SpecsConfirmed: "yes"}
	return calc.Request{
		RunID: uuid.MustParse("0190a000-0000-7000-8000-0000000000cc"), ProjectID: uuid.MustParse("0190a000-0000-7000-8000-0000000000dd"),
		HorizonYears: 5, AcquisitionModels: []string{calc.Purchase, calc.RaaS}, Norms: norms,
		Location: calc.Location{CapexBudget: domain.Budget{Amount: domain.Ptr(80_000_000.0), Currency: "RUB"},
			Roles: map[string]float64{"shifts_per_day": 2, "available_power_kw": 500}},
		Task: task,
		Candidates: []calc.Candidate{
			card(fullRobot, "AMR-800", full),
			card(noSpeedRobot, "NO-SPEED", &domain.RobotSpec{PayloadKg: domain.Ptr(1000.0), SpecsConfirmed: "partial"}),
			card(purchaseOnly, "BUY-ONLY", full, calc.Purchase),
		},
	}
}

func fakeService(t *testing.T, onEvaluate func(w http.ResponseWriter, body []byte)) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case PathModelVersion:
			_, _ = w.Write([]byte(`{"model_version":"economic-v1.1","ranking_version":"ranking-v1"}`))
		case PathEvaluations:
			var body json.RawMessage
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Errorf("decode: %v", err)
			}
			onEvaluate(w, body)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return New(srv.URL+"/", time.Second, nil)
}

func recorded(t *testing.T) []byte {
	t.Helper()
	b, err := os.ReadFile("testdata/evaluation_response.json")
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestRequestMatchesTheEconomicsSchema(t *testing.T) {
	var sent map[string]any
	c := fakeService(t, func(w http.ResponseWriter, body []byte) {
		if err := json.Unmarshal(body, &sent); err != nil {
			t.Fatal(err)
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write(recorded(t))
	})
	if _, err := c.Calculate(context.Background(), sampleRequest()); err != nil {
		t.Fatal(err)
	}
	if sent["model_version"] != "economic-v1.1" || sent["evaluation_id"] != "0190a000-0000-7000-8000-0000000000cc" {
		t.Errorf("header fields = %v %v", sent["model_version"], sent["evaluation_id"])
	}
	task := sent["task"].(map[string]any)
	// Decimals travel as strings: pydantic reads them into Decimal without float noise.
	if task["operations_per_day"] != "2000" || task["peak_factor"] != "1.5" {
		t.Errorf("task decimals = %v %v", task["operations_per_day"], task["peak_factor"])
	}
	if b, ok := task["budget"].(map[string]any); !ok || b["amount"] != "80000000" || b["currency"] != "RUB" {
		t.Errorf("budget = %v", task["budget"])
	}
	if pairs := task["replacement_by_handling"].([]any); len(pairs) != 1 || pairs[0].([]any)[0] != "forks" {
		t.Errorf("replacement_by_handling = %v", task["replacement_by_handling"])
	}
	weights := sent["ranking_weights"].([]any)
	if len(weights) != 8 {
		t.Errorf("ranking weights = %v", weights)
	}
	scenarios := sent["scenarios"].([]any)
	if len(scenarios) != 2 {
		t.Errorf("scenarios = %v", scenarios)
	}
	cands := sent["candidates"].([]any)
	noSpeed := cands[1].(map[string]any)
	// Missing times and power come from the norms; a missing speed stays null for the service.
	if noSpeed["max_speed_mps"] != nil || noSpeed["loading_seconds"] != "30" || noSpeed["average_power_kw"] != "0.5" {
		t.Errorf("no-speed candidate = %v", noSpeed)
	}
	for _, key := range []string{"price", "payload_kg", "handling_method", "maturity_trl", "catalog_completeness_percent"} {
		if _, ok := noSpeed[key]; !ok {
			t.Errorf("candidate field %s is omitted: the service requires every field", key)
		}
	}
}

func TestResponseMapping(t *testing.T) {
	c := fakeService(t, func(w http.ResponseWriter, _ []byte) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write(recorded(t))
	})
	resp, err := c.Calculate(context.Background(), sampleRequest())
	if err != nil {
		t.Fatal(err)
	}
	if resp.ModelVersion != "economic-v1.1" || resp.RankingVersion == nil || *resp.RankingVersion != "ranking-v1" {
		t.Errorf("versions = %s %v", resp.ModelVersion, resp.RankingVersion)
	}
	got := map[string]calc.Result{}
	for _, r := range resp.Results {
		got[r.SolutionID.String()+" "+r.AcquisitionModel] = r
	}
	if len(resp.Results) != 5 {
		t.Fatalf("results = %d, want 5: two models of two robots and purchase of the third", len(resp.Results))
	}
	if _, ok := got[purchaseOnly.String()+" raas"]; ok {
		t.Error("a model the robot does not offer must be dropped")
	}
	// Places are renumbered over the kept pairs: raas 1, then both purchases share place 2.
	if r := got[fullRobot.String()+" raas"]; r.Rank == nil || *r.Rank != 1 {
		t.Errorf("full robot raas rank = %v", r.Rank)
	}
	if r := got[purchaseOnly.String()+" purchase"]; r.Rank == nil || *r.Rank != 2 {
		t.Errorf("purchase-only robot rank = %v, want 2", r.Rank)
	}
	full := got[fullRobot.String()+" purchase"]
	if !full.Calculable || full.RobotCount == nil || *full.RobotCount < 1 || full.CapexRub == nil || *full.CapexRub <= 0 {
		t.Fatalf("full robot purchase = %+v", full)
	}
	if full.OpexYearRub == nil || full.TcoRub == nil || full.NetEffectYearRub == nil || full.Roi == nil {
		t.Errorf("headline figures = %+v", full)
	}
	if full.Feasibility == nil || full.Rank == nil || full.Score == nil || *full.Score <= 0 || *full.Score > 1 {
		t.Errorf("feasibility %v rank %v score %v", full.Feasibility, full.Rank, full.Score)
	}
	if len(full.Details.CapexItems) == 0 || len(full.Details.OpexItems) == 0 || full.Details.BaselineOpexYearRub == nil ||
		len(full.Details.ScoreCriteria) != 8 {
		t.Errorf("details = %+v", full.Details)
	}
	if full.BudgetOverRub == nil || *full.BudgetOverRub != 0 {
		t.Errorf("budget over = %v, want 0 within an 80 mln budget", full.BudgetOverRub)
	}
	for _, tr := range full.Trace {
		if tr.Label == tr.Code {
			t.Errorf("trace %s has no Russian label", tr.Code)
		}
	}
	noSpeed := got[noSpeedRobot.String()+" purchase"]
	if noSpeed.Calculable || noSpeed.Reason == nil || !strings.Contains(*noSpeed.Reason, "скорости") {
		t.Errorf("no-speed robot = %+v", noSpeed)
	}
	if len(noSpeed.Details.Assumptions) == 0 {
		t.Error("norm defaults used for the robot must be reported")
	}
	for _, r := range resp.Results {
		for _, w := range r.Warnings {
			if strings.ContainsAny(w, "abcdefghijklmnopqrstuvwxyz") && !strings.ContainsAny(w, "абвгдеёжзийклмнопрстуфхцчшщъыьэюя") {
				t.Errorf("untranslated warning: %q", w)
			}
		}
	}
}

func TestMissingTaskValuesSkipTheService(t *testing.T) {
	c := fakeService(t, func(http.ResponseWriter, []byte) { t.Error("the service must not be called") })
	req := sampleRequest()
	req.Task.Params.DailyVolume = nil
	resp, err := c.Calculate(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Results) != 5 || resp.Results[0].Calculable || !strings.Contains(*resp.Results[0].Reason, "объём операций") {
		t.Errorf("results = %+v", resp.Results)
	}
	req = sampleRequest()
	req.HorizonYears = 3
	resp, _ = c.Calculate(context.Background(), req)
	if resp.Results[0].Calculable || !strings.Contains(*resp.Results[0].Reason, "Горизонт") {
		t.Errorf("short horizon = %+v", resp.Results[0])
	}
	req.Candidates = nil
	if resp, err = c.Calculate(context.Background(), req); err != nil || len(resp.Results) != 0 || resp.ModelVersion == "" {
		t.Errorf("no candidates = %+v, %v", resp, err)
	}
}

func TestFailures(t *testing.T) {
	for name, tc := range map[string]struct {
		status int
		body   string
		want   error
	}{
		"server error":     {http.StatusInternalServerError, "boom", calc.ErrUnavailable},
		"invalid json":     {http.StatusCreated, "not json", calc.ErrUnavailable},
		"validation":       {http.StatusUnprocessableEntity, `{"detail":"bad"}`, calc.ErrRejected},
		"model version":    {http.StatusConflict, `{"detail":"version"}`, calc.ErrRejected},
		"empty version in": {http.StatusCreated, `{"result":{"model_version":""}}`, calc.ErrUnavailable},
	} {
		t.Run(name, func(t *testing.T) {
			c := fakeService(t, func(w http.ResponseWriter, _ []byte) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			})
			if _, err := c.Calculate(context.Background(), sampleRequest()); !errors.Is(err, tc.want) {
				t.Errorf("err = %v, want %v", err, tc.want)
			}
		})
	}
	if _, err := New("http://127.0.0.1:1", time.Second, nil).ModelVersion(context.Background()); !errors.Is(err, calc.ErrUnavailable) {
		t.Errorf("no server: %v", err)
	}
}

func TestRiskTranslations(t *testing.T) {
	for in, want := range map[string]string{
		"Catalog maturity status is piloting.":    "Статус решения в каталоге: пилотирование",
		"Average fleet utilization is below 30%.": "Средняя загрузка парка ниже 30%",
		"CAPEX exceeds the planning budget.":      "CAPEX превышает бюджет локации",
		"Something new.":                          "Something new.",
	} {
		if got := riskRu(in); got != want {
			t.Errorf("riskRu(%q) = %q, want %q", in, got, want)
		}
	}
}

// TestLiveService runs the sample against a running economics service:
//
//	ECONOMICS_TEST_URL=http://localhost:18002 go test ./internal/calc/economics/ -run Live
//
// ECONOMICS_RECORD=1 rewrites testdata/evaluation_response.json with the live answer.
func TestLiveService(t *testing.T) {
	url := os.Getenv("ECONOMICS_TEST_URL")
	if url == "" {
		t.Skip("ECONOMICS_TEST_URL is not set")
	}
	c := New(url, 10*time.Second, nil)
	ctx := context.Background()
	if os.Getenv("ECONOMICS_RECORD") != "" {
		v, err := c.versions(ctx)
		if err != nil {
			t.Fatal(err)
		}
		p, err := buildPlan(sampleRequest(), v.ModelVersion)
		if err != nil {
			t.Fatal(err)
		}
		var raw json.RawMessage
		if err := c.do(ctx, http.MethodPost, PathEvaluations, p.payload, &raw); err != nil {
			t.Fatal(err)
		}
		var pretty any
		if err := json.Unmarshal(raw, &pretty); err != nil {
			t.Fatal(err)
		}
		b, _ := json.MarshalIndent(pretty, "", "  ")
		if err := os.WriteFile("testdata/evaluation_response.json", append(b, '\n'), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	resp, err := c.Calculate(ctx, sampleRequest())
	if err != nil {
		t.Fatal(err)
	}
	calculated := 0
	for _, r := range resp.Results {
		if r.Calculable {
			calculated++
		}
	}
	if calculated == 0 {
		t.Fatalf("nothing calculated: %+v", resp.Results)
	}
}

// TestDryRunAndServiceToken: a preview asks the service not to keep a snapshot; the service token rides on every call.
func TestDryRunAndServiceToken(t *testing.T) {
	var query, authorization []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization = append(authorization, r.Header.Get("Authorization"))
		switch r.URL.Path {
		case PathModelVersion:
			_, _ = w.Write([]byte(`{"model_version":"economic-v1.1","ranking_version":"ranking-v1"}`))
		case PathEvaluations:
			query = append(query, r.URL.RawQuery)
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write(recorded(t))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	withToken := func(base http.RoundTripper) http.RoundTripper {
		return roundTrip(func(r *http.Request) (*http.Response, error) {
			r = r.Clone(r.Context())
			r.Header.Set("Authorization", "Bearer service")
			return base.RoundTrip(r)
		})
	}
	c := New(srv.URL, time.Second, withToken)
	req := sampleRequest()
	if _, err := c.Calculate(context.Background(), req); err != nil {
		t.Fatal(err)
	}
	req.DryRun = true
	if _, err := c.Calculate(context.Background(), req); err != nil {
		t.Fatal(err)
	}
	if len(query) != 2 || query[0] != "" || query[1] != "dry_run=true" {
		t.Errorf("evaluation queries = %q, want the second one dry", query)
	}
	for _, a := range authorization {
		if a != "Bearer service" {
			t.Errorf("call without the service token: %q", a)
		}
	}
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
