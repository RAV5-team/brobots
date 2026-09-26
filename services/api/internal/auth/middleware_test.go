package auth_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/brobots/api/internal/auth"
	"github.com/brobots/api/internal/auth/authtest"
)

// echo answers 200 with the caller's sub, or "guest".
var echo = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	sub := "guest"
	if p, ok := auth.FromContext(r.Context()); ok {
		sub = p.Subject
	}
	_, _ = w.Write([]byte(sub))
})

func serve(h http.Handler, header string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if header != "" {
		req.Header.Set("Authorization", header)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestMiddlewareAccess(t *testing.T) {
	iss := authtest.New(t)
	mw := iss.Middleware(t)
	user := "Bearer " + iss.User(t, "alice", auth.RoleUser)
	admin := "Bearer " + iss.User(t, "root", auth.RoleUser, auth.RoleAdmin)
	service := "Bearer " + iss.Service(t)

	guest := mw.Authenticate(echo)
	onlyUser := mw.Authenticate(auth.RequireUser(echo))
	onlyAdmin := mw.Authenticate(auth.RequireRole(auth.RoleAdmin)(echo))

	cases := []struct {
		name   string
		h      http.Handler
		header string
		status int
		body   string
	}{
		{"guest route without token", guest, "", 200, "guest"},
		{"guest route with user", guest, user, 200, "alice"},
		{"guest route with invalid token", guest, "Bearer garbage", 401, ""},
		{"guest route with Basic auth", guest, "Basic YTpi", 401, ""},
		{"guest route with empty Bearer", guest, "Bearer ", 401, ""},
		{"guest route with service token", guest, service, 403, ""},
		{"lowercase scheme", guest, "bearer " + iss.User(t, "bob", auth.RoleUser), 200, "bob"},
		{"user route without token", onlyUser, "", 401, ""},
		{"user route with user", onlyUser, user, 200, "alice"},
		{"user route with service token", onlyUser, service, 403, ""},
		{"admin route without token", onlyAdmin, "", 401, ""},
		{"admin route with user", onlyAdmin, user, 403, ""},
		{"admin route with admin", onlyAdmin, admin, 200, "root"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := serve(c.h, c.header)
			if rec.Code != c.status {
				t.Fatalf("status = %d, want %d: %s", rec.Code, c.status, rec.Body)
			}
			if c.body != "" && rec.Body.String() != c.body {
				t.Fatalf("body = %q, want %q", rec.Body, c.body)
			}
		})
	}
}

func TestErrorResponses(t *testing.T) {
	iss := authtest.New(t)
	mw := iss.Middleware(t)
	cases := []struct {
		status int
		header string
		code   string
		auth   string
	}{
		{401, "Bearer garbage", "unauthorized", `Bearer error="invalid_token"`},
		{403, "Bearer " + iss.User(t, "alice", auth.RoleUser), "forbidden", ""},
	}
	for _, c := range cases {
		rec := serve(mw.Authenticate(auth.RequireRole(auth.RoleAdmin)(echo)), c.header)
		var body struct{ Code, Message string }
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if rec.Code != c.status || body.Code != c.code || body.Message == "" {
			t.Fatalf("%d %+v", rec.Code, body)
		}
		if got := rec.Header().Get("WWW-Authenticate"); got != c.auth {
			t.Fatalf("WWW-Authenticate = %q, want %q", got, c.auth)
		}
		if ct := rec.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
			t.Fatalf("Content-Type = %q", ct)
		}
	}
}

func TestTrackerSeesAuthenticatedSubject(t *testing.T) {
	iss := authtest.New(t)
	mw := iss.Middleware(t)
	for header, want := range map[string]string{
		"":                               "",
		"Bearer " + iss.User(t, "alice"): "alice",
		"Bearer garbage":                 "",
	} {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		if header != "" {
			req.Header.Set("Authorization", header)
		}
		ctx, tr := auth.Track(req.Context())
		mw.Authenticate(echo).ServeHTTP(httptest.NewRecorder(), req.WithContext(ctx))
		if got := tr.Subject(); got != want {
			t.Fatalf("header %q: subject = %q, want %q", header, got, want)
		}
	}
}
