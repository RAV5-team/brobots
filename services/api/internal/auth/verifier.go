package auth

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/google/uuid"
)

// Leeway tolerates clock skew between Keycloak and the service.
const Leeway = 30 * time.Second

// Realm roles (realm-rav5.json).
const (
	RoleUser    = "user"
	RoleAdmin   = "admin"
	RoleService = "service"
)

// ErrInvalidToken wraps every verification failure.
var ErrInvalidToken = errors.New("invalid token")

// Principal is the caller taken from a verified token.
type Principal struct {
	Subject   string
	Email     string
	Roles     []string
	AZP       string
	IsService bool
}

// HasRole reports whether the caller has the realm role.
func (p Principal) HasRole(role string) bool { return slices.Contains(p.Roles, role) }

// Verifier checks access tokens: signature, iss, aud, exp, nbf, sub and typ.
type Verifier struct {
	v   *oidc.IDTokenVerifier
	now func() time.Time
}

// NewVerifier builds a verifier without discovery: the JWKS URL is internal, iss is public.
func NewVerifier(issuer, audience string, keys oidc.KeySet) *Verifier {
	return newVerifier(issuer, audience, keys, time.Now)
}

func newVerifier(issuer, audience string, keys oidc.KeySet, now func() time.Time) *Verifier {
	return &Verifier{now: now, v: oidc.NewVerifier(issuer, keys, &oidc.Config{
		ClientID:             audience, // aud must contain it
		SupportedSigningAlgs: []string{oidc.RS256},
		// go-oidc has no leeway for exp: shift "now" back instead.
		Now: func() time.Time { return now().Add(-Leeway) },
	})}
}

// Verify returns the principal of a valid access token or an error wrapping ErrInvalidToken.
func (v *Verifier) Verify(ctx context.Context, raw string) (Principal, error) {
	tok, err := v.v.Verify(ctx, raw) // signature, iss, aud, exp
	if err != nil {
		return Principal{}, errors.Join(ErrInvalidToken, err)
	}
	var c struct {
		Typ         string   `json:"typ"`
		NotBefore   *float64 `json:"nbf"`
		Email       string   `json:"email"`
		AZP         string   `json:"azp"`
		RealmAccess struct {
			Roles []string `json:"roles"`
		} `json:"realm_access"`
	}
	if err := tok.Claims(&c); err != nil {
		return Principal{}, errors.Join(ErrInvalidToken, err)
	}
	// ID and refresh tokens are signed with the same key but are not access tokens.
	if tok.Subject == "" || c.Typ != "Bearer" {
		return Principal{}, ErrInvalidToken
	}
	// Keycloak subs are UUIDs; data ownership is stored by them.
	if _, err := uuid.Parse(tok.Subject); err != nil {
		return Principal{}, errors.Join(ErrInvalidToken, errors.New("sub is not a UUID"))
	}
	// go-oidc allows nbf 5 minutes ahead; the rule is the same 30 s as for exp.
	if c.NotBefore != nil && time.Unix(int64(*c.NotBefore), 0).After(v.now().Add(Leeway)) {
		return Principal{}, errors.Join(ErrInvalidToken, errors.New("token is not valid yet (nbf)"))
	}
	return Principal{
		Subject: tok.Subject, Email: c.Email, Roles: c.RealmAccess.Roles, AZP: c.AZP,
		IsService: slices.Contains(c.RealmAccess.Roles, RoleService),
	}, nil
}
