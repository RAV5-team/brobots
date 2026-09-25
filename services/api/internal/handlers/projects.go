package handlers

import (
	"net/http"

	"github.com/brobots/api/internal/matching"
	"github.com/brobots/api/internal/service"
	"github.com/google/uuid"
)

func (a *API) listProjects(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := service.ProjectQuery{Status: q.Get("status"), Q: q.Get("q"), Sort: q.Get("sort")}
	var ok bool
	if f.LocationID, ok = queryUUID(w, r, "locationId"); !ok {
		return
	}
	if f.TaskID, ok = queryUUID(w, r, "taskId"); !ok {
		return
	}
	if f.Limit, f.Offset, ok = pageParams(w, r); !ok {
		return
	}
	v, err := a.svc.ListProjects(r.Context(), f)
	a.respond(w, r, http.StatusOK, v, err)
}

func (a *API) createProject(w http.ResponseWriter, r *http.Request) {
	a.withBody(w, r, func(b []byte) (any, error) { return a.svc.CreateProject(r.Context(), b) }, http.StatusCreated)
}

func (a *API) getProject(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.GetProject(r.Context(), id) }, http.StatusOK)
}

func (a *API) patchProject(w http.ResponseWriter, r *http.Request) {
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) { return a.svc.PatchProject(r.Context(), id, b) }, http.StatusOK)
}

func (a *API) deleteProject(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return nil, a.svc.DeleteProject(r.Context(), id) }, http.StatusNoContent)
}

func (a *API) copyProject(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.CopyProject(r.Context(), id) }, http.StatusCreated)
}

func (a *API) refreshSnapshot(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.RefreshSnapshot(r.Context(), id) }, http.StatusOK)
}

func (a *API) snapshot(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.Snapshot(r.Context(), id) }, http.StatusOK)
}

func (a *API) conditions(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) {
		v, err := a.svc.Conditions(r.Context(), id)
		return map[string]any{"items": v}, err
	}, http.StatusOK)
}

func (a *API) putConditions(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		Items []matching.Override `json:"items"`
	}
	if !decodeInto(a, w, r, &in) {
		return
	}
	v, err := a.svc.PutConditions(r.Context(), id, in.Items)
	a.respond(w, r, http.StatusOK, map[string]any{"items": v}, err)
}

func (a *API) resetConditions(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) {
		v, err := a.svc.PutConditions(r.Context(), id, nil)
		return map[string]any{"items": v}, err
	}, http.StatusOK)
}

func (a *API) runMatching(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.RunMatching(r.Context(), id) }, http.StatusCreated)
}

func (a *API) latestRun(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.LatestRun(r.Context(), id) }, http.StatusOK)
}

func (a *API) getRun(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.GetRun(r.Context(), id) }, http.StatusOK)
}

func (a *API) manualCandidates(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) {
		v, err := a.svc.ManualCandidates(r.Context(), id)
		return map[string]any{"items": v}, err
	}, http.StatusOK)
}

func (a *API) addManualCandidate(w http.ResponseWriter, r *http.Request) {
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) {
		v, err := a.svc.AddManualCandidate(r.Context(), id, b)
		return map[string]any{"items": v}, err
	}, http.StatusCreated)
}

func (a *API) removeManualCandidate(w http.ResponseWriter, r *http.Request) {
	solID, ok := pathID(w, r, "solutionId")
	if !ok {
		return
	}
	a.withID(w, r, func(id uuid.UUID) (any, error) { return nil, a.svc.RemoveManualCandidate(r.Context(), id, solID) }, http.StatusNoContent)
}

func (a *API) putSelection(w http.ResponseWriter, r *http.Request) {
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) { return a.svc.PutSelection(r.Context(), id, b) }, http.StatusOK)
}

func (a *API) evaluationContext(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.EvaluationContext(r.Context(), id) }, http.StatusOK)
}
