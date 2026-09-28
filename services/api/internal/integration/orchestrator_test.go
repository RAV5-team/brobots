//go:build integration

package integration

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

type calcResult struct {
	ID               string   `json:"id"`
	SolutionID       string   `json:"solutionId"`
	AcquisitionModel string   `json:"acquisitionModel"`
	Calculable       bool     `json:"calculable"`
	RobotCount       *int     `json:"robotCount"`
	CapexRub         *float64 `json:"capexRub"`
	Trace            []struct{ Code string }
}

type evaluation struct {
	ID            string `json:"id"`
	ModelVersion  string `json:"modelVersion"`
	ModelOutdated bool   `json:"modelOutdated"`
	Stale         bool   `json:"stale"`
	Candidates    []struct {
		Match   candidate    `json:"match"`
		Robot   *named       `json:"robot"`
		Results []calcResult `json:"results"`
	} `json:"candidates"`
}

type projectOut struct {
	ID, Name, Status string
	SavedAt          *string
	DataChanged      bool
	Versions         struct{ Model *string }
	Selection        *struct {
		SolutionID, AcquisitionModel string
		CalcResultID                 *string
	}
	LatestEvaluation *struct {
		ID    string
		Stale bool
	}
}

type snapshotOut struct {
	Robot *struct {
		SolutionID, AcquisitionModel, CalcRunID, CalcResultID string
		Offer                                                 *struct {
			Price struct{ AmountRub float64 }
		}
	}
}

// firstCalculated returns the first calculated purchase result of an evaluation.
func firstCalculated(t *testing.T, ev evaluation) calcResult {
	t.Helper()
	for _, c := range ev.Candidates {
		for _, r := range c.Results {
			if r.Calculable && r.AcquisitionModel == "purchase" {
				return r
			}
		}
	}
	t.Fatalf("no calculated candidate in %+v", ev)
	return calcResult{}
}

func resultOf(ev evaluation, solutionID, model string) *calcResult {
	for _, c := range ev.Candidates {
		for _, r := range c.Results {
			if r.SolutionID == solutionID && r.AcquisitionModel == model {
				return &r
			}
		}
	}
	return nil
}

