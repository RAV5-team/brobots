//go:build integration

// Package integration runs the API against a real Postgres.
//
//	TEST_DATABASE_URL=postgres://user:pass@localhost:5432/postgres?sslmode=disable go test -tags=integration ./internal/integration/
//
// Each run creates and drops its own database on that server.
package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/brobots/api/internal/auth"
	"github.com/brobots/api/internal/auth/authtest"
	"github.com/brobots/api/internal/calc/mock"
	"github.com/brobots/api/internal/handlers"
	"github.com/brobots/api/internal/seed"
	"github.com/brobots/api/internal/service"
	"github.com/brobots/api/internal/store"
	"github.com/brobots/api/migrations"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

type env struct {
	pool  *pgxpool.Pool
	srv   *httptest.Server
	st    *store.Store
	iss   *authtest.Issuer
	token string // "" — guest
}

// as returns the environment acting with another token; "" is a guest.
func (e *env) as(token string) *env {
	c := *e
	c.token = token
	return &c
}

func setup(t *testing.T) *env {
	t.Helper()
	admin := os.Getenv("TEST_DATABASE_URL")
	if admin == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, admin)
	if err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("api_test_%d", time.Now().UnixNano())
	if _, err := conn.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(admin)
	if err != nil {
		t.Fatal(err)
	}
	u.Path = "/" + name
	pool, err := pgxpool.New(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = conn.Exec(context.Background(), "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
		conn.Close(context.Background())
	})
	db := stdlib.OpenDBFromPool(pool)
	t.Cleanup(func() { db.Close() })
	goose.SetBaseFS(migrations.FS)
	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatal(err)
	}
	if err := goose.Up(db, "."); err != nil {
		t.Fatalf("migrate up: %v", err)
	}
	if err := goose.DownTo(db, ".", 0); err != nil {
		t.Fatalf("migrate down: %v", err)
	}
	if err := goose.Up(db, "."); err != nil {
		t.Fatalf("migrate up again: %v", err)
	}
	log := slog.New(slog.DiscardHandler)
	st := store.New(pool)
	if err := seed.Load(ctx, st, mock.New(), log); err != nil {
		t.Fatalf("seed: %v", err)
	}
	iss := authtest.New(t)
	srv := httptest.NewServer(handlers.NewRouter(service.New(st, log, mock.New()), log, handlers.Options{Auth: iss.Middleware(t)}))
	t.Cleanup(srv.Close)
	// The flows here are the admin's: catalog changes need the role, the rest a signed-in user.
	token := iss.User(t, "integration-admin", auth.RoleUser, auth.RoleAdmin)
	return &env{pool: pool, srv: srv, st: st, iss: iss, token: token}
}

