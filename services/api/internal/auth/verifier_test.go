package auth_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/brobots/api/internal/auth"
	"github.com/brobots/api/internal/auth/authtest"
)

func newVerifier(t *testing.T, iss *authtest.Issuer) *auth.Verifier {
	t.Helper()
	return auth.NewVerifier(authtest.IssuerURL, authtest.Audience, iss.KeySet(t))
}

func b64(v any) string {
	b, _ := json.Marshal(v)
	return base64.RawURLEncoding.EncodeToString(b)
}

func TestVerifyAcceptsAccessToken(t *testing.T) {
	iss := authtest.New(t)
	v := newVerifier(t, iss)

	p, err := v.Verify(context.Background(), iss.User(t, "alice", auth.RoleUser, auth.RoleAdmin))

	if err != nil {
		t.Fatal(err)
	}
	if p.Subject != authtest.SubOf("alice") || p.Email != "alice@example.com" || p.AZP != "rav5-web" || p.IsService {
		t.Fatalf("principal = %+v", p)
	}
	if !p.HasRole(auth.RoleAdmin) || p.HasRole(auth.RoleService) {
		t.Fatalf("roles = %v", p.Roles)
	}
}

func TestVerifyMarksServiceToken(t *testing.T) {
	iss := authtest.New(t)

	p, err := newVerifier(t, iss).Verify(context.Background(), iss.Service(t))

	if err != nil || !p.IsService || p.AZP != "rav5-api-internal" {
		t.Fatalf("principal = %+v, err = %v", p, err)
	}
}

func TestVerifyRejects(t *testing.T) {
	iss := authtest.New(t)
	other, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().Unix()
	with := func(key string, value any) string {
		c := authtest.Claims("alice", auth.RoleUser)
		if value == nil {
			delete(c, key)
		} else {
			c[key] = value
		}
		return iss.Sign(t, c)
	}
	valid := iss.User(t, "alice", auth.RoleUser)
	parts := strings.Split(valid, ".")
	claims := authtest.Claims("alice", auth.RoleUser)

	cases := map[string]string{
		"alg none":           b64(map[string]string{"alg": "none", "kid": authtest.KeyID}) + "." + parts[1] + ".",
		"alg HS256":          b64(map[string]string{"alg": "HS256", "kid": authtest.KeyID}) + "." + parts[1] + "." + parts[2],
		"tampered signature": parts[0] + "." + parts[1] + "." + strings.Repeat("A", len(parts[2])),
		"tampered payload":   parts[0] + "." + b64(authtest.Claims("mallory", auth.RoleAdmin)) + "." + parts[2],
		"foreign key":        iss.SignWith(t, other, authtest.KeyID, claims),
		"expired 40s ago":    with("exp", now-40),
		"other issuer":       with("iss", "http://evil/auth/realms/rav5"),
		"issuer with slash":  with("iss", authtest.IssuerURL+"/"),
		"no api audience":    with("aud", []string{"rav5-sim", "account"}),
		"ID token":           with("typ", "ID"),
		"refresh token":      with("typ", "Refresh"),
		"no sub":             with("sub", nil),
		"sub not a UUID":     with("sub", "alice"),
		"no exp":             with("exp", nil),
		"nbf in 2 minutes":   with("nbf", now+120),
		"not a JWT":          "garbage",
	}
	v := newVerifier(t, iss)
	for name, raw := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := v.Verify(context.Background(), raw); !errors.Is(err, auth.ErrInvalidToken) {
				t.Fatalf("err = %v, want ErrInvalidToken", err)
			}
		})
	}
}

func TestVerifyToleratesClockSkew(t *testing.T) {
	iss := authtest.New(t)
	now := time.Now().Unix()
	for name, claim := range map[string][2]any{"expired 10s ago": {"exp", now - 10}, "nbf in 10s": {"nbf", now + 10}} {
		c := authtest.Claims("alice", auth.RoleUser)
		c[claim[0].(string)] = claim[1]
		if _, err := newVerifier(t, iss).Verify(context.Background(), iss.Sign(t, c)); err != nil {
			t.Fatalf("%s must pass: %v", name, err)
		}
	}
}

func TestUnknownKidReloadsJWKSAtMostEvery30s(t *testing.T) {
	iss := authtest.New(t)
	keys := iss.KeySet(t) // fetch #1
	now := time.Now()
	var mu sync.Mutex
	auth.SetNow(keys, func() time.Time { mu.Lock(); defer mu.Unlock(); return now })
	v := auth.NewVerifier(authtest.IssuerURL, authtest.Audience, keys)
	unknown := iss.SignWith(t, iss.Key, "rotated", authtest.Claims("alice", auth.RoleUser))

	for range 5 {
		_, _ = v.Verify(context.Background(), unknown)
	}
	if got := iss.Fetches(); got != 1 {
		t.Fatalf("JWKS fetched %d times within 30s, want 1", got)
	}

	mu.Lock()
	now = now.Add(auth.MinRefreshInterval)
	mu.Unlock()
	for range 5 {
		_, _ = v.Verify(context.Background(), unknown)
	}
	if got := iss.Fetches(); got != 2 {
		t.Fatalf("JWKS fetched %d times after 30s, want 2", got)
	}
}

func TestRotatedKeyIsPickedUp(t *testing.T) {
	iss := authtest.New(t)
	keys := iss.KeySet(t)
	auth.SetNow(keys, func() time.Time { return time.Now().Add(auth.MinRefreshInterval) })
	v := auth.NewVerifier(authtest.IssuerURL, authtest.Audience, keys)
	rotated, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	iss.Key, iss.KeyID = rotated, "rotated"

	if _, err := v.Verify(context.Background(), iss.User(t, "alice", auth.RoleUser)); err != nil {
		t.Fatalf("token signed by the rotated key: %v", err)
	}
}

func TestKeySetReadiness(t *testing.T) {
	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer failing.Close()
	keys := auth.NewKeySet(failing.URL)

	if err := keys.Refresh(context.Background()); err == nil || keys.Ready() {
		t.Fatalf("err = %v, ready = %v", err, keys.Ready())
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	var failures int
	keys.RefreshUntilReady(ctx, 5*time.Millisecond, func(error) { failures++ })
	if keys.Ready() || failures < 2 {
		t.Fatalf("ready = %v after %d failures", keys.Ready(), failures)
	}

	iss := authtest.New(t)
	keys = auth.NewKeySet(iss.Server.URL)
	keys.RefreshUntilReady(context.Background(), time.Millisecond, nil)
	if !keys.Ready() {
		t.Fatal("key set not ready after a successful fetch")
	}
}

func TestKeySetSkipsEncryptionKeys(t *testing.T) {
	iss := authtest.New(t)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"keys":[{"kty":"RSA","kid":"enc","use":"enc","n":"` +
			base64.RawURLEncoding.EncodeToString(iss.Key.N.Bytes()) + `","e":"AQAB"}]}`))
	}))
	defer srv.Close()

	if err := auth.NewKeySet(srv.URL).Refresh(context.Background()); err == nil {
		t.Fatal("a JWKS with only an encryption key must not be accepted")
	}
}
