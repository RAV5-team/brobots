//go:build integration

package integration

import (
	"net/http"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/brobots/api/internal/calc/economics"
)

type econResult struct {
	ID               string   `json:"id"`
	SolutionID       string   `json:"solutionId"`
	AcquisitionModel string   `json:"acquisitionModel"`
	Calculable       bool     `json:"calculable"`
	Reason           *string  `json:"reason"`
	RobotCount       *int     `json:"robotCount"`
	CapexRub         *float64 `json:"capexRub"`
	OpexYearRub      *float64 `json:"opexYearRub"`
	Feasibility      *string  `json:"feasibility"`
	Rank             *int     `json:"rank"`
	Score            *float64 `json:"score"`
	Details          struct {
		CapexItems          []struct{ Code string }
		BaselineOpexYearRub *float64
		ScoreCriteria       []struct{ Code string }
	} `json:"details"`
}

type econEvaluation struct {
	ID                  string  `json:"id"`
	ModelVersion        string  `json:"modelVersion"`
	RankingVersion      *string `json:"rankingVersion"`
	NormsVersion        *int    `json:"normsVersion"`
	RecommendedResultID *string `json:"recommendedResultId"`
	Candidates          []struct {
		Results []econResult `json:"results"`
	} `json:"candidates"`
}

func (ev econEvaluation) calculated() []econResult {
	var out []econResult
	for _, c := range ev.Candidates {
		for _, r := range c.Results {
			if r.Calculable {
				out = append(out, r)
			}
		}
	}
	return out
}