func (e *env) do(t *testing.T, method, path string, body any, wantStatus int, out any) {
	t.Helper()
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, e.srv.URL+path, r)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if e.token != "" {
		req.Header.Set("Authorization", "Bearer "+e.token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != wantStatus {
		t.Fatalf("%s %s: status %d, want %d: %s", method, path, resp.StatusCode, wantStatus, data)
	}
	if out != nil && len(data) > 0 {
		if err := json.Unmarshal(data, out); err != nil {
			t.Fatalf("%s %s: decode: %v: %s", method, path, err, data)
		}
	}
}

type named struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

type candidate struct {
	State    string `json:"state"`
	IsManual bool   `json:"isManual"`
	Summary  string `json:"summary"`
	Solution named  `json:"solution"`
	Checks   []struct {
		Code   string `json:"code"`
		Status string `json:"status"`
	} `json:"checks"`
}

type run struct {
	ID     *string `json:"id"`
	Counts struct {
		Total, Passed, NeedsVerification, Excluded, Manual int
	} `json:"counts"`
	Candidates []candidate `json:"candidates"`
}

func statesByName(r run) map[string]string {
	out := map[string]string{}
	for _, c := range r.Candidates {
		out[strings.SplitN(c.Solution.Name, " (", 2)[0]] = c.State
	}
	return out
}

func TestSeedIsIdempotent(t *testing.T) {
	e := setup(t)
	count := func() (n int) {
		if err := e.pool.QueryRow(context.Background(), `SELECT (SELECT count(*) FROM solution) + (SELECT count(*) FROM process)
			+ (SELECT count(*) FROM location) + (SELECT count(*) FROM task) + (SELECT count(*) FROM project)`).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	before := count()
	if err := seed.Load(context.Background(), e.st, mock.New(), slog.New(slog.DiscardHandler)); err != nil {
		t.Fatal(err)
	}
	if after := count(); after != before {
		t.Errorf("second seed changed rows: %d → %d", before, after)
	}
	var page struct{ Total int }
	e.do(t, http.MethodGet, "/api/v1/solutions?limit=1", nil, 200, &page)
	if page.Total != 217 {
		t.Errorf("catalog = %d, want 217 (187 organizer products + PuduBot 2 + 29 startup items)", page.Total)
	}
}

// TestGoldenPalletMatching checks the РЦ Химки demo: «Перемещение паллет», OP-01 (PRD 14.2.4–14.2.5).
func TestGoldenPalletMatching(t *testing.T) {
	e := setup(t)
	var locs struct{ Items []named }
	e.do(t, http.MethodGet, "/api/v1/locations?q="+url.QueryEscape("Химки"), nil, 200, &locs)
	if len(locs.Items) != 1 {
		t.Fatalf("locations = %+v", locs.Items)
	}
	var tasks struct{ Items []named }
	e.do(t, http.MethodGet, "/api/v1/locations/"+locs.Items[0].ID+"/tasks", nil, 200, &tasks)
	var taskID string
	for _, tk := range tasks.Items {
		if tk.Name == "Перемещение паллет" {
			taskID = tk.ID
		}
	}
	if taskID == "" {
		t.Fatal("task «Перемещение паллет» not found")
	}
	var preview run
	e.do(t, http.MethodGet, "/api/v1/tasks/"+taskID+"/match-preview", nil, 200, &preview)
	states := statesByName(preview)
	for _, name := range []string{"AMR 800", "Ronavi H1500", "Ronavi M", "DMR Carrier P"} {
		if states[name] != "passed" {
			t.Errorf("%s = %q, want passed", name, states[name])
		}
	}
	for _, name := range []string{"AMR 100", "Ronavi RCM", "Беспилотный тягач", "EVOCARGO N1"} {
		if states[name] != "excluded" {
			t.Errorf("%s = %q, want excluded", name, states[name])
		}
	}
	for _, name := range []string{"MARK 2 SE", "Ronavi SD"} {
		if _, ok := states[name]; ok {
			t.Errorf("%s is a candidate, but has no OP-01 capability", name)
		}
	}
	if states["Ronavi H2000"] != "needs_verification" {
		t.Errorf("Ronavi H2000 = %q, want needs_verification (no dimensions)", states["Ronavi H2000"])
	}
}

func TestLocationTaskProjectFlow(t *testing.T) {
	e := setup(t)
	var loc struct {
		ID        string
		Readiness struct{ RequiredFilled, RequiredTotal int }
		Summary   struct{ ParametersCompletenessPct int }
	}
	e.do(t, http.MethodPost, "/api/v1/locations", map[string]any{
		"name": "Склад Тест", "facilityTypeCode": "warehouse", "city": "Казань", "fillDefaults": true,
		"capexBudget": map[string]any{"amount": 50_000_000, "currency": "RUB"},
		"parameters":  []map[string]any{{"code": "wh_inbound_pallets", "value": 1500}},
	}, 201, &loc)
	if loc.Summary.ParametersCompletenessPct != 100 || loc.Readiness.RequiredFilled != loc.Readiness.RequiredTotal {
		t.Errorf("new location readiness = %+v %+v", loc.Readiness, loc.Summary)
	}

	var problem struct {
		Status int
		Errors []struct{ Field, Code, Hint string }
	}
	e.do(t, http.MethodPut, "/api/v1/locations/"+loc.ID+"/parameters", map[string]any{
		"items": []map[string]any{{"code": "wh_total_area", "value": 5}},
	}, 422, &problem)
	if len(problem.Errors) != 1 || problem.Errors[0].Code != "out_of_range" || problem.Errors[0].Hint == "" {
		t.Errorf("range error = %+v", problem)
	}

	var procs struct{ Items []named }
	e.do(t, http.MethodGet, "/api/v1/processes?facilityType=warehouse", nil, 200, &procs)
	var palletProc string
	for _, p := range procs.Items {
		if p.Code == "PR-0001" {
			palletProc = p.ID
		}
	}
	var task struct {
		ID     string
		Params struct {
			DailyVolume, RouteLengthM, AutomationShare float64
		}
		Provenance map[string]struct{ Source string }
		Readiness  struct{ Ready bool }
		Derived    struct{ BasePayrollRubYear float64 }
	}
	e.do(t, http.MethodPost, "/api/v1/locations/"+loc.ID+"/tasks", map[string]any{"processId": palletProc}, 201, &task)
	if task.Params.DailyVolume != 2500 || task.Params.RouteLengthM != 100 || task.Params.AutomationShare != 0.95 {
		t.Errorf("formula values = %+v", task.Params)
	}
	if task.Provenance["dailyVolume"].Source != "formula" || !task.Readiness.Ready {
		t.Errorf("provenance/readiness = %+v %+v", task.Provenance["dailyVolume"], task.Readiness)
	}
	e.do(t, http.MethodPost, "/api/v1/locations/"+loc.ID+"/tasks", map[string]any{"processId": palletProc}, 409, nil)

	e.do(t, http.MethodPatch, "/api/v1/tasks/"+task.ID, map[string]any{"params": map[string]any{"routeLengthM": 150}}, 200, &task)
	if task.Params.RouteLengthM != 150 || task.Provenance["routeLengthM"].Source != "user" {
		t.Errorf("patched route = %v %+v", task.Params.RouteLengthM, task.Provenance["routeLengthM"])
	}
	e.do(t, http.MethodPatch, "/api/v1/tasks/"+task.ID, map[string]any{"assumeDefaults": []string{"routeLengthM"}}, 200, &task)
	if task.Params.RouteLengthM != 100 || task.Provenance["routeLengthM"].Source != "formula" {
		t.Errorf("«Не знаю» route = %v %+v", task.Params.RouteLengthM, task.Provenance["routeLengthM"])
	}

	var project struct {
		ID, Status  string
		DataChanged bool
		Versions    struct{ Catalog, Dictionaries int }
	}
	e.do(t, http.MethodPost, "/api/v1/projects", map[string]any{"locationId": loc.ID, "taskId": task.ID}, 201, &project)
	if project.Status != "draft" || project.Versions.Catalog == 0 {
		t.Errorf("project = %+v", project)
	}
	var r1 run
	e.do(t, http.MethodPost, "/api/v1/projects/"+project.ID+"/matching-runs", nil, 201, &r1)
	if r1.ID == nil || r1.Counts.Passed == 0 {
		t.Fatalf("run = %+v", r1.Counts)
	}
	e.do(t, http.MethodPut, "/api/v1/projects/"+project.ID+"/conditions", map[string]any{
		"items": []map[string]any{{"code": "payload", "number": 1400}},
	}, 200, nil)
	var r2 run
	e.do(t, http.MethodPost, "/api/v1/projects/"+project.ID+"/matching-runs", nil, 201, &r2)
	if r2.Counts.Passed >= r1.Counts.Passed {
		t.Errorf("payload override did not narrow: %d → %d", r1.Counts.Passed, r2.Counts.Passed)
	}
	var latest run
	e.do(t, http.MethodGet, "/api/v1/projects/"+project.ID+"/matching-runs/latest", nil, 200, &latest)
	if latest.ID == nil || *latest.ID != *r2.ID || len(latest.Candidates) != len(r2.Candidates) {
		t.Errorf("latest run mismatch")
	}

	var cat struct{ Items []named }
	e.do(t, http.MethodGet, "/api/v1/solutions?q="+url.QueryEscape("MARK 2"), nil, 200, &cat)
	e.do(t, http.MethodPost, "/api/v1/projects/"+project.ID+"/manual-candidates", map[string]any{"solutionId": cat.Items[0].ID}, 201, nil)
	var r3 run
	e.do(t, http.MethodPost, "/api/v1/projects/"+project.ID+"/matching-runs", nil, 201, &r3)
	if r3.Counts.Manual != 1 {
		t.Errorf("manual candidates = %d, want 1", r3.Counts.Manual)
	}

	e.do(t, http.MethodPatch, "/api/v1/tasks/"+task.ID, map[string]any{"params": map[string]any{"dailyVolume": 3000}}, 200, nil)
	e.do(t, http.MethodGet, "/api/v1/projects/"+project.ID, nil, 200, &project)
	if !project.DataChanged {
		t.Error("dataChanged = false after task edit")
	}
	e.do(t, http.MethodPost, "/api/v1/projects/"+project.ID+"/refresh-snapshot", nil, 200, &project)
	if project.DataChanged {
		t.Error("dataChanged = true after refresh")
	}

	var copied struct{ ID, Name string }
	e.do(t, http.MethodPost, "/api/v1/projects/"+project.ID+"/copy", nil, 201, &copied)
	var ctxOut struct {
		Candidates []struct{ Match candidate }
	}
	e.do(t, http.MethodGet, "/api/v1/projects/"+project.ID+"/evaluation-context", nil, 200, &ctxOut)
	for _, c := range ctxOut.Candidates {
		if c.Match.State == "excluded" && !c.Match.IsManual {
			t.Errorf("excluded candidate in evaluation context: %s", c.Match.Solution.Name)
		}
	}

	var del struct{ Archived bool }
	e.do(t, http.MethodDelete, "/api/v1/tasks/"+task.ID, nil, 200, &del)
	if !del.Archived {
		t.Error("task used by projects must be archived")
	}
	e.do(t, http.MethodGet, "/api/v1/projects/"+project.ID+"/snapshot", nil, 200, nil)
}

func TestCatalogAdmin(t *testing.T) {
	e := setup(t)
	var wt struct{ ID, Code string }
	e.do(t, http.MethodPost, "/api/v1/work-types", map[string]any{
		"name": "Буксировка прицепов", "description": "Перемещение прицепов тягачом", "unitLabel": "рейсов",
	}, 201, &wt)
	if wt.Code != "OP-11" {
		t.Errorf("code = %s, want OP-11", wt.Code)
	}
	var sol struct {
		ID, Code        string
		CompletenessPct int
		Capabilities    []struct {
			ID       string
			IsActive bool
		}
	}
	e.do(t, http.MethodPost, "/api/v1/solutions", map[string]any{
		"kind": "robot", "name": "Тягач Т-1", "manufacturer": "ООО «Тест»", "status": "piloting", "trl": 7,
		"price": map[string]any{"amountRub": 3_100_000}, "workTypeIds": []string{wt.ID},
		"spec": map[string]any{"payloadKg": 2000, "handlingMethodCode": "tow", "indoorAllowed": false, "outdoorAllowed": true},
	}, 201, &sol)
	if !strings.HasPrefix(sol.Code, "RB-") || len(sol.Capabilities) != 1 {
		t.Errorf("solution = %+v", sol)
	}
	e.do(t, http.MethodPatch, "/api/v1/solutions/"+sol.ID, map[string]any{"spec": map[string]any{"widthMm": 1200}}, 200, &sol)
	e.do(t, http.MethodPatch, "/api/v1/solutions/"+sol.ID+"/capabilities/"+sol.Capabilities[0].ID,
		map[string]any{"throughputPerHour": 12, "environment": "outdoor"}, 200, nil)
	e.do(t, http.MethodPut, "/api/v1/solutions/"+sol.ID+"/capabilities", map[string]any{"workTypeIds": []string{}}, 200, &sol)
	var caps struct {
		Items []struct{ IsActive bool }
	}
	e.do(t, http.MethodGet, "/api/v1/solutions/"+sol.ID+"/capabilities", nil, 200, &caps)
	if len(caps.Items) != 1 || caps.Items[0].IsActive {
		t.Errorf("capability should be hidden, not deleted: %+v", caps.Items)
	}
	e.do(t, http.MethodGet, "/api/v1/solutions/compare?ids="+sol.ID, nil, 422, nil)
	e.do(t, http.MethodPost, "/api/v1/solutions", map[string]any{"kind": "robot", "name": "x", "manufacturer": "y", "code": sol.Code}, 409, nil)
}
