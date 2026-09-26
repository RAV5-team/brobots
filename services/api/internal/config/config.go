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
}

// Load reads the configuration from the environment and applies defaults.
func Load() (Config, error) {
	c := Config{
		HTTPAddr:    getenv("HTTP_ADDR", ":8000"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		AppEnv:      getenv("APP_ENV", "local"),
	}
	if c.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is not set")
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
