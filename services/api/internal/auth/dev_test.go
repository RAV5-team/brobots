// TODO(dev-auth): удалить вместе с dev-режимом.
package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/brobots/api/internal/auth"
	"github.com/brobots/api/internal/auth/authtest"
)

const devSub = "11111111-1111-4111-8111-111111111111"

func devServe(h http.Handler, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestDevModeActsAsTheDevUser(t *testing.T) {
	iss := authtest.New(t)
	dev, err := auth.NewDevIdentity(devSub, []string{auth.RoleUser, auth.RoleAdmin})
	if err != nil {
		t.Fatal(err)
	}
	withKeys := auth.NewDevMiddleware(auth.NewVerifier(authtest.IssuerURL, authtest.Audience, iss.KeySet(t)), dev)
	withoutKeys := auth.NewDevMiddleware(nil, dev)
	other := "22222222-2222-4222-8222-222222222222"
	admin := withKeys.Authenticate(auth.RequireRole(auth.RoleAdmin)(echo))

	cases := []struct {
		name    string
		h       http.Handler
		headers map[string]string
		status  int
		body    string
	}{
		{"no token is the dev user", admin, nil, 200, devSub},
		{"X-Dev-User switches the user", admin, map[string]string{auth.DevUserHeader: other}, 200, other},
		{"X-Dev-User must be a UUID", admin, map[string]string{auth.DevUserHeader: "bob"}, 401, ""},
		{"a real token still works", withKeys.Authenticate(echo), map[string]string{"Authorization": "Bearer " + iss.User(t, "alice")}, 200, alice},
		{"an invalid token is still 401", admin, map[string]string{"Authorization": "Bearer garbage"}, 401, ""},
		{"without Keycloak a token is 401", withoutKeys.Authenticate(echo), map[string]string{"Authorization": "Bearer " + iss.User(t, "alice")}, 401, ""},
		{"without Keycloak no token is the dev user", withoutKeys.Authenticate(echo), nil, 200, devSub},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := devServe(c.h, c.headers)
			if rec.Code != c.status || (c.body != "" && rec.Body.String() != c.body) {
				t.Fatalf("%d %q, want %d %q", rec.Code, rec.Body, c.status, c.body)
			}
		})
	}
}

func TestDevHeaderIsIgnoredOutsideDevMode(t *testing.T) {
	iss := authtest.New(t)

	rec := devServe(iss.Middleware(t).Authenticate(auth.RequireUser(echo)), map[string]string{auth.DevUserHeader: devSub})

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401: X-Dev-User must not sign in", rec.Code)
	}
}

func TestDevIdentityNeedsUUID(t *testing.T) {
	if _, err := auth.NewDevIdentity("dev", nil); err == nil {
		t.Fatal("non-UUID AUTH_DEV_SUB must be rejected")
	}
}
