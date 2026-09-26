// Package authtest issues Keycloak-like access tokens for tests: an RSA key, a JWKS server and
// a signer. Production code must not import it.
package authtest

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/brobots/api/internal/auth"
	"github.com/go-jose/go-jose/v4"
)

// Defaults of the issued tokens: the local realm and the api audience.
const (
	IssuerURL = "http://localhost/auth/realms/rav5"
	Audience  = "rav5-api"
	KeyID     = "test-key"
)

// Issuer signs tokens and serves their JWKS.
type Issuer struct {
	Key     *rsa.PrivateKey
	KeyID   string
	Server  *httptest.Server
	fetches atomic.Int32
}

// New starts a JWKS server with a fresh RSA key; it stops with the test.
func New(t testing.TB) *Issuer {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	i := &Issuer{Key: key, KeyID: KeyID}
	i.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		i.fetches.Add(1)
		set := jose.JSONWebKeySet{Keys: []jose.JSONWebKey{
			{Key: &i.Key.PublicKey, KeyID: i.KeyID, Algorithm: "RS256", Use: "sig"},
		}}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(set)
	}))
	t.Cleanup(i.Server.Close)
	return i
}

// Fetches counts JWKS requests served.
func (i *Issuer) Fetches() int { return int(i.fetches.Load()) }

// KeySet returns a key set over the JWKS server, already loaded.
func (i *Issuer) KeySet(t testing.TB) *auth.KeySet {
	t.Helper()
	keys := auth.NewKeySet(i.Server.URL)
	if err := keys.Refresh(context.Background()); err != nil {
		t.Fatal(err)
	}
	return keys
}

// Middleware returns the auth middleware for IssuerURL and Audience over this issuer.
func (i *Issuer) Middleware(t testing.TB) *auth.Middleware {
	t.Helper()
	return auth.NewMiddleware(auth.NewVerifier(IssuerURL, Audience, i.KeySet(t)))
}

// Claims of a valid user access token for Audience; override or delete keys as needed.
func Claims(sub string, roles ...string) map[string]any {
	now := time.Now().Unix()
	return map[string]any{
		"iss": IssuerURL, "aud": []string{Audience, "account"}, "sub": sub, "typ": "Bearer",
		"azp": "rav5-web", "iat": now, "exp": now + 300, "email": sub + "@example.com",
		"realm_access": map[string]any{"roles": roles},
	}
}

// Sign signs claims with RS256 and the issuer key.
func (i *Issuer) Sign(t testing.TB, claims map[string]any) string {
	t.Helper()
	return i.SignWith(t, i.Key, i.KeyID, claims)
}

// SignWith signs claims with RS256 by any key and kid.
func (i *Issuer) SignWith(t testing.TB, key *rsa.PrivateKey, kid string, claims map[string]any) string {
	t.Helper()
	payload, err := json.Marshal(claims)
	if err != nil {
		t.Fatal(err)
	}
	opts := (&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", kid)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key}, opts)
	if err != nil {
		t.Fatal(err)
	}
	jws, err := signer.Sign(payload)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := jws.CompactSerialize()
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// User returns a valid user token with the roles.
func (i *Issuer) User(t testing.TB, sub string, roles ...string) string {
	t.Helper()
	return i.Sign(t, Claims(sub, roles...))
}

// Service returns a valid client-credentials token of rav5-api-internal that has Audience.
func (i *Issuer) Service(t testing.TB) string {
	t.Helper()
	c := Claims("service-account-rav5-api-internal", auth.RoleService)
	c["azp"] = "rav5-api-internal"
	return i.Sign(t, c)
}
