//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/brobots/api/internal/clients/simulation"
)

const guestJob = "0123456789abcdef0123456789abcdef"

// fakeInternalSimulation answers the internal paths of services/simulation that api uses for guest runs.
type fakeInternalSimulation struct {
	mu      sync.Mutex
	auth    []string
	request map[string]any
	busy    bool
}

func (f *fakeInternalSimulation) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.auth = append(f.auth, r.Header.Get("Authorization"))
	w.Header().Set("Content-Type", "application/json")
	switch {
	case r.Method == http.MethodPost && r.URL.Path == "/internal/simulations":
		if f.busy {
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"busy"}`))
			return
		}
		_ = json.NewDecoder(r.Body).Decode(&f.request)
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"job_id":"` + guestJob + `"}`))
	case r.URL.Path == "/internal/simulations/jobs/"+guestJob:
		_, _ = w.Write([]byte(`{"job_id":"` + guestJob + `","status":"done","log":["Вердикт"],"elapsed":2,"simulation_ids":["sim-g"]}`))
	case r.URL.Path == "/internal/simulations/sim-g":
		_, _ = w.Write([]byte(`{"simulation_id":"sim-g"}`))
	case r.URL.Path == "/internal/simulations/sim-g/traces":
		_, _ = w.Write([]byte(`[]`))
	default:
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":"not found"}`))
	}
}

// TestGuestPreview: a guest recalculates and simulates a demo project; api saves nothing (roles model §5).
func TestGuestPreview(t *testing.T) {
	e := setup(t)
	fake := &fakeInternalSimulation{}
	sim := httptest.NewServer(fake)
	t.Cleanup(sim.Close)
	serviceToken := func(base http.RoundTripper) http.RoundTripper {
		return roundTrip(func(r *http.Request) (*http.Response, error) {
			r = r.Clone(r.Context())
			r.Header.Set("Authorization", "Bearer service")
			return base.RoundTrip(r)
		})
	}
	e.svc.WithGuestSimulator(simulation.NewInternal(sim.URL, 5*time.Second, serviceToken))
	guest := e.as("")

	var demo struct{ Items []named }
	guest.do(t, http.MethodGet, "/api/v1/projects?q="+url.QueryEscape("Химки"), nil, 200, &demo)
	base := "/api/v1/projects/" + demo.Items[0].ID
	rows := func() string {
		var runs, calcs, matches int
		ctx := context.Background()
		_ = e.pool.QueryRow(ctx, `SELECT count(*) FROM simulation_run`).Scan(&runs)
		_ = e.pool.QueryRow(ctx, `SELECT count(*) FROM calc_run`).Scan(&calcs)
		_ = e.pool.QueryRow(ctx, `SELECT count(*) FROM match_run`).Scan(&matches)
		return fmt.Sprintf("%d/%d/%d", runs, calcs, matches)
	}
	before := rows()

	var ev evaluation
	guest.do(t, http.MethodPost, base+"/preview", nil, 200, &ev)
	chosen := firstCalculated(t, ev)
	var changed evaluation // a fresh value: decoding into ev would rewrite the pointers chosen holds
	guest.do(t, http.MethodPost, base+"/preview", map[string]any{
		"taskConditions": []map[string]any{{"code": "payload", "number": 10}},
		"calcOverrides":  map[string]any{"workHoursPerDay": 20},
	}, 200, &changed)
	guest.do(t, http.MethodPost, base+"/preview", map[string]any{
		"taskConditions": []map[string]any{{"code": "unknown"}},
	}, 422, nil)

	var run struct {
		ID           string
		Status       string
		SimulationID *string
		Fleet        *struct{ Robots int }
	}
	guest.do(t, http.MethodPost, base+"/preview/simulation-runs", map[string]any{
		"solutionId": chosen.SolutionID, "acquisitionModel": chosen.AcquisitionModel,
	}, 201, &run)
	if run.ID != guestJob || run.Status != "queued" || run.Fleet == nil || run.Fleet.Robots != *chosen.RobotCount {
		t.Fatalf("guest run = %+v", run)
	}
	guest.do(t, http.MethodGet, "/api/v1/preview/simulation-runs/"+guestJob, nil, 200, &run)
	if run.Status != "done" || run.SimulationID == nil || *run.SimulationID != "sim-g" {
		t.Fatalf("guest run polled = %+v", run)
	}
	guest.do(t, http.MethodGet, "/api/v1/preview/simulation-runs/"+guestJob+"/result", nil, 200, nil)
	guest.do(t, http.MethodGet, "/api/v1/preview/simulation-runs/"+guestJob+"/traces", nil, 200, nil)
	guest.do(t, http.MethodGet, "/api/v1/preview/simulation-runs/not-a-job", nil, 404, nil)
	guest.do(t, http.MethodPost, base+"/preview/simulation-runs", map[string]any{
		"solutionId": "00000000-0000-0000-0000-000000000001", "acquisitionModel": "purchase",
	}, 409, nil)

	if after := rows(); after != before {
		t.Errorf("preview wrote to the database: simulation_run/calc_run/match_run %s → %s", before, after)
	}
	fake.mu.Lock()
	for _, a := range fake.auth {
		if a != "Bearer service" {
			t.Errorf("guest run called without the service token: %q", a)
		}
	}
	fake.busy = true
	fake.mu.Unlock()
	var problem struct{ Code string }
	guest.do(t, http.MethodPost, base+"/preview/simulation-runs", map[string]any{
		"solutionId": chosen.SolutionID, "acquisitionModel": chosen.AcquisitionModel,
	}, 429, &problem)
	if problem.Code != "simulation_busy" {
		t.Errorf("busy simulation: %s", problem.Code)
	}

	// The preview is for demo projects: an own project is calculated and saved the usual way.
	var loc, task, own named
	e.do(t, http.MethodPost, "/api/v1/locations/from-template", map[string]any{"templateLocationId": demoLocationID(t, e)}, 201, &loc)
	var tasks struct{ Items []named }
	e.do(t, http.MethodGet, "/api/v1/locations/"+loc.ID+"/tasks", nil, 200, &tasks)
	task = tasks.Items[0]
	e.do(t, http.MethodPost, "/api/v1/projects", map[string]any{"locationId": loc.ID, "taskId": task.ID}, 201, &own)
	e.do(t, http.MethodPost, "/api/v1/projects/"+own.ID+"/preview", nil, 403, &problem)
	if problem.Code != "preview_demo_only" {
		t.Errorf("preview of an own project: %s", problem.Code)
	}
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
