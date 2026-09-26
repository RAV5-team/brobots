// Package config reads the api service settings from environment variables.
package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
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
	// Keycloak access token verification (docs/keycloak/middleware.md).
	OIDCIssuer   string
	OIDCJWKSURL  string
	OIDCAudience string
}

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
	for _, v := range [][2]string{{"OIDC_ISSUER", c.OIDCIssuer}, {"OIDC_JWKS_URL", c.OIDCJWKSURL}, {"OIDC_AUDIENCE", c.OIDCAudience}} {
		if v[1] == "" {
			return Config{}, fmt.Errorf("%s is not set", v[0])
		}
	}
	if strings.HasSuffix(c.OIDCIssuer, "/") {
		return Config{}, fmt.Errorf("OIDC_ISSUER: %q must not end with a slash (it is compared with iss byte for byte)", c.OIDCIssuer)
	}
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
	return c, nil
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
