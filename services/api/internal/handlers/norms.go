package handlers

import (
	"net/http"

	"github.com/google/uuid"
)

func (a *API) currentNorms(w http.ResponseWriter, r *http.Request) {
	v, err := a.svc.CurrentNorms(r.Context())
	a.respond(w, r, http.StatusOK, v, err)
}

func (a *API) listNormSets(w http.ResponseWriter, r *http.Request) {
	v, err := a.svc.ListNormSets(r.Context())
	a.respond(w, r, http.StatusOK, map[string]any{"items": v}, err)
}

func (a *API) getNormSet(w http.ResponseWriter, r *http.Request) {
	a.withID(w, r, func(id uuid.UUID) (any, error) { return a.svc.GetNormSet(r.Context(), id) }, http.StatusOK)
}

func (a *API) createNormSet(w http.ResponseWriter, r *http.Request) {
	a.withBody(w, r, func(b []byte) (any, error) { return a.svc.CreateNormSet(r.Context(), b) }, http.StatusCreated)
}