// TestOrchestratorFlow: draft → evaluate → select (robot copied) → save → frozen and reproducible → reopen.
func TestOrchestratorFlow(t *testing.T) {
	e := setup(t)
	var loc named
	e.do(t, http.MethodPost, "/api/v1/locations", map[string]any{
		"name": "Склад Оркестратор", "facilityTypeCode": "warehouse", "city": "Казань", "fillDefaults": true,
		"capexBudget": map[string]any{"amount": 40_000_000, "currency": "RUB"},
	}, 201, &loc)
	var procs struct{ Items []named }
	e.do(t, http.MethodGet, "/api/v1/processes?facilityType=warehouse", nil, 200, &procs)
	var palletProc string
	for _, p := range procs.Items {
		if p.Code == "PR-0001" {
			palletProc = p.ID
		}
	}
	var task named
	e.do(t, http.MethodPost, "/api/v1/locations/"+loc.ID+"/tasks", map[string]any{"processId": palletProc}, 201, &task)

	var project projectOut
	e.do(t, http.MethodPost, "/api/v1/projects", map[string]any{"locationId": loc.ID, "taskId": task.ID}, 201, &project)
	if project.Status != "draft" || project.LatestEvaluation != nil {
		t.Fatalf("new project = %+v", project)
	}
	base := "/api/v1/projects/" + project.ID
	e.do(t, http.MethodGet, base+"/evaluation", nil, 404, nil)
	var problem struct{ Code string }
	e.do(t, http.MethodPut, base+"/selection", map[string]any{"solutionId": loc.ID, "acquisitionModel": "purchase"}, 409, &problem)
	if problem.Code != "evaluation_required" {
		t.Errorf("selection before evaluation: %s", problem.Code)
	}

	var ev evaluation
	e.do(t, http.MethodPost, base+"/evaluate", nil, 201, &ev)
	if ev.ModelVersion != "mock-calc/v1" || ev.Stale || len(ev.Candidates) == 0 {
		t.Fatalf("evaluation = %s stale=%v candidates=%d", ev.ModelVersion, ev.Stale, len(ev.Candidates))
	}
	for _, c := range ev.Candidates {
		excluded := c.Match.State == "excluded" && !c.Match.IsManual
		if excluded != (len(c.Results) == 0) || excluded != (c.Robot == nil) {
			t.Errorf("%s (%s): %d results, robot %v", c.Match.Solution.Name, c.Match.State, len(c.Results), c.Robot != nil)
		}
	}
	chosen := firstCalculated(t, ev)
	if chosen.RobotCount == nil || *chosen.RobotCount < 1 || len(chosen.Trace) == 0 {
		t.Errorf("chosen result = %+v", chosen)
	}

	e.do(t, http.MethodPost, base+"/save", nil, 409, &problem)
	if problem.Code != "selection_required" {
		t.Errorf("save without selection: %s", problem.Code)
	}
	e.do(t, http.MethodPut, base+"/selection", map[string]any{"solutionId": chosen.SolutionID}, 422, nil)
	e.do(t, http.MethodPut, base+"/selection", map[string]any{"solutionId": chosen.SolutionID, "acquisitionModel": "purchase"}, 200, &project)
	if project.Selection == nil || project.Selection.CalcResultID == nil || *project.Selection.CalcResultID != chosen.ID {
		t.Fatalf("selection = %+v", project.Selection)
	}
	var snap snapshotOut
	e.do(t, http.MethodGet, base+"/snapshot", nil, 200, &snap)
	if snap.Robot == nil || snap.Robot.SolutionID != chosen.SolutionID || snap.Robot.CalcRunID != ev.ID || snap.Robot.Offer == nil {
		t.Fatalf("snapshot robot = %+v", snap.Robot)
	}
	priceAtSelection := snap.Robot.Offer.Price.AmountRub

	// Any input change makes the calculation stale: the project cannot be saved on old figures.
	e.do(t, http.MethodPut, base+"/conditions", map[string]any{"items": []map[string]any{{"code": "payload", "number": 10}}}, 200, nil)
	e.do(t, http.MethodPost, base+"/save", nil, 409, &problem)
	if problem.Code != "evaluation_stale" {
		t.Errorf("save on a stale calculation: %s", problem.Code)
	}
	var stale evaluation
	e.do(t, http.MethodGet, base+"/evaluation", nil, 200, &stale)
	if !stale.Stale || stale.ID != ev.ID {
		t.Errorf("stale = %v, id %s", stale.Stale, stale.ID)
	}
	e.do(t, http.MethodDelete, base+"/conditions", nil, 200, nil)
	e.do(t, http.MethodPost, base+"/evaluate", nil, 201, &ev)
	e.do(t, http.MethodGet, base, nil, 200, &project)
	chosen = *resultOf(ev, chosen.SolutionID, "purchase")
	// D-89: the selected configuration is calculated again, so the selection moves to the new calculation.
	if project.Selection == nil || project.Selection.CalcResultID == nil || *project.Selection.CalcResultID != chosen.ID ||
		project.LatestEvaluation == nil || project.LatestEvaluation.ID != ev.ID || project.LatestEvaluation.Stale {
		t.Fatalf("a new calculation must keep the selection on its result: %+v %+v", project.Selection, project.LatestEvaluation)
	}
	e.do(t, http.MethodGet, base+"/snapshot", nil, 200, &snap)
	if snap.Robot == nil || snap.Robot.CalcRunID != ev.ID || snap.Robot.CalcResultID != chosen.ID {
		t.Fatalf("snapshot robot after recalculation = %+v", snap.Robot)
	}

	e.do(t, http.MethodPost, base+"/save", nil, 200, &project)
	if project.Status != "saved" || project.SavedAt == nil || project.Versions.Model == nil || *project.Versions.Model != "mock-calc/v1" {
		t.Fatalf("saved project = %+v", project)
	}
	e.do(t, http.MethodPost, base+"/save", nil, 409, nil)

	// A saved project is frozen.
	for _, c := range []struct {
		method, path string
		body         any
	}{
		{http.MethodPost, base + "/evaluate", nil},
		{http.MethodPost, base + "/matching-runs", nil},
		{http.MethodPut, base + "/conditions", map[string]any{"items": []any{}}},
		{http.MethodPost, base + "/refresh-snapshot", nil},
		{http.MethodPut, base + "/selection", map[string]any{"solutionId": nil}},
		{http.MethodPatch, base, map[string]any{"horizonYears": 9}},
	} {
		e.do(t, c.method, c.path, c.body, 409, &problem)
		if problem.Code != "project_saved" {
			t.Errorf("%s %s on a saved project: %s", c.method, c.path, problem.Code)
		}
	}
	e.do(t, http.MethodPatch, base, map[string]any{"name": "Сохранённая оценка"}, 200, nil)

	// Reproducible: new task values and catalog prices do not change the saved figures.
	e.do(t, http.MethodPatch, "/api/v1/tasks/"+task.ID, map[string]any{"params": map[string]any{"dailyVolume": 6000}}, 200, nil)
	e.do(t, http.MethodPatch, "/api/v1/solutions/"+chosen.SolutionID, map[string]any{"price": map[string]any{"amountRub": priceAtSelection * 2}}, 200, nil)
	var saved evaluation
	e.do(t, http.MethodGet, base+"/evaluation", nil, 200, &saved)
	again := resultOf(saved, chosen.SolutionID, "purchase")
	if saved.ID != ev.ID || again == nil || *again.CapexRub != *chosen.CapexRub || saved.Stale || saved.ModelOutdated {
		t.Errorf("saved evaluation changed: %+v", again)
	}
	e.do(t, http.MethodGet, base+"/snapshot", nil, 200, &snap)
	if snap.Robot == nil || snap.Robot.Offer.Price.AmountRub != priceAtSelection {
		t.Errorf("snapshot robot price = %+v, want %v", snap.Robot, priceAtSelection)
	}
	e.do(t, http.MethodGet, base, nil, 200, &project)
	if !project.DataChanged {
		t.Error("dataChanged = false after a task edit")
	}

	// Reopen: the next calculation uses the new catalog price; the saved one stays in history.
	e.do(t, http.MethodPost, base+"/reopen", nil, 200, &project)
	if project.Status != "draft" || project.SavedAt != nil {
		t.Fatalf("reopened project = %+v", project)
	}
	var fresh evaluation
	e.do(t, http.MethodPost, base+"/evaluate", nil, 201, &fresh)
	if r := resultOf(fresh, chosen.SolutionID, "purchase"); fresh.ID == ev.ID || r == nil || *r.CapexRub <= *chosen.CapexRub {
		t.Errorf("recalculation after reopen: %+v", r)
	}
	var runs int
	if err := e.pool.QueryRow(context.Background(), `SELECT count(*) FROM calc_run WHERE project_id = $1`, project.ID).Scan(&runs); err != nil {
		t.Fatal(err)
	}
	if runs != 3 {
		t.Errorf("calc runs = %d, want 3: history is kept", runs)
	}

	var copied projectOut
	e.do(t, http.MethodPost, base+"/copy", nil, 201, &copied)
	if copied.Status != "draft" || copied.Selection != nil || copied.LatestEvaluation != nil {
		t.Errorf("copy = %+v", copied)
	}
}

