package handlers

import (
	"net/http"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/service"
	"github.com/google/uuid"
)

func (a *API) respond(w http.ResponseWriter, r *http.Request, status int, v any, err error) {
	if err != nil {
		a.fail(w, r, err)
		return
	}
	if status == http.StatusNoContent {
		w.WriteHeader(status)
		return
	}
	writeJSON(w, status, v)
}

func (a *API) withBody(w http.ResponseWriter, r *http.Request, fn func([]byte) (any, error), status int) {
	body, ok := readBody(w, r)
	if !ok {
		return
	}
	v, err := fn(body)
	a.respond(w, r, status, v, err)
}

func (a *API) withID(w http.ResponseWriter, r *http.Request, fn func(uuid.UUID) (any, error), status int) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	v, err := fn(id)
	a.respond(w, r, status, v, err)
}

func (a *API) withIDBody(w http.ResponseWriter, r *http.Request, fn func(uuid.UUID, []byte) (any, error), status int) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	body, ok := readBody(w, r)
	if !ok {
		return
	}
	v, err := fn(id, body)
	a.respond(w, r, status, v, err)
}

func (a *API) dictionaries(w http.ResponseWriter, r *http.Request) {
	v, err := a.svc.Dictionaries(r.Context())
	a.respond(w, r, http.StatusOK, v, err)
}

func (a *API) versions(w http.ResponseWriter, r *http.Request) {
	v, err := a.svc.Versions(r.Context())
	a.respond(w, r, http.StatusOK, map[string]any{"items": v}, err)
}

func (a *API) dashboard(w http.ResponseWriter, r *http.Request) {
	v, err := a.svc.Dashboard(r.Context())
	a.respond(w, r, http.StatusOK, v, err)
}

func (a *API) listWorkTypes(w http.ResponseWriter, r *http.Request) {
	hidden, ok := queryBool(w, r, "includeHidden")
	if !ok {
		return
	}
	v, err := a.svc.ListWorkTypes(r.Context(), domain.Deref(hidden))
	a.respond(w, r, http.StatusOK, map[string]any{"items": v}, err)
}

func (a *API) createWorkType(w http.ResponseWriter, r *http.Request) {
	a.withBody(w, r, func(b []byte) (any, error) { return a.svc.CreateWorkType(r.Context(), b) }, http.StatusCreated)
}

func (a *API) getWorkType(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.GetWorkType(r.Context(), id) }, http.StatusOK)
}

func (a *API) patchWorkType(w http.ResponseWriter, r *http.Request) {
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) { return a.svc.PatchWorkType(r.Context(), id, b) }, http.StatusOK)
}

func (a *API) hideWorkType(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return nil, a.svc.HideWorkType(r.Context(), id) }, http.StatusNoContent)
}

func (a *API) listSources(w http.ResponseWriter, r *http.Request) {
	v, err := a.svc.ListSources(r.Context())
	a.respond(w, r, http.StatusOK, map[string]any{"items": v}, err)
}

func (a *API) createSource(w http.ResponseWriter, r *http.Request) {
	a.withBody(w, r, func(b []byte) (any, error) { return a.svc.CreateSource(r.Context(), b) }, http.StatusCreated)
}

func (a *API) getSource(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.GetSource(r.Context(), id) }, http.StatusOK)
}

func (a *API) patchSource(w http.ResponseWriter, r *http.Request) {
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) { return a.svc.PatchSource(r.Context(), id, b) }, http.StatusOK)
}

func (a *API) deleteSource(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return nil, a.svc.DeleteSource(r.Context(), id) }, http.StatusNoContent)
}

func (a *API) listSolutions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := service.SolutionQuery{Kind: q.Get("kind"), Q: q.Get("q"), FacilityType: q.Get("facilityType"),
		PriceBand: q.Get("priceBand"), CostType: q.Get("costType"), Sort: q.Get("sort"),
		Industries: queryList(r, "industry"), Statuses: queryList(r, "status"), SpecsConfirmed: queryList(r, "specsConfirmed")}
	var ok bool
	if f.WorkTypeIDs, ok = queryUUIDs(w, r, "workTypeId"); !ok {
		return
	}
	if f.TrlMin, ok = queryInt(w, r, "trlMin"); !ok {
		return
	}
	if f.HasCapabilities, ok = queryBool(w, r, "hasCapabilities"); !ok {
		return
	}
	hidden, ok := queryBool(w, r, "includeHidden")
	if !ok {
		return
	}
	f.IncludeHidden = domain.Deref(hidden)
	if f.Limit, f.Offset, ok = pageParams(w, r); !ok {
		return
	}
	v, err := a.svc.ListSolutions(r.Context(), f)
	a.respond(w, r, http.StatusOK, v, err)
}

func (a *API) compareSolutions(w http.ResponseWriter, r *http.Request) {
	ids, ok := queryUUIDs(w, r, "ids")
	if !ok {
		return
	}
	v, err := a.svc.CompareSolutions(r.Context(), ids)
	a.respond(w, r, http.StatusOK, v, err)
}

func (a *API) createSolution(w http.ResponseWriter, r *http.Request) {
	a.withBody(w, r, func(b []byte) (any, error) { return a.svc.CreateSolution(r.Context(), b) }, http.StatusCreated)
}

func (a *API) getSolution(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.GetSolution(r.Context(), id) }, http.StatusOK)
}

func (a *API) patchSolution(w http.ResponseWriter, r *http.Request) {
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) { return a.svc.PatchSolution(r.Context(), id, b) }, http.StatusOK)
}

func (a *API) hideSolution(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return nil, a.svc.HideSolution(r.Context(), id) }, http.StatusNoContent)
}

func (a *API) listCapabilities(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) {
		v, err := a.svc.ListCapabilities(r.Context(), id)
		return map[string]any{"items": v}, err
	}, http.StatusOK)
}

func (a *API) replaceCapabilities(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		WorkTypeIDs []uuid.UUID `json:"workTypeIds"`
	}
	if !decodeInto(a, w, r, &in) {
		return
	}
	if in.WorkTypeIDs == nil {
		in.WorkTypeIDs = []uuid.UUID{}
	}
	v, err := a.svc.ReplaceCapabilities(r.Context(), id, in.WorkTypeIDs)
	a.respond(w, r, http.StatusOK, map[string]any{"items": v}, err)
}

func (a *API) addCapability(w http.ResponseWriter, r *http.Request) {
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) { return a.svc.AddCapability(r.Context(), id, b) }, http.StatusCreated)
}

func (a *API) patchCapability(w http.ResponseWriter, r *http.Request) {
	capID, ok := pathID(w, r, "capId")
	if !ok {
		return
	}
	a.withIDBody(w, r, func(id uuid.UUID, b []byte) (any, error) { return a.svc.PatchCapability(r.Context(), id, capID, b) }, http.StatusOK)
}

func (a *API) hideCapability(w http.ResponseWriter, r *http.Request) {
	capID, ok := pathID(w, r, "capId")
	if !ok {
		return
	}
	a.withID(w, r, func(id uuid.UUID) (any, error) { return nil, a.svc.HideCapability(r.Context(), id, capID) }, http.StatusNoContent)
}
