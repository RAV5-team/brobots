package handlers

import (
	"net/http"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (a *API) listProcesses(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := service.ProcessQuery{Q: q.Get("q"), FacilityType: q.Get("facilityType"), Category: q.Get("category")}
	var ok bool
	if f.WorkTypeID, ok = queryUUID(w, r, "workTypeId"); !ok {
		return
	}
	if f.IsCustom, ok = queryBool(w, r, "isCustom"); !ok {
		return
	}
	hidden, ok := queryBool(w, r, "includeHidden")
	if !ok {
		return
	}
	f.IncludeHidden = domain.Deref(hidden)
	v, err := a.svc.ListProcesses(r.Context(), f)
	a.respond(w, r, http.StatusOK, map[string]any{"items": v}, err)
}

func (a *API) createProcess(w http.ResponseWriter, r *http.Request) {
	a.withBody(w, r, func(b []byte) (any, error) { return a.svc.CreateProcess(r.Context(), b) }, http.StatusCreated)
}

func (a *API) getProcess(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.GetProcess(r.Context(), id) }, http.StatusOK)
}

func (a *API) patchProcess(w http.ResponseWriter, r *http.Request) {
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) { return a.svc.PatchProcess(r.Context(), id, b) }, http.StatusOK)
}

func (a *API) hideProcess(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return nil, a.svc.HideProcess(r.Context(), id) }, http.StatusNoContent)
}

func (a *API) processRobots(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.ProcessRobots(r.Context(), id) }, http.StatusOK)
}

func (a *API) duplicateProcess(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.DuplicateProcess(r.Context(), id) }, http.StatusCreated)
}

func (a *API) facilityParameters(w http.ResponseWriter, r *http.Request) {
	v, err := a.svc.FacilityParameters(r.Context(), chi.URLParam(r, "code"))
	a.respond(w, r, http.StatusOK, map[string]any{"items": v}, err)
}

func (a *API) listLocations(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := service.LocationQuery{Q: q.Get("q"), FacilityType: q.Get("facilityType"), Completeness: q.Get("completeness"),
		Projects: q.Get("projects"), Sort: q.Get("sort")}
	var ok bool
	if f.Limit, f.Offset, ok = pageParams(w, r); !ok {
		return
	}
	v, err := a.svc.ListLocations(r.Context(), f)
	a.respond(w, r, http.StatusOK, v, err)
}

func (a *API) createLocation(w http.ResponseWriter, r *http.Request) {
	a.withBody(w, r, func(b []byte) (any, error) { return a.svc.CreateLocation(r.Context(), b) }, http.StatusCreated)
}

func (a *API) locationTemplates(w http.ResponseWriter, r *http.Request) {
	v, err := a.svc.LocationTemplates(r.Context())
	a.respond(w, r, http.StatusOK, map[string]any{"items": v}, err)
}

func (a *API) createLocationFromTemplate(w http.ResponseWriter, r *http.Request) {
	a.withBody(w, r, func(b []byte) (any, error) { return a.svc.CreateLocationFromTemplate(r.Context(), b) }, http.StatusCreated)
}

func (a *API) getLocation(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.GetLocation(r.Context(), id) }, http.StatusOK)
}

func (a *API) patchLocation(w http.ResponseWriter, r *http.Request) {
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) { return a.svc.PatchLocation(r.Context(), id, b) }, http.StatusOK)
}

func (a *API) deleteLocation(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return nil, a.svc.DeleteLocation(r.Context(), id) }, http.StatusNoContent)
}

func (a *API) locationParameters(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.LocationParameters(r.Context(), id) }, http.StatusOK)
}

func (a *API) putLocationParameters(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		Items []domain.ParameterInput `json:"items"`
	}
	if !decodeInto(a, w, r, &in) {
		return
	}
	v, err := a.svc.PutLocationParameters(r.Context(), id, in.Items)
	a.respond(w, r, http.StatusOK, v, err)
}

func (a *API) putStaffGroups(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		Items []service.StaffGroupInput `json:"items"`
	}
	if !decodeInto(a, w, r, &in) {
		return
	}
	v, err := a.svc.PutStaffGroups(r.Context(), id, in.Items)
	a.respond(w, r, http.StatusOK, map[string]any{"items": v}, err)
}

func (a *API) listLocationTasks(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) {
		v, err := a.svc.ListLocationTasks(r.Context(), id)
		return map[string]any{"items": v}, err
	}, http.StatusOK)
}

func (a *API) createTask(w http.ResponseWriter, r *http.Request) {
	dry, ok := queryBool(w, r, "dryRun")
	if !ok {
		return
	}
	status := http.StatusCreated
	if domain.Deref(dry) {
		status = http.StatusOK
	}
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) {
		return a.svc.CreateTask(r.Context(), id, b, domain.Deref(dry))
	}, status)
}

func (a *API) getTask(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.GetTask(r.Context(), id) }, http.StatusOK)
}

func (a *API) patchTask(w http.ResponseWriter, r *http.Request) {
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) { return a.svc.PatchTask(r.Context(), id, b) }, http.StatusOK)
}

func (a *API) deleteTask(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) {
		archived, err := a.svc.DeleteTask(r.Context(), id)
		return map[string]bool{"archived": archived}, err
	}, http.StatusOK)
}

func (a *API) matchPreview(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.MatchPreview(r.Context(), id) }, http.StatusOK)
}
