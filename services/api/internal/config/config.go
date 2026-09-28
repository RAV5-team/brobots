// Package config reads the api service settings from environment variables.
package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds the runtime settings of the service.
type Config struct {
	HTTPAddr       string
	DatabaseURL    string
	AppEnv         string
	LogLevel       slog.Level
	MigrateOnStart bool
	SeedDemo       bool
	SwaggerEnabled bool
	// EconomicsURL is the calculation service (docs/orchestrator.md); empty — the in-process mock model.
	EconomicsURL     string
	EconomicsTimeout time.Duration
	// SimulationURL is services/simulation for the «Симуляция» step; empty — the step answers 503.
	SimulationURL     string
	SimulationTimeout time.Duration
	// Keycloak access token verification (docs/keycloak/middleware.md).
	OIDCIssuer   string
	OIDCJWKSURL  string
	OIDCAudience string
	// TODO(dev-auth): удалить dev-режим вместе с AUTH_DEV_*. Запросы без токена идут от AuthDevSub
	// с ролями AuthDevRoles; OIDC_* необязательны. Только при APP_ENV=local.
	AuthDevMode  bool
	AuthDevSub   string
	AuthDevRoles []string
}

// DefaultDevSub is the dev user of AUTH_DEV_MODE when AUTH_DEV_SUB is not set.
const DefaultDevSub = "11111111-1111-4111-8111-111111111111"

// Load reads the configuration from the environment and applies defaults.
func Load() (Config, error) {
	c := Config{
		HTTPAddr:    getenv("HTTP_ADDR", ":8000"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		AppEnv:      getenv("APP_ENV", "local"),
		// No defaults: iss must match the tokens byte for byte, a guess would reject them all.
		OIDCIssuer:   os.Getenv("OIDC_ISSUER"),
		OIDCJWKSURL:  os.Getenv("OIDC_JWKS_URL"),
		OIDCAudience: os.Getenv("OIDC_AUDIENCE"),
	}
	if c.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is not set")
	}
	var err error
	if c.AuthDevMode, err = parseBool("AUTH_DEV_MODE", false); err != nil {
		return Config{}, err
	}
	if c.AuthDevMode { // TODO(dev-auth): удалить вместе с dev-режимом
		if c.AppEnv != "local" {
			return Config{}, fmt.Errorf("AUTH_DEV_MODE is allowed only with APP_ENV=local, got %q", c.AppEnv)
		}
		c.AuthDevSub = getenv("AUTH_DEV_SUB", DefaultDevSub)
		c.AuthDevRoles = splitList(getenv("AUTH_DEV_ROLES", "user,admin"))
		if c.OIDCIssuer == "" && c.OIDCJWKSURL == "" && c.OIDCAudience == "" {
			return c.finish()
		}
	}
	for _, v := range [][2]string{{"OIDC_ISSUER", c.OIDCIssuer}, {"OIDC_JWKS_URL", c.OIDCJWKSURL}, {"OIDC_AUDIENCE", c.OIDCAudience}} {
		if v[1] == "" {
			return Config{}, fmt.Errorf("%s is not set", v[0])
		}
	}
	if strings.HasSuffix(c.OIDCIssuer, "/") {
		return Config{}, fmt.Errorf("OIDC_ISSUER: %q must not end with a slash (it is compared with iss byte for byte)", c.OIDCIssuer)
	}
	return c.finish()
}

// OIDCEnabled reports whether tokens can be verified; false only in dev mode without Keycloak.
func (c Config) OIDCEnabled() bool { return c.OIDCIssuer != "" }

func (c Config) finish() (Config, error) {
	var err error
	if c.LogLevel, err = parseLevel(getenv("LOG_LEVEL", "info")); err != nil {
		return Config{}, err
	}
	if c.MigrateOnStart, err = parseBool("MIGRATE_ON_START", true); err != nil {
		return Config{}, err
	}
	if c.SeedDemo, err = parseBool("SEED_DEMO", false); err != nil {
		return Config{}, err
	}
	if c.SwaggerEnabled, err = parseBool("SWAGGER_ENABLED", true); err != nil {
		return Config{}, err
	}
	c.EconomicsURL = strings.TrimSpace(os.Getenv("ECONOMICS_URL"))
	if c.EconomicsTimeout, err = parseDuration("ECONOMICS_TIMEOUT", 10*time.Second); err != nil {
		return Config{}, err
	}
	c.SimulationURL = strings.TrimRight(strings.TrimSpace(os.Getenv("SIMULATION_URL")), "/")
	if c.SimulationTimeout, err = parseDuration("SIMULATION_TIMEOUT", 30*time.Second); err != nil {
		return Config{}, err
	}
	return c, nil
}

func parseDuration(key string, def time.Duration) (time.Duration, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil || d <= 0 {
		return 0, fmt.Errorf("%s: %q is not a positive duration such as 10s", key, v)
	}
	return d, nil
}

func splitList(v string) []string {
	var out []string
	for _, part := range strings.Split(v, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func parseBool(key string, def bool) (bool, error) {
	v := os.Getenv(key)
	if v == "" {
		return def, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return false, fmt.Errorf("%s: %q is not a boolean", key, v)
	}
	return b, nil
}

func parseLevel(v string) (slog.Level, error) {
	switch strings.ToLower(v) {
	case "debug":
		return slog.LevelDebug, nil
	case "info":
		return slog.LevelInfo, nil
	case "warn":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	}
	return 0, fmt.Errorf("LOG_LEVEL: unknown level %q", v)
}