// TestMigration0006MapsStatuses: saved ↔ result, draft ↔ params on data, both ways.
func TestMigration0006MapsStatuses(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	if _, err := e.pool.Exec(ctx, `UPDATE project SET status = 'saved' WHERE id = (SELECT id FROM project ORDER BY id LIMIT 1)`); err != nil {
		t.Fatal(err)
	}
	counts := func() map[string]int {
		rows, err := e.pool.Query(ctx, `SELECT status, count(*) FROM project GROUP BY status`)
		if err != nil {
			t.Fatal(err)
		}
		out, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (struct {
			s string
			n int
		}, error) {
			var v struct {
				s string
				n int
			}
			return v, r.Scan(&v.s, &v.n)
		})
		if err != nil {
			t.Fatal(err)
		}
		m := map[string]int{}
		for _, v := range out {
			m[v.s] = v.n
		}
		return m
	}
	before := counts()
	db := stdlib.OpenDBFromPool(e.pool)
	defer db.Close()
	if err := goose.DownTo(db, ".", 5); err != nil {
		t.Fatalf("down to 5: %v", err)
	}
	down := counts()
	if down["result"] != before["saved"] || down["params"] != before["draft"] {
		t.Errorf("down: %v, before %v", down, before)
	}
	if err := goose.Up(db, "."); err != nil {
		t.Fatalf("up: %v", err)
	}
	if after := counts(); after["saved"] != before["saved"] || after["draft"] != before["draft"] {
		t.Errorf("up: %v, before %v", after, before)
	}
}

// TestDemoProjectsAreCalculated: the seed evaluates demo projects, a guest reads the figures.
func TestDemoProjectsAreCalculated(t *testing.T) {
	e := setup(t)
	guest := e.as("")
	var projects struct{ Items []projectOut }
	guest.do(t, http.MethodGet, "/api/v1/projects?q="+url.QueryEscape("Химки"), nil, 200, &projects)
	if len(projects.Items) != 1 || projects.Items[0].LatestEvaluation == nil {
		t.Fatalf("demo projects = %+v", projects.Items)
	}
	var ev evaluation
	guest.do(t, http.MethodGet, "/api/v1/projects/"+projects.Items[0].ID+"/evaluation", nil, 200, &ev)
	firstCalculated(t, ev)
	e.do(t, http.MethodPost, "/api/v1/projects/"+projects.Items[0].ID+"/evaluate", nil, 403, nil)
}
