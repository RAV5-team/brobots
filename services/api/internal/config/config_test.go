package config

import (
	"testing"
	"time"
)

func TestEconomicsSettings(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("AUTH_DEV_MODE", "true")
	c, err := Load()
	if err != nil || c.EconomicsURL != "" || c.EconomicsTimeout != 10*time.Second {
		t.Fatalf("defaults = %q %v, err = %v", c.EconomicsURL, c.EconomicsTimeout, err)
	}
	t.Setenv("ECONOMICS_URL", " http://economics:8002 ")
	t.Setenv("ECONOMICS_TIMEOUT", "3s")
	if c, err = Load(); err != nil || c.EconomicsURL != "http://economics:8002" || c.EconomicsTimeout != 3*time.Second {
		t.Fatalf("economics = %q %v, err = %v", c.EconomicsURL, c.EconomicsTimeout, err)
	}
	t.Setenv("ECONOMICS_TIMEOUT", "ten")
	if _, err := Load(); err == nil {
		t.Fatal("an invalid timeout must be rejected")
	}
}

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

func TestServiceTokenSettingsGoTogether(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("AUTH_DEV_MODE", "true")
	if c, err := Load(); err != nil || c.ServiceTokenEnabled() {
		t.Fatalf("without KC_CLIENT_ID the service token is off: %v %v", c.ServiceTokenEnabled(), err)
	}
	t.Setenv("KC_CLIENT_ID", "rav5-api-internal")
	if _, err := Load(); err == nil {
		t.Fatal("KC_CLIENT_ID without the secret and the token URL must be rejected")
	}
	t.Setenv("KC_CLIENT_SECRET", "secret")
	t.Setenv("OIDC_TOKEN_URL", "http://keycloak:8080/auth/realms/rav5/protocol/openid-connect/token")
	if c, err := Load(); err != nil || !c.ServiceTokenEnabled() {
		t.Fatalf("service token = %v, err = %v", c.ServiceTokenEnabled(), err)
	}
}
