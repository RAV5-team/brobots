package main

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/brobots/api/internal/apispec"
	"github.com/brobots/api/internal/auth"
	"github.com/brobots/api/internal/auth/authtest"
	"github.com/brobots/api/internal/handlers"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/go-chi/chi/v5"
)

// TestRoutesMatchOperations keeps the router and the contract in sync.
func TestRoutesMatchOperations(t *testing.T) {
	router, ok := newRouter(t, authtest.New(t)).(chi.Routes)
	if !ok {
		t.Fatal("router is not chi.Routes")
	}
	routes := map[string]bool{}
	err := chi.Walk(router, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		route = strings.TrimSuffix(route, "/")
		if strings.HasPrefix(route, "/docs") || route == "/api/v1/openapi.yaml" {
			return nil
		}
		routes[method+" "+route] = true
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	ops := map[string]bool{}
	for _, o := range Operations() {
		ops[o.method+" "+o.path] = true
	}
	var missing, extra []string
	for r := range routes {
		if !ops[r] {
			missing = append(missing, r)
		}
	}
	for o := range ops {
		if !routes[o] {
			extra = append(extra, o)
		}
	}
	sort.Strings(missing)
	sort.Strings(extra)
	if len(missing) > 0 {
		t.Errorf("routes without contract: %v", missing)
	}
	if len(extra) > 0 {
		t.Errorf("contract operations without route: %v", extra)
	}
}

func newRouter(t *testing.T, iss *authtest.Issuer) http.Handler {
	t.Helper()
	return handlers.NewRouter(nil, slog.New(slog.DiscardHandler), handlers.Options{Auth: iss.Middleware(t)})
}

// TestRouterEnforcesAccess keeps the router guards and the documented access in sync: every
// operation is called without a token and with user, admin and service tokens.
func TestRouterEnforcesAccess(t *testing.T) {
	iss := authtest.New(t)
	router := newRouter(t, iss)
	tokens := map[string]string{
		"guest":   "",
		"user":    iss.User(t, "alice", auth.RoleUser),
		"admin":   iss.User(t, "root", auth.RoleUser, auth.RoleAdmin),
		"service": iss.Service(t),
	}
	// Handlers run with a nil service and may fail; only the auth statuses matter here.
	want := map[Access]map[string]int{
		Public: {},
		Guest:  {"service": 403},
		User:   {"guest": 401, "service": 403},
		Admin:  {"guest": 401, "user": 403, "service": 403},
	}
	id := "00000000-0000-0000-0000-000000000001"
	for _, o := range Operations() {
		path := strings.NewReplacer("{id}", id, "{capId}", id, "{solutionId}", id, "{code}", "warehouse").Replace(o.path)
		access := AccessOf(o.method, o.path)
		for who, token := range tokens {
			status := call(router, o.method, path, token)
			expected, denied := want[access][who]
			if denied && status != expected {
				t.Errorf("%s %s as %s: status %d, want %d", o.method, o.path, who, status, expected)
			}
			if !denied && (status == 401 || status == 403) {
				t.Errorf("%s %s as %s: status %d, want access", o.method, o.path, who, status)
			}
		}
	}
}

func call(h http.Handler, method, path, token string) (status int) {
	req, _ := http.NewRequest(method, path, strings.NewReader("{}"))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := &statusRecorder{header: http.Header{}}
	defer func() {
		if recover() != nil { // nil service: the request passed the guards
			status = http.StatusInternalServerError
		}
	}()
	h.ServeHTTP(rec, req)
	return rec.status
}

type statusRecorder struct {
	header http.Header
	status int
}

func (r *statusRecorder) Header() http.Header { return r.header }
func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	return len(b), nil
}
func (r *statusRecorder) WriteHeader(code int) {
	if r.status == 0 {
		r.status = code
	}
}

// TestEmbeddedSpecIsCurrent fails when the committed contract is stale: run go generate ./...
func TestEmbeddedSpecIsCurrent(t *testing.T) {
	spec, err := Build()
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(bytes.ReplaceAll(apispec.Spec, []byte("\r\n"), []byte("\n")), spec) {
		t.Fatal("internal/apispec/openapi.yaml is stale: run `go generate ./...` in services/api")
	}
	if shared, err := os.ReadFile("../../../../packages/contracts/openapi/api.yaml"); err == nil {
		if !bytes.Equal(bytes.ReplaceAll(shared, []byte("\r\n"), []byte("\n")), spec) {
			t.Fatal("packages/contracts/openapi/api.yaml is stale: run `go generate ./...` in services/api")
		}
	}
}

func TestSpecIsValid(t *testing.T) {
	doc, err := openapi3.NewLoader().LoadFromData(apispec.Spec)
	if err != nil {
		t.Fatal(err)
	}
	if err := doc.Validate(context.Background()); err != nil {
		t.Fatal(err)
	}
}
