//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
	"testing"
)

type projectState struct {
	ID               string          `json:"id"`
	Status           string          `json:"status"`
	Step             string          `json:"step"`
	Inputs           json.RawMessage `json:"inputs"`
	QuoteRequestedAt *string         `json:"quoteRequestedAt"`
	Task             struct{ ID string }
	Selection        *struct{ SolutionID string }
	ResultSummary    *struct {
		AcquisitionModel string   `json:"acquisitionModel"`
		CapexRub         float64  `json:"capexRub"`
		NetEffectYearRub *float64 `json:"netEffectYearRub"`
	} `json:"resultSummary"`
}

// TestProjectStepState: decisions by steps are kept as is, a task switch starts the draft over, save
// freezes the figures of the selected scenario, a quote request is accepted after save.
func TestProjectStepState(t *testing.T) {
	e := setup(t)
	var loc named
	e.do(t, http.MethodPost, "/api/v1/locations", map[string]any{
		"name": "Склад Шаги", "facilityTypeCode": "warehouse", "city": "Тверь", "fillDefaults": true,
		"capexBudget": map[string]any{"amount": 40_000_000, "currency": "RUB"},
	}, 201, &loc)
	var procs struct{ Items []named }
	e.do(t, http.MethodGet, "/api/v1/processes?facilityType=warehouse", nil, 200, &procs)
	byCode := map[string]string{}
	for _, p := range procs.Items {
		byCode[p.Code] = p.ID
	}
	var first, second named
	e.do(t, http.MethodPost, "/api/v1/locations/"+loc.ID+"/tasks", map[string]any{"processId": byCode["PR-0001"]}, 201, &first)
	e.do(t, http.MethodPost, "/api/v1/locations/"+loc.ID+"/tasks", map[string]any{"processId": byCode["PR-0002"]}, 201, &second)

	var p projectState
	e.do(t, http.MethodPost, "/api/v1/projects", map[string]any{"locationId": loc.ID, "taskId": first.ID}, 201, &p)
	if p.Step != "params" || string(p.Inputs) != "null" || p.ResultSummary != nil {
		t.Fatalf("new project = %+v inputs=%s", p, p.Inputs)
	}
	base := "/api/v1/projects/" + p.ID

	inputs := map[string]any{"params": map[string]any{"assumptions": []any{}}, "matching": nil, "stale": map[string]any{"matching": false}}
	e.do(t, http.MethodPatch, base, map[string]any{"step": "matching", "inputs": inputs}, 200, &p)
	var got map[string]any
	if err := json.Unmarshal(p.Inputs, &got); err != nil || p.Step != "matching" {
		t.Fatalf("patched = %+v inputs=%s", p, p.Inputs)
	}
	if _, kept := got["matching"]; !kept {
		t.Errorf("inputs lost a null field: %s", p.Inputs)
	}
	e.do(t, http.MethodPatch, base, map[string]any{"inputs": []any{1}}, 422, nil)
	e.do(t, http.MethodPatch, base, map[string]any{"step": "report"}, 422, nil)

	e.do(t, http.MethodPatch, base, map[string]any{"taskId": second.ID}, 200, &p)
	if p.Task.ID != second.ID || p.Step != "params" || string(p.Inputs) != "null" {
		t.Fatalf("after the task switch = %+v inputs=%s", p, p.Inputs)
	}
	e.do(t, http.MethodPatch, base, map[string]any{"taskId": first.ID}, 200, nil)

	var ev evaluation
	e.do(t, http.MethodPost, base+"/evaluate", nil, 201, &ev)
	chosen := firstCalculated(t, ev)
	e.do(t, http.MethodPost, base+"/quote-request", nil, 409, nil)
	e.do(t, http.MethodPut, base+"/selection", map[string]any{"solutionId": chosen.SolutionID, "acquisitionModel": "purchase"}, 200, nil)
	e.do(t, http.MethodPost, base+"/save", nil, 200, &p)
	if p.ResultSummary == nil || p.ResultSummary.AcquisitionModel != "purchase" || p.ResultSummary.CapexRub != *chosen.CapexRub {
		t.Fatalf("result summary = %+v, want capex %v", p.ResultSummary, *chosen.CapexRub)
	}

	var problem struct{ Code string }
	e.do(t, http.MethodPatch, base, map[string]any{"inputs": inputs}, 409, &problem)
	if problem.Code != "project_saved" {
		t.Errorf("inputs of a saved project: %s", problem.Code)
	}
	e.do(t, http.MethodPost, base+"/quote-request", nil, 200, &p)
	if p.QuoteRequestedAt == nil || p.Status != "saved" {
		t.Errorf("quote request = %+v", p)
	}

	var list struct{ Items []projectState }
	e.do(t, http.MethodGet, "/api/v1/projects?locationId="+loc.ID, nil, 200, &list)
	if len(list.Items) != 1 || list.Items[0].ResultSummary == nil {
		t.Errorf("list = %+v", list.Items)
	}
	var dash struct {
		FoundSavingsRubYear *float64 `json:"foundSavingsRubYear"`
	}
	e.do(t, http.MethodGet, "/api/v1/dashboard/summary", nil, 200, &dash)
	if p.ResultSummary.NetEffectYearRub != nil && dash.FoundSavingsRubYear == nil {
		t.Error("dashboard found savings = null with a saved effect")
	}

	e.do(t, http.MethodPost, base+"/reopen", nil, 200, &p)
	if p.ResultSummary != nil || p.Status != "draft" {
		t.Errorf("reopened = %+v", p)
	}
}
