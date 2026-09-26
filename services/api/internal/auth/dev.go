package auth

// TODO(dev-auth): удалить dev-режим, когда ручное тестирование перейдёт на настоящие токены Keycloak.
// Удаляется целиком: этот файл, dev_test.go, поле Middleware.dev, AUTH_DEV_* в config и compose,
// ветки с пометкой TODO(dev-auth).

import (
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

// DevUserHeader switches the dev identity to another user (dev mode only): two users without Keycloak.
const DevUserHeader = "X-Dev-User"

// DevIdentity is the caller of requests without a token in dev mode.
type DevIdentity struct {
	Subject string
	Roles   []string
}

// NewDevIdentity checks the dev user: sub must be a UUID, like a Keycloak sub.
func NewDevIdentity(sub string, roles []string) (DevIdentity, error) {
	if _, err := uuid.Parse(sub); err != nil {
		return DevIdentity{}, errors.New("AUTH_DEV_SUB must be a UUID")
	}
	return DevIdentity{Subject: sub, Roles: roles}, nil
}

// NewDevMiddleware lets requests without a token act as the dev user. verifier may be nil: then
// sent tokens are rejected, since there is nothing to check them with.
//
// TODO(dev-auth): удалить вместе с dev-режимом.
func NewDevMiddleware(v *Verifier, dev DevIdentity) *Middleware {
	return &Middleware{verifier: v, dev: &dev}
}

// devPrincipal is the dev user of a request without a token; X-Dev-User overrides the sub.
func (m *Middleware) devPrincipal(r *http.Request) (Principal, bool) {
	sub := m.dev.Subject
	if h := strings.TrimSpace(r.Header.Get(DevUserHeader)); h != "" {
		if _, err := uuid.Parse(h); err != nil {
			return Principal{}, false
		}
		sub = h
	}
	return Principal{Subject: sub, Roles: m.dev.Roles, AZP: "dev"}, true
}
