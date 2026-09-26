// Package auth verifies Keycloak access tokens (realm rav5) and guards routes by role.
//
// Verification is local, against the realm JWKS: Keycloak is not called per request.
// Rules and settings: docs/keycloak/middleware.md.
package auth

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-jose/go-jose/v4"
)

// MinRefreshInterval limits JWKS reloads on an unknown kid: random kids must not DoS Keycloak.
const MinRefreshInterval = 30 * time.Second

// KeySet caches the realm signing keys and implements oidc.KeySet.
type KeySet struct {
	url    string
	client *http.Client
	now    func() time.Time

	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	lastFetch time.Time

	fetchMu sync.Mutex
	ready   atomic.Bool
}

// NewKeySet returns an empty key set for the JWKS at url; call Refresh before use.
func NewKeySet(url string) *KeySet {
	return &KeySet{url: url, client: &http.Client{Timeout: 10 * time.Second}, now: time.Now}
}

// Ready reports whether the keys were loaded at least once (for /readyz).
func (k *KeySet) Ready() bool { return k.ready.Load() }

// Refresh loads the JWKS unconditionally.
func (k *KeySet) Refresh(ctx context.Context) error {
	k.fetchMu.Lock()
	defer k.fetchMu.Unlock()
	return k.fetchLocked(ctx)
}

// RefreshUntilReady retries Refresh every interval until it succeeds or ctx ends.
func (k *KeySet) RefreshUntilReady(ctx context.Context, interval time.Duration, onError func(error)) {
	for {
		err := k.Refresh(ctx)
		if err == nil {
			return
		}
		if onError != nil {
			onError(err)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(interval):
		}
	}
}

func (k *KeySet) fetchLocked(ctx context.Context) error {
	k.mu.Lock()
	k.lastFetch = k.now()
	k.mu.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, k.url, nil)
	if err != nil {
		return err
	}
	resp, err := k.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch JWKS: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch JWKS: status %d", resp.StatusCode)
	}
	var set jose.JSONWebKeySet
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return fmt.Errorf("decode JWKS: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey)
	for _, key := range set.Keys {
		// The Keycloak JWKS also holds an encryption key (use=enc): it is not for signatures.
		if pub, ok := key.Key.(*rsa.PublicKey); ok && key.KeyID != "" && (key.Use == "" || key.Use == "sig") {
			keys[key.KeyID] = pub
		}
	}
	if len(keys) == 0 {
		return errors.New("JWKS has no RSA signing keys")
	}
	k.mu.Lock()
	k.keys = keys
	k.mu.Unlock()
	k.ready.Store(true)
	return nil
}

func (k *KeySet) lookup(kid string) *rsa.PublicKey {
	k.mu.RLock()
	defer k.mu.RUnlock()
	return k.keys[kid]
}

func (k *KeySet) refreshIfStale(ctx context.Context) {
	k.fetchMu.Lock()
	defer k.fetchMu.Unlock()
	k.mu.RLock()
	stale := k.now().Sub(k.lastFetch) >= MinRefreshInterval
	k.mu.RUnlock()
	if stale {
		_ = k.fetchLocked(ctx) // on failure the old keys stay; the token is rejected as unknown kid
	}
}

// VerifySignature implements oidc.KeySet: RS256 only, key by kid.
func (k *KeySet) VerifySignature(ctx context.Context, raw string) ([]byte, error) {
	jws, err := jose.ParseSigned(raw, []jose.SignatureAlgorithm{jose.RS256})
	if err != nil {
		return nil, err
	}
	if len(jws.Signatures) != 1 {
		return nil, errors.New("expected exactly one signature")
	}
	kid := jws.Signatures[0].Header.KeyID
	key := k.lookup(kid)
	if key == nil {
		k.refreshIfStale(ctx)
		key = k.lookup(kid)
	}
	if key == nil {
		return nil, errors.New("unknown kid")
	}
	return jws.Verify(key)
}
