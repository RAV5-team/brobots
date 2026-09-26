package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
)

type ctxKey struct{}

type trackKey struct{}

// FromContext returns the caller of the request; ok is false for a guest.
func FromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(ctxKey{}).(Principal)
	return p, ok
}

// Tracker lets an outer middleware (the access log) see the principal set further in.
type Tracker struct{ p *Principal }

// Subject returns the caller's sub, or "" for a guest or a rejected request.
func (t *Tracker) Subject() string {
	if t.p == nil {
		return ""
	}
	return t.p.Subject
}

// Track returns a context that records the principal authenticated within it.
func Track(ctx context.Context) (context.Context, *Tracker) {
	t := &Tracker{}
	return context.WithValue(ctx, trackKey{}, t), t
}

// Middleware authenticates requests and checks roles.
type Middleware struct{ verifier *Verifier }

// NewMiddleware wraps a verifier.
func NewMiddleware(v *Verifier) *Middleware { return &Middleware{verifier: v} }

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	if status == http.StatusUnauthorized {
		w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorBody{Code: code, Message: message})
}

func unauthorized(w http.ResponseWriter) {
	writeError(w, http.StatusUnauthorized, "unauthorized", "Требуется вход в систему. Войдите заново и повторите действие.")
}

func forbidden(w http.ResponseWriter) {
	writeError(w, http.StatusForbidden, "forbidden", "Недостаточно прав. Обратитесь к администратору платформы.")
}

// Authenticate lets a guest (no Authorization header) through and puts a verified user into
// the context. A header that is present must carry a valid token (401), and a service token on
// user routes is 403.
func (m *Middleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if header == "" {
			next.ServeHTTP(w, r)
			return
		}
		scheme, raw, found := strings.Cut(header, " ")
		raw = strings.TrimSpace(raw)
		if !found || !strings.EqualFold(scheme, "Bearer") || raw == "" {
			unauthorized(w)
			return
		}
		p, err := m.verifier.Verify(r.Context(), raw)
		if err != nil {
			unauthorized(w)
			return
		}
		if p.IsService {
			forbidden(w)
			return
		}
		if t, ok := r.Context().Value(trackKey{}).(*Tracker); ok {
			t.p = &p
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, p)))
	})
}

// RequireUser admits only an authenticated user; it runs after Authenticate.
func RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := FromContext(r.Context()); !ok {
			unauthorized(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireRole admits only a user with the realm role; it runs after Authenticate.
func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p, ok := FromContext(r.Context())
			if !ok {
				unauthorized(w)
				return
			}
			if !p.HasRole(role) {
				forbidden(w)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