// TestEconomicsFlow runs the orchestrator against a live services/economics:
//
//	TEST_DATABASE_URL=… ECONOMICS_TEST_URL=http://localhost:18002 go test -tags=integration ./internal/integration/ -run Economics
func TestEconomicsFlow(t *testing.T) {
	econURL := os.Getenv("ECONOMICS_TEST_URL")
	if econURL == "" {
		t.Skip("ECONOMICS_TEST_URL is not set")
	}
	e := setupWith(t, economics.New(econURL, 10*time.Second))

	// The seed calculated the demo project with the economics service.
	var projects struct{ Items []projectOut }
	e.as("").do(t, http.MethodGet, "/api/v1/projects?q="+url.QueryEscape("Химки"), nil, 200, &projects)
	if len(projects.Items) != 1 || projects.Items[0].LatestEvaluation == nil {
		t.Fatalf("demo projects = %+v", projects.Items)
	}
	var demo econEvaluation
	e.as("").do(t, http.MethodGet, "/api/v1/projects/"+projects.Items[0].ID+"/evaluation", nil, 200, &demo)
	if demo.ModelVersion != "economic-v1.1" || demo.NormsVersion == nil || *demo.NormsVersion != 1 {
		t.Fatalf("demo evaluation = %s norms %v", demo.ModelVersion, demo.NormsVersion)
	}
	calculated := demo.calculated()
	if len(calculated) == 0 {
		t.Fatal("no demo candidate is calculated by the economics service")
	}
	if demo.RankingVersion == nil || *demo.RankingVersion != "ranking-v1" || demo.RecommendedResultID == nil {
		t.Errorf("ranking = %v, recommended %v", demo.RankingVersion, demo.RecommendedResultID)
	}
	if demo.RecommendedResultID != nil {
		best := resultByID(demo, *demo.RecommendedResultID)
		if best == nil || best.Rank == nil || *best.Rank != 1 || best.Score == nil || best.Feasibility == nil ||
			len(best.Details.CapexItems) == 0 || best.Details.BaselineOpexYearRub == nil || len(best.Details.ScoreCriteria) != 8 {
			t.Errorf("recommended result = %+v", best)
		}
		if resultByID(econEvaluation{Candidates: demo.Candidates[:1]}, *demo.RecommendedResultID) == nil {
			t.Errorf("the recommended robot must come first, got %+v", demo.Candidates[0].Results)
		}
	}

	// Norms: the current set, validation of the ranking weights, a new version.
	var norms struct {
		Version int
		Values  []struct {
			Code  string
			Value float64
		}
	}
	e.do(t, http.MethodGet, "/api/v1/norms", nil, 200, &norms)
	if norms.Version != 1 || len(norms.Values) < 40 {
		t.Fatalf("norms = v%d, %d values", norms.Version, len(norms.Values))
	}
	e.do(t, http.MethodPost, "/api/v1/norm-sets", map[string]any{"values": []map[string]any{{"code": "ranking_weight_roi", "value": 50}}}, 422, nil)

	// A user project: evaluate on norms v1, select, save.
	var loc named
	e.do(t, http.MethodPost, "/api/v1/locations/from-template", map[string]any{"templateLocationId": demoLocationID(t, e), "name": "Склад Economics"}, 201, &loc)
	var tasks struct{ Items []named }
	e.do(t, http.MethodGet, "/api/v1/locations/"+loc.ID+"/tasks", nil, 200, &tasks)
	var project projectOut
	e.do(t, http.MethodPost, "/api/v1/projects", map[string]any{"locationId": loc.ID, "taskId": palletTask(t, tasks.Items)}, 201, &project)
	base := "/api/v1/projects/" + project.ID
	var ev econEvaluation
	e.do(t, http.MethodPost, base+"/evaluate", nil, 201, &ev)
	chosen := ev.calculated()
	if len(chosen) == 0 {
		t.Fatalf("user project: nothing calculated: %+v", ev)
	}
	pick := chosen[0]
	e.do(t, http.MethodPut, base+"/selection", map[string]any{"solutionId": pick.SolutionID, "acquisitionModel": pick.AcquisitionModel}, 200, nil)
	e.do(t, http.MethodPost, base+"/save", nil, 200, &project)
	if project.Versions.Model == nil || *project.Versions.Model != "economic-v1.1" {
		t.Fatalf("saved model version = %v", project.Versions.Model)
	}

	// A new norm set does not change the saved figures; the project is told a newer set exists.
	var v2 struct{ Version int }
	e.do(t, http.MethodPost, "/api/v1/norm-sets", map[string]any{"note": "Тариф по договору объекта",
		"values": []map[string]any{{"code": "electricity_price", "value": 15}}}, 201, &v2)
	if v2.Version != 2 {
		t.Fatalf("new norm set = v%d", v2.Version)
	}
	var saved econEvaluation
	e.do(t, http.MethodGet, base+"/evaluation", nil, 200, &saved)
	again := resultByID(saved, pick.ID)
	if saved.ID != ev.ID || again == nil || *again.OpexYearRub != *pick.OpexYearRub || *saved.NormsVersion != 1 {
		t.Errorf("saved evaluation changed after new norms: %+v", again)
	}
	var withFlag struct{ NormsUpdated bool }
	e.do(t, http.MethodGet, base, nil, 200, &withFlag)
	if !withFlag.NormsUpdated {
		t.Error("normsUpdated = false after a new norm set")
	}

	// Reopen and refresh: the project moves to norms v2 and the energy cost grows.
	e.do(t, http.MethodPost, base+"/reopen", nil, 200, nil)
	e.do(t, http.MethodPost, base+"/refresh-snapshot", nil, 200, nil)
	var fresh econEvaluation
	e.do(t, http.MethodPost, base+"/evaluate", nil, 201, &fresh)
	if fresh.NormsVersion == nil || *fresh.NormsVersion != 2 {
		t.Fatalf("fresh evaluation norms = %v", fresh.NormsVersion)
	}
	var same *econResult
	for _, r := range fresh.calculated() {
		if r.SolutionID == pick.SolutionID && r.AcquisitionModel == pick.AcquisitionModel {
			same = &r
		}
	}
	if same == nil || *same.OpexYearRub <= *pick.OpexYearRub {
		t.Errorf("OPEX on norms v2 = %+v, was %v", same, *pick.OpexYearRub)
	}
}

func resultByID(ev econEvaluation, id string) *econResult {
	for _, c := range ev.Candidates {
		for _, r := range c.Results {
			if r.ID == id {
				return &r
			}
		}
	}
	return nil
}

func demoLocationID(t *testing.T, e *env) string {
	t.Helper()
	var templates struct {
		Items []struct {
			LocationID string `json:"locationId"`
			Name       string `json:"name"`
		}
	}
	e.do(t, http.MethodGet, "/api/v1/locations/templates", nil, 200, &templates)
	for _, tpl := range templates.Items {
		if tpl.Name == "РЦ Химки" {
			return tpl.LocationID
		}
	}
	t.Fatalf("no template РЦ Химки in %+v", templates.Items)
	return ""
}

func palletTask(t *testing.T, tasks []named) string {
	t.Helper()
	for _, task := range tasks {
		if task.Name == "Перемещение паллет" {
			return task.ID
		}
	}
	t.Fatalf("no pallet task in %+v", tasks)
	return ""
}
