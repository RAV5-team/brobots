// Package handlers exposes the service over HTTP (REST, JSON, RFC 7807 errors).
package handlers

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/brobots/api/internal/apispec"
	"github.com/brobots/api/internal/auth"
	"github.com/brobots/api/internal/service"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
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
	// Auth verifies Keycloak access tokens on /api/v1; required.
	Auth *auth.Middleware
	// AuthReady reports whether the Keycloak keys are loaded; nil means ready.
	AuthReady func() bool
}

// NewRouter builds the HTTP router.
//
// Access on /api/v1 (docs/keycloak/middleware.md): reads are open to guests, writes need a
// signed-in user, catalog changes need the admin role. Which records a caller sees and changes
// (own, demo, reference) is decided by the service, see service/access.go. A token that is sent
// must be valid even on guest routes.
func NewRouter(svc *service.Service, log *slog.Logger, opts Options) http.Handler {
	if opts.Auth == nil {
		panic("handlers: Options.Auth is required")
	}
	a := &API{svc: svc, log: log}
	user := auth.RequireUser
	admin := auth.RequireRole(auth.RoleAdmin)
	r := chi.NewRouter()
	r.Use(middleware.RequestID, a.logRequests, middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": opts.Version})
	})
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if opts.AuthReady != nil && !opts.AuthReady() {
			writeProblem(w, Problem{Type: "about:blank", Title: "Ключи Keycloak ещё не загружены", Status: http.StatusServiceUnavailable})
			return
		}
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
		r.Use(opts.Auth.Authenticate, withActor)
		r.Get("/dictionaries", a.dictionaries)
		r.Get("/versions", a.versions)
		r.Get("/dashboard/summary", a.dashboard)
		r.Get("/norms", a.currentNorms)
		r.Route("/norm-sets", func(r chi.Router) {
			r.Get("/", a.listNormSets)
			r.With(admin).Post("/", a.createNormSet)
			r.Get("/{id}", a.getNormSet)
		})

		r.Route("/work-types", func(r chi.Router) {
			r.Get("/", a.listWorkTypes)
			r.With(admin).Post("/", a.createWorkType)
			r.Get("/{id}", a.getWorkType)
			r.With(admin).Patch("/{id}", a.patchWorkType)
			r.With(admin).Delete("/{id}", a.hideWorkType)
		})
		r.Route("/data-sources", func(r chi.Router) {
			r.Get("/", a.listSources)
			r.With(admin).Post("/", a.createSource)
			r.Get("/{id}", a.getSource)
			r.With(admin).Patch("/{id}", a.patchSource)
			r.With(admin).Delete("/{id}", a.deleteSource)
		})
		r.Route("/solutions", func(r chi.Router) {
			r.Get("/", a.listSolutions)
			r.With(admin).Post("/", a.createSolution)
			r.Get("/compare", a.compareSolutions)
			r.Get("/{id}", a.getSolution)
			r.With(admin).Patch("/{id}", a.patchSolution)
			r.With(admin).Delete("/{id}", a.hideSolution)
			r.Get("/{id}/capabilities", a.listCapabilities)
			r.With(admin).Put("/{id}/capabilities", a.replaceCapabilities)
			r.With(admin).Post("/{id}/capabilities", a.addCapability)
			r.With(admin).Patch("/{id}/capabilities/{capId}", a.patchCapability)
			r.With(admin).Delete("/{id}/capabilities/{capId}", a.hideCapability)
		})
		r.Route("/processes", func(r chi.Router) {
			r.Get("/", a.listProcesses)
			r.With(user).Post("/", a.createProcess)
			r.Get("/{id}", a.getProcess)
			// Reference processes need admin, own processes their author: the service decides.
			r.With(user).Patch("/{id}", a.patchProcess)
			r.With(user).Delete("/{id}", a.hideProcess)
			r.Get("/{id}/robots", a.processRobots)
			r.With(user).Post("/{id}/duplicate", a.duplicateProcess)
		})
		r.Get("/facility-types/{code}/parameters", a.facilityParameters)
		r.Route("/locations", func(r chi.Router) {
			r.Get("/", a.listLocations)
			r.With(user).Post("/", a.createLocation)
			r.Get("/templates", a.locationTemplates)
			r.With(user).Post("/from-template", a.createLocationFromTemplate)
			r.Get("/{id}", a.getLocation)
			r.With(user).Patch("/{id}", a.patchLocation)
			r.With(user).Delete("/{id}", a.deleteLocation)
			r.Get("/{id}/parameters", a.locationParameters)
			r.With(user).Put("/{id}/parameters", a.putLocationParameters)
			r.With(user).Put("/{id}/staff-groups", a.putStaffGroups)
			r.Get("/{id}/tasks", a.listLocationTasks)
			r.With(user).Post("/{id}/tasks", a.createTask)
		})
		r.Route("/tasks", func(r chi.Router) {
			r.Get("/{id}", a.getTask)
			r.With(user).Patch("/{id}", a.patchTask)
			r.With(user).Delete("/{id}", a.deleteTask)
			r.Get("/{id}/match-preview", a.matchPreview)
		})
		r.Route("/projects", func(r chi.Router) {
			r.Get("/", a.listProjects)
			r.With(user).Post("/", a.createProject)
			r.Get("/{id}", a.getProject)
			r.With(user).Patch("/{id}", a.patchProject)
			r.With(user).Delete("/{id}", a.deleteProject)
			r.With(user).Post("/{id}/copy", a.copyProject)
			r.With(user).Post("/{id}/refresh-snapshot", a.refreshSnapshot)
			r.Get("/{id}/snapshot", a.snapshot)
			r.Get("/{id}/conditions", a.conditions)
			r.With(user).Put("/{id}/conditions", a.putConditions)
			r.With(user).Delete("/{id}/conditions", a.resetConditions)
			r.With(user).Post("/{id}/matching-runs", a.runMatching)
			r.Get("/{id}/matching-runs/latest", a.latestRun)
			r.Get("/{id}/manual-candidates", a.manualCandidates)
			r.With(user).Post("/{id}/manual-candidates", a.addManualCandidate)
			r.With(user).Delete("/{id}/manual-candidates/{solutionId}", a.removeManualCandidate)
			r.With(user).Post("/{id}/evaluate", a.evaluate)
			r.Get("/{id}/evaluation", a.evaluation)
			r.With(user).Put("/{id}/selection", a.putSelection)
			r.With(user).Post("/{id}/save", a.saveProject)
			r.With(user).Post("/{id}/reopen", a.reopenProject)
			r.With(user).Post("/{id}/quote-request", a.requestQuote)
			r.Get("/{id}/evaluation-context", a.evaluationContext)
		})
		r.Get("/matching-runs/{id}", a.getRun)
	})
	return r
}

// withActor passes the signed-in user to the service, which checks data ownership.
func withActor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, ok := auth.FromContext(r.Context())
		if !ok {
			next.ServeHTTP(w, r)
			return
		}
		id, err := uuid.Parse(p.Subject) // the verifier accepts UUID subs only
		if err != nil {
			http.Error(w, "invalid subject", http.StatusUnauthorized)
			return
		}
		ctx := service.WithActor(r.Context(), service.Actor{UserID: id, Admin: p.HasRole(auth.RoleAdmin)})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (a *API) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		ctx, caller := auth.Track(r.Context())
		next.ServeHTTP(ww, r.WithContext(ctx))
		// The token itself is never logged, only its sub.
		a.log.InfoContext(r.Context(), "http",
			slog.String("method", r.Method), slog.String("path", r.URL.Path), slog.Int("status", ww.Status()),
			slog.Duration("duration", time.Since(start)), slog.String("request_id", middleware.GetReqID(r.Context())),
			slog.String("sub", caller.Subject()))
	})
}
