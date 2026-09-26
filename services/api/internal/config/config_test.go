package config

import "testing"

func TestLoadRequiresOIDC(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	if _, err := Load(); err == nil {
		t.Fatal("OIDC_* are required outside dev mode")
	}
	t.Setenv("OIDC_ISSUER", "http://localhost/auth/realms/rav5/")
	t.Setenv("OIDC_JWKS_URL", "http://keycloak/certs")
	t.Setenv("OIDC_AUDIENCE", "rav5-api")
	if _, err := Load(); err == nil {
		t.Fatal("an issuer with a trailing slash must be rejected")
	}
	t.Setenv("OIDC_ISSUER", "http://localhost/auth/realms/rav5")
	c, err := Load()
	if err != nil || !c.OIDCEnabled() || c.AuthDevMode {
		t.Fatalf("config = %+v, err = %v", c, err)
	}
}

// TODO(dev-auth): удалить вместе с dev-режимом.
func TestDevModeOnlyLocalAndWithoutKeycloak(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("AUTH_DEV_MODE", "true")
	c, err := Load()
	if err != nil || c.OIDCEnabled() || c.AuthDevSub != DefaultDevSub || len(c.AuthDevRoles) != 2 {
		t.Fatalf("dev config = %+v, err = %v", c, err)
	}
	t.Setenv("AUTH_DEV_ROLES", " user ")
	if c, _ := Load(); len(c.AuthDevRoles) != 1 || c.AuthDevRoles[0] != "user" {
		t.Fatalf("roles = %q", c.AuthDevRoles)
	}
	t.Setenv("APP_ENV", "stand")
	if _, err := Load(); err == nil {
		t.Fatal("dev mode must be refused outside APP_ENV=local")
	}
}
