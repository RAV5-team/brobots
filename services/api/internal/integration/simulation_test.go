//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/brobots/api/internal/clients/simulation"
)

// fakeSimulation answers like services/simulation: a job that runs once and finishes with one run.
type fakeSimulation struct {
	mu      sync.Mutex
	request map[string]any
	auth    string
	polls   int
}

func (f *fakeSimulation) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	switch {
	case r.Method == http.MethodPost && r.URL.Path == "/api/simulations":
		f.auth = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&f.request)
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"job_id":"job-1","status_url":"/api/simulations/jobs/job-1"}`))
	case r.URL.Path == "/api/simulations/jobs/job-1":
		f.polls++
		if f.polls == 1 {
			_, _ = w.Write([]byte(`{"job_id":"job-1","status":"running","log":["Смоделированы сутки"],"elapsed":1}`))
			return
		}
		_, _ = w.Write([]byte(`{"job_id":"job-1","status":"done","log":["Смоделированы сутки","Вердикт"],"elapsed":2,"simulation_ids":["sim-1"]}`))
	case r.URL.Path == "/api/simulations/sim-1":
		_, _ = w.Write([]byte(`{"simulation_id":"sim-1","status":"confirmed"}`))
	case r.URL.Path == "/api/simulations/sim-1/traces":
		_, _ = w.Write([]byte(`[{"name":"Из подбора","frames":[]}]`))
	default:
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":"not found"}`))
	}
}

type simulationRunOut struct {
	ID           string   `json:"id"`
	Status       string   `json:"status"`
	Log          []string `json:"log"`
	SimulationID *string  `json:"simulationId"`
	Stale        bool     `json:"stale"`
	Fleet        struct{ Robots, Stations int }
}

// TestSimulationRuns: the orchestrator builds the simulation input from the selected configuration, follows the job
// and passes the run and its traces through.
func TestSimulationRuns(t *testing.T) {
	e := setup(t)
	fake := &fakeSimulation{}
	sim := httptest.NewServer(fake)
	t.Cleanup(sim.Close)
	e.svc.WithSimulator(simulation.New(sim.URL, 5*time.Second))

	var loc named
	e.do(t, http.MethodPost, "/api/v1/locations", map[string]any{
		"name": "Склад Симуляция", "facilityTypeCode": "warehouse", "city": "Самара", "fillDefaults": true,
		"capexBudget": map[string]any{"amount": 40_000_000, "currency": "RUB"},
	}, 201, &loc)
	var procs struct{ Items []named }
	e.do(t, http.MethodGet, "/api/v1/processes?facilityType=warehouse", nil, 200, &procs)
	var task named
	for _, p := range procs.Items {
		if p.Code == "PR-0001" {
			e.do(t, http.MethodPost, "/api/v1/locations/"+loc.ID+"/tasks", map[string]any{"processId": p.ID}, 201, &task)
		}
	}
	var p projectState
	e.do(t, http.MethodPost, "/api/v1/projects", map[string]any{"locationId": loc.ID, "taskId": task.ID}, 201, &p)
	base := "/api/v1/projects/" + p.ID
	body := map[string]any{"conditions": map[string]any{
		"peakHours": map[string]any{"inbound": []int{8, 9, 10}, "outbound": []int{15, 14}}, "traffic": "often", "maxWaitMin": 20,
	}}
	var problem struct{ Code string }
	e.do(t, http.MethodPost, base+"/simulation-runs", body, 409, &problem)
	if problem.Code != "selection_required" {
		t.Errorf("simulation without a selection: %s", problem.Code)
	}

	var ev evaluation
	e.do(t, http.MethodPost, base+"/evaluate", nil, 201, &ev)
	chosen := firstCalculated(t, ev)
	e.do(t, http.MethodPut, base+"/selection", map[string]any{"solutionId": chosen.SolutionID, "acquisitionModel": "purchase"}, 200, nil)

	var run simulationRunOut
	e.do(t, http.MethodPost, base+"/simulation-runs", body, 201, &run)
	if run.Status != "queued" || run.Fleet.Robots != *chosen.RobotCount {
		t.Fatalf("started run = %+v, want %d robots", run, *chosen.RobotCount)
	}
	fake.mu.Lock()
	req, auth := fake.request, fake.auth
	fake.mu.Unlock()
	if !strings.HasPrefix(auth, "Bearer ") {
		t.Errorf("the user's token must be passed to the simulation, got %q", auth)
	}
	cfg, _ := req["configuration"].(map[string]any)
	if int(cfg["robot_count"].(float64)) != *chosen.RobotCount || cfg["robot"] == nil || cfg["calc"] == nil {
		t.Errorf("configuration = %+v", cfg)
	}
	scenario := req["scenarios"].([]any)[0].(map[string]any)["simulation_params"].(map[string]any)
	peaks := scenario["schedule"].(map[string]any)["peaks"].([]any)
	if len(peaks) != 2 || peaks[0].(map[string]any)["dur_h"].(float64) != 3 || peaks[1].(map[string]any)["start_h"].(float64) != 14 {
		t.Errorf("peaks = %+v", peaks)
	}
	if scenario["site_conditions"].(map[string]any)["traffic"] != "mid" || scenario["service"].(map[string]any)["wait_limit_min"].(float64) != 20 {
		t.Errorf("simulation params = %+v", scenario)
	}

	runPath := "/api/v1/simulation-runs/" + run.ID
	e.do(t, http.MethodGet, runPath+"/result", nil, 409, nil)
	e.do(t, http.MethodGet, runPath, nil, 200, &run)
	if run.Status != "running" || len(run.Log) != 1 {
		t.Errorf("running = %+v", run)
	}
	e.do(t, http.MethodGet, runPath, nil, 200, &run)
	if run.Status != "done" || run.SimulationID == nil || *run.SimulationID != "sim-1" {
		t.Fatalf("done = %+v", run)
	}
	var result struct{ SimulationID string `json:"simulation_id"` }
	e.do(t, http.MethodGet, runPath+"/result", nil, 200, &result)
	var traces []struct{ Name string }
	e.do(t, http.MethodGet, runPath+"/traces", nil, 200, &traces)
	if result.SimulationID != "sim-1" || len(traces) != 1 {
		t.Errorf("result %+v traces %+v", result, traces)
	}
	e.do(t, http.MethodDelete, runPath, nil, 409, nil)

	// A later change of the inputs marks the run stale; a guest does not see a run of a private project.
	e.do(t, http.MethodPut, base+"/conditions", map[string]any{"items": []map[string]any{{"code": "payload", "number": 10}}}, 200, nil)
	e.do(t, http.MethodGet, runPath, nil, 200, &run)
	if !run.Stale {
		t.Error("run is not stale after a change of the project")
	}
	e.as("").do(t, http.MethodGet, runPath, nil, 404, nil)

	// A guest may start a run of a demo project: access is by reading, the selection is still required.
	var demo struct{ Items []named }
	e.as("").do(t, http.MethodGet, "/api/v1/projects?q="+url.QueryEscape("Химки"), nil, 200, &demo)
	if len(demo.Items) == 0 {
		t.Fatal("no demo project")
	}
	e.as("").do(t, http.MethodPost, "/api/v1/projects/"+demo.Items[0].ID+"/simulation-runs", map[string]any{}, 409, &problem)
	if problem.Code != "selection_required" {
		t.Errorf("guest on a demo project: %s", problem.Code)
	}
}
