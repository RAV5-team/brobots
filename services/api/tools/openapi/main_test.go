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
	"github.com/brobots/api/internal/handlers"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/go-chi/chi/v5"
)

// TestRoutesMatchOperations keeps the router and the contract in sync.
func TestRoutesMatchOperations(t *testing.T) {
	router, ok := handlers.NewRouter(nil, slog.New(slog.DiscardHandler), handlers.Options{}).(chi.Routes)
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
