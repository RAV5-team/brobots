// Package handlers exposes the service over HTTP (REST, JSON, RFC 7807 errors).
package handlers

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/brobots/api/internal/apispec"
	"github.com/brobots/api/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/swaggest/swgui/v5emb"
)

// API holds the HTTP handlers.
type API struct {
	svc *service.Service
	log *slog.Logger
}

// Options configure the router.
type Options struct {
	Version        string
	SwaggerEnabled bool
}

// NewRouter builds the HTTP router.
func NewRouter(svc *service.Service, log *slog.Logger, opts Options) http.Handler {
	a := &API{svc: svc, log: log}
	r := chi.NewRouter()
	r.Use(middleware.RequestID, a.logRequests, middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": opts.Version})
	})
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if err := svc.Ping(r.Context()); err != nil {
			writeProblem(w, Problem{Type: "about:blank", Title: "База данных недоступна", Status: http.StatusServiceUnavailable})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	r.Get("/api/v1/openapi.yaml", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
		_, _ = w.Write(apispec.Spec)
	})
	if opts.SwaggerEnabled {
		r.Mount("/docs", v5emb.New("RAV5 API", "/api/v1/openapi.yaml", "/docs"))
	}

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/dictionaries", a.dictionaries)
		r.Get("/versions", a.versions)
		r.Get("/dashboard/summary", a.dashboard)

		r.Route("/work-types", func(r chi.Router) {
			r.Get("/", a.listWorkTypes)
			r.Post("/", a.createWorkType)
			r.Get("/{id}", a.getWorkType)
			r.Patch("/{id}", a.patchWorkType)
			r.Delete("/{id}", a.hideWorkType)
		})
		r.Route("/data-sources", func(r chi.Router) {
			r.Get("/", a.listSources)
			r.Post("/", a.createSource)
			r.Get("/{id}", a.getSource)
			r.Patch("/{id}", a.patchSource)
			r.Delete("/{id}", a.deleteSource)
		})
		r.Route("/solutions", func(r chi.Router) {
			r.Get("/", a.listSolutions)
			r.Post("/", a.createSolution)
			r.Get("/compare", a.compareSolutions)
			r.Get("/{id}", a.getSolution)
			r.Patch("/{id}", a.patchSolution)
			r.Delete("/{id}", a.hideSolution)
			r.Get("/{id}/capabilities", a.listCapabilities)
			r.Put("/{id}/capabilities", a.replaceCapabilities)
			r.Post("/{id}/capabilities", a.addCapability)
			r.Patch("/{id}/capabilities/{capId}", a.patchCapability)
			r.Delete("/{id}/capabilities/{capId}", a.hideCapability)
		})
		r.Route("/processes", func(r chi.Router) {
			r.Get("/", a.listProcesses)
			r.Post("/", a.createProcess)
			r.Get("/{id}", a.getProcess)
			r.Patch("/{id}", a.patchProcess)
			r.Delete("/{id}", a.hideProcess)
			r.Get("/{id}/robots", a.processRobots)
			r.Post("/{id}/duplicate", a.duplicateProcess)
		})
		r.Get("/facility-types/{code}/parameters", a.facilityParameters)
		r.Route("/locations", func(r chi.Router) {
			r.Get("/", a.listLocations)
			r.Post("/", a.createLocation)
			r.Get("/templates", a.locationTemplates)
			r.Post("/from-template", a.createLocationFromTemplate)
			r.Get("/{id}", a.getLocation)
			r.Patch("/{id}", a.patchLocation)
			r.Delete("/{id}", a.deleteLocation)
			r.Get("/{id}/parameters", a.locationParameters)
			r.Put("/{id}/parameters", a.putLocationParameters)
			r.Put("/{id}/staff-groups", a.putStaffGroups)
			r.Get("/{id}/tasks", a.listLocationTasks)
			r.Post("/{id}/tasks", a.createTask)
		})
		r.Route("/tasks", func(r chi.Router) {
			r.Get("/{id}", a.getTask)
			r.Patch("/{id}", a.patchTask)
			r.Delete("/{id}", a.deleteTask)
			r.Get("/{id}/match-preview", a.matchPreview)
		})
		r.Route("/projects", func(r chi.Router) {
			r.Get("/", a.listProjects)
			r.Post("/", a.createProject)
			r.Get("/{id}", a.getProject)
			r.Patch("/{id}", a.patchProject)
			r.Delete("/{id}", a.deleteProject)
			r.Post("/{id}/copy", a.copyProject)
			r.Post("/{id}/refresh-snapshot", a.refreshSnapshot)
			r.Get("/{id}/snapshot", a.snapshot)
			r.Get("/{id}/conditions", a.conditions)
			r.Put("/{id}/conditions", a.putConditions)
			r.Delete("/{id}/conditions", a.resetConditions)
			r.Post("/{id}/matching-runs", a.runMatching)
			r.Get("/{id}/matching-runs/latest", a.latestRun)
			r.Get("/{id}/manual-candidates", a.manualCandidates)
			r.Post("/{id}/manual-candidates", a.addManualCandidate)
			r.Delete("/{id}/manual-candidates/{solutionId}", a.removeManualCandidate)
			r.Put("/{id}/selection", a.putSelection)
			r.Get("/{id}/evaluation-context", a.evaluationContext)
		})
		r.Get("/matching-runs/{id}", a.getRun)
	})
	return r
}

func (a *API) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		a.log.InfoContext(r.Context(), "http",
			slog.String("method", r.Method), slog.String("path", r.URL.Path), slog.Int("status", ww.Status()),
			slog.Duration("duration", time.Since(start)), slog.String("request_id", middleware.GetReqID(r.Context())))
	})
}
